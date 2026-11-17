"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dateKeyOf } from "@/compliance";
import { evaluateMemberRange } from "@/features/compliance/evaluate-member";
import { isOrgAdmin } from "@/lib/auth/roles";
import { requireAdminArea } from "@/lib/auth/session";
import { STATE_CODES } from "@/lib/germany";
import { createAdminClient } from "@/lib/supabase/admin";
import { schedulePush } from "@/lib/push/schedule";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Fehlermeldungen aus der Datenbank verständlich durchreichen, technische verbergen. */
function dbError(e: { message?: string; code?: string } | null, fallback: string) {
  if (!e) return fail(fallback);
  if (e.code === "P0001" || e.code === "42501") return fail(e.message ?? fallback);
  console.error(e);
  return fail(fallback);
}

/** Nach Änderungen an Zeiten neu bewerten – Fehler hier dürfen die Aktion nicht scheitern lassen. */
async function reevaluate(membershipId: string, workDate: string) {
  try {
    const today = dateKeyOf(new Date());
    await evaluateMemberRange(createAdminClient(), membershipId, workDate, today > workDate ? today : workDate);
  } catch (e) {
    console.error("Neubewertung fehlgeschlagen", e);
  }
}

// ---------------------------------------------------------------------------
// Freigaben
// ---------------------------------------------------------------------------
export async function reviewCorrection(id: string, approve: boolean, note?: string): Promise<ActionResult> {
  await requireAdminArea();
  const supabase = await createClient();
  const { data: req } = await supabase.from("correction_requests").select("membership_id, work_date").eq("id", id).maybeSingle();
  const { error } = await supabase.rpc("review_correction", { p_request: id, p_approve: approve, p_note: note });
  if (error) return dbError(error, "Freigabe fehlgeschlagen.");
  if (approve && req) await reevaluate(req.membership_id, req.work_date);
  schedulePush();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function reviewAbsence(id: string, approve: boolean, note?: string): Promise<ActionResult> {
  await requireAdminArea();
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_absence", { p_absence: id, p_approve: approve, p_note: note });
  if (error) return dbError(error, "Freigabe fehlgeschlagen.");
  schedulePush();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Zeiten bearbeiten
// ---------------------------------------------------------------------------
const correctDaySchema = z.object({
  membershipId: z.uuid(),
  workDate: z.iso.date(),
  voidIds: z.array(z.uuid()),
  add: z.array(z.object({ kind: z.enum(["check_in", "break_start", "break_end", "check_out"]), occurred_at: z.iso.datetime({ offset: true }) })),
  reason: z.string().trim().min(3, "Bitte gib eine Begründung an.").max(500),
});

export async function correctDay(input: z.input<typeof correctDaySchema>): Promise<ActionResult> {
  const parsed = correctDaySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  await requireAdminArea();
  const { membershipId, workDate, voidIds, add, reason } = parsed.data;
  if (voidIds.length === 0 && add.length === 0) return fail("Es gibt nichts zu speichern.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_correct_day", {
    p_membership: membershipId,
    p_work_date: workDate,
    p_void: voidIds,
    p_add: add,
    p_reason: reason,
  });
  if (error) return dbError(error, "Korrektur fehlgeschlagen.");
  await reevaluate(membershipId, workDate);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function acknowledgeViolation(id: string): Promise<ActionResult> {
  const viewer = await requireAdminArea();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compliance_violations")
    .update({ acknowledged_by: viewer.userId, acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return fail("Quittieren fehlgeschlagen.");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mitarbeiter
// ---------------------------------------------------------------------------
const contractSchema = z.object({
  type: z.enum(["minijob", "part_time", "full_time", "apprentice", "working_student"]),
  weeklyHours: z.number().min(0).max(60),
  workDays: z.array(z.number().int().min(1).max(7)).min(0),
  vacationDays: z.number().min(0).max(60),
  schoolDays: z.array(z.number().int().min(1).max(7)).default([]),
  trustBased: z.boolean().default(false),
});
export type ContractInput = z.input<typeof contractSchema>;

/** Wochenstunden gleichmäßig auf die Arbeitstage verteilen */
function dailyTargets(weeklyHours: number, workDays: number[]): Record<string, number> {
  const per = workDays.length ? Math.round((weeklyHours * 60) / workDays.length) : 0;
  return Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [String(d), workDays.includes(d) ? per : 0]));
}

const inviteSchema = z.object({
  displayName: z.string().trim().min(2, "Bitte gib einen Namen an.").max(120),
  email: z.union([z.email("Ungültige E-Mail-Adresse"), z.literal("")]).optional(),
  role: z.enum(["admin", "team_lead", "employee"]),
  locationId: z.uuid().nullable(),
  teamId: z.uuid().nullable(),
  birthDate: z.union([z.iso.date(), z.literal("")]).optional(),
  contract: contractSchema,
});
export type InviteInput = z.input<typeof inviteSchema>;

async function inviteUrl(token: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}/invite/${token}`;
}

export async function inviteMember(input: InviteInput): Promise<ActionResult<{ membershipId: string; url: string; expiresAt: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const viewer = await requireAdminArea();
  if (!isOrgAdmin(viewer.active.role)) return fail("Nur Owner und Admins können einladen.");
  const v = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("invite_member", {
    p_org: viewer.active.orgId,
    p_display_name: v.displayName,
    p_email: v.email || undefined,
    p_role: v.role,
    p_location_id: v.locationId ?? undefined,
    p_team_id: v.teamId ?? undefined,
  });
  const inv = data?.[0];
  if (error || !inv) return dbError(error, "Einladung fehlgeschlagen.");

  const today = dateKeyOf(new Date());
  const [c1, c2, c3] = await Promise.all([
    supabase.from("employment_contracts").insert({
      org_id: viewer.active.orgId,
      membership_id: inv.membership_id,
      valid_from: today,
      type: v.contract.type,
      weekly_minutes: Math.round(v.contract.weeklyHours * 60),
      daily_targets: dailyTargets(v.contract.weeklyHours, v.contract.workDays),
      vacation_days_per_year: v.contract.vacationDays,
      school_days: v.contract.schoolDays,
      trust_based_hours: v.contract.trustBased,
    }),
    supabase.from("vacation_entitlements").insert({
      org_id: viewer.active.orgId,
      membership_id: inv.membership_id,
      year: Number(today.slice(0, 4)),
      days: v.contract.vacationDays,
    }),
    v.birthDate ? supabase.from("memberships").update({ birth_date: v.birthDate }).eq("id", inv.membership_id) : Promise.resolve({ error: null }),
  ]);
  if (c1.error || c2.error || c3.error) console.error(c1.error ?? c2.error ?? c3.error);

  revalidatePath("/admin/mitarbeiter");
  return { ok: true, data: { membershipId: inv.membership_id, url: await inviteUrl(inv.token), expiresAt: inv.expires_at } };
}

export async function reissueInvitation(membershipId: string): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  await requireAdminArea();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reissue_invitation", { p_membership: membershipId });
  if (error || !data?.[0]) return dbError(error, "Neue Einladung fehlgeschlagen.");
  return { ok: true, data: { url: await inviteUrl(data[0].token), expiresAt: data[0].expires_at } };
}

const memberPatchSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["owner", "admin", "team_lead", "employee"]).optional(),
  locationId: z.uuid().nullable().optional(),
  teamId: z.uuid().nullable().optional(),
  employeeNo: z.string().trim().max(30).nullable().optional(),
  birthDate: z.union([z.iso.date(), z.literal(""), z.null()]).optional(),
  maternityProtection: z.boolean().optional(),
});

export async function updateMember(id: string, patch: z.input<typeof memberPatchSchema>): Promise<ActionResult> {
  const parsed = memberPatchSchema.safeParse(patch);
  if (!parsed.success) return fail("Ungültige Eingabe");
  await requireAdminArea();
  const p = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({
      ...(p.displayName !== undefined && { display_name: p.displayName }),
      ...(p.role !== undefined && { role: p.role }),
      ...(p.locationId !== undefined && { location_id: p.locationId }),
      ...(p.teamId !== undefined && { team_id: p.teamId }),
      ...(p.employeeNo !== undefined && { employee_no: p.employeeNo || null }),
      ...(p.birthDate !== undefined && { birth_date: p.birthDate || null }),
      ...(p.maternityProtection !== undefined && { maternity_protection: p.maternityProtection }),
    })
    .eq("id", id)
    .select("id");
  if (error) return dbError(error, "Speichern fehlgeschlagen.");
  if (!data?.length) return fail("Keine Berechtigung – nur Admins können Mitarbeiterdaten ändern.");
  revalidatePath("/admin/mitarbeiter", "layout");
  return { ok: true };
}

export async function setMembersArchived(ids: string[], archived: boolean): Promise<ActionResult<{ count: number }>> {
  const viewer = await requireAdminArea();
  if (ids.length === 0) return fail("Niemand ausgewählt.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update(archived ? { status: "archived", archived_at: new Date().toISOString() } : { status: "active", archived_at: null })
    .in("id", ids)
    .neq("user_id", viewer.userId) // sich selbst nicht archivieren
    .select("id");
  if (error) return dbError(error, "Aktion fehlgeschlagen.");
  revalidatePath("/admin/mitarbeiter", "layout");
  return { ok: true, data: { count: data?.length ?? 0 } };
}

export async function bulkUpdateMembers(ids: string[], patch: { locationId?: string | null; teamId?: string | null }): Promise<ActionResult<{ count: number }>> {
  await requireAdminArea();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({
      ...(patch.locationId !== undefined && { location_id: patch.locationId }),
      ...(patch.teamId !== undefined && { team_id: patch.teamId }),
    })
    .in("id", ids)
    .select("id");
  if (error) return dbError(error, "Aktion fehlgeschlagen.");
  revalidatePath("/admin/mitarbeiter", "layout");
  return { ok: true, data: { count: data?.length ?? 0 } };
}

/**
 * Vertrag ändern: Gilt die Änderung ab heute oder später, wird der laufende Vertrag
 * beendet und eine neue Version angelegt – die Historie bleibt nachvollziehbar.
 */
export async function saveContract(membershipId: string, validFrom: string, input: ContractInput): Promise<ActionResult> {
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success || !/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) return fail("Ungültige Vertragsdaten.");
  const viewer = await requireAdminArea();
  if (!isOrgAdmin(viewer.active.role)) return fail("Nur Owner und Admins können Verträge ändern.");
  const c = parsed.data;
  const supabase = await createClient();
  const row = {
    type: c.type,
    weekly_minutes: Math.round(c.weeklyHours * 60),
    daily_targets: dailyTargets(c.weeklyHours, c.workDays),
    vacation_days_per_year: c.vacationDays,
    school_days: c.schoolDays,
    trust_based_hours: c.trustBased,
  };

  const { data: current } = await supabase
    .from("employment_contracts")
    .select("id, valid_from")
    .eq("membership_id", membershipId)
    .lte("valid_from", validFrom)
    .or(`valid_to.is.null,valid_to.gte.${validFrom}`)
    .maybeSingle();

  if (current && current.valid_from === validFrom) {
    const { error } = await supabase.from("employment_contracts").update(row).eq("id", current.id);
    if (error) return dbError(error, "Speichern fehlgeschlagen.");
  } else {
    if (current) {
      const dayBefore = new Date(Date.UTC(+validFrom.slice(0, 4), +validFrom.slice(5, 7) - 1, +validFrom.slice(8, 10) - 1)).toISOString().slice(0, 10);
      const { error } = await supabase.from("employment_contracts").update({ valid_to: dayBefore }).eq("id", current.id);
      if (error) return dbError(error, "Speichern fehlgeschlagen.");
    }
    const { error } = await supabase
      .from("employment_contracts")
      .insert({ ...row, org_id: viewer.active.orgId, membership_id: membershipId, valid_from: validFrom });
    if (error) return dbError(error, "Speichern fehlgeschlagen.");
  }
  revalidatePath("/admin/mitarbeiter", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Personalakte
// ---------------------------------------------------------------------------
const documentSchema = z.object({
  membershipId: z.uuid(),
  category: z.enum(["contract", "sick_note", "certificate", "payslip", "other"]),
  title: z.string().trim().min(1).max(200),
  storagePath: z.string().min(10).max(500),
  mimeType: z.string().max(100).optional(),
  sizeBytes: z.number().int().min(0).optional(),
});

export async function registerDocument(input: z.input<typeof documentSchema>): Promise<ActionResult> {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return fail("Ungültige Datei.");
  const viewer = await requireAdminArea();
  const d = parsed.data;
  if (!d.storagePath.startsWith(`${viewer.active.orgId}/${d.membershipId}/`)) return fail("Ungültiger Speicherort.");
  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert({
    org_id: viewer.active.orgId,
    membership_id: d.membershipId,
    category: d.category,
    title: d.title,
    storage_path: d.storagePath,
    mime_type: d.mimeType,
    size_bytes: d.sizeBytes,
    uploaded_by: viewer.userId,
  });
  if (error) return dbError(error, "Dokument konnte nicht gespeichert werden.");
  revalidatePath("/admin/mitarbeiter", "layout");
  return { ok: true };
}

export async function documentDownloadUrl(documentId: string): Promise<ActionResult<{ url: string }>> {
  await requireAdminArea();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", documentId).maybeSingle();
  if (!doc) return fail("Dokument nicht gefunden.");
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60);
  if (error || !data) return fail("Download nicht möglich.");
  return { ok: true, data: { url: data.signedUrl } };
}

// ---------------------------------------------------------------------------
// Firmeneinstellungen
// ---------------------------------------------------------------------------
const orgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  defaultState: z.enum(STATE_CODES),
  retentionMonths: z.number().int().min(24, "Mindestens 24 Monate (§ 16 Abs. 2 ArbZG)").max(240),
  hasWorksCouncil: z.boolean(),
});

export async function updateOrganization(input: z.input<typeof orgSchema>): Promise<ActionResult> {
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const viewer = await requireAdminArea();
  if (!isOrgAdmin(viewer.active.role)) return fail("Nur Owner und Admins können die Firma bearbeiten.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      default_state: parsed.data.defaultState,
      retention_months: parsed.data.retentionMonths,
      has_works_council: parsed.data.hasWorksCouncil,
    })
    .eq("id", viewer.active.orgId);
  if (error) return dbError(error, "Speichern fehlgeschlagen.");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
