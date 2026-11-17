"use server";

import { revalidatePath } from "next/cache";
import { TZDate } from "@date-fns/tz";
import { z } from "zod";
import { addDaysKey, dateKeyOf, localTime } from "@/compliance";
import { requireAdminArea, requireMember } from "@/lib/auth/session";
import { schedulePush } from "@/lib/push/schedule";
import { createClient } from "@/lib/supabase/server";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

/** „yyyy-MM-dd" + „HH:mm" (Berlin) → ISO. Ende vor Beginn = am Folgetag (Nachtschicht). */
function toRange(date: string, from: string, to: string): { startsAt: string; endsAt: string } {
  const at = (d: string, t: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    const [h, mi] = t.split(":").map(Number);
    return new TZDate(y, m - 1, dd, h, mi, "Europe/Berlin");
  };
  const start = at(date, from);
  let end = at(date, to);
  if (end <= start) end = at(addDaysKey(date, 1), to);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

const time = z.string().regex(/^\d{2}:\d{2}$/);
const shiftSchema = z.object({
  id: z.uuid().optional(),
  locationId: z.uuid(),
  membershipId: z.uuid().nullable(),
  date: z.iso.date(),
  from: time,
  to: time,
  breakMinutes: z.number().int().min(0).max(180),
  position: z.string().trim().max(60).optional(),
});

export async function saveShift(input: z.input<typeof shiftSchema>): Promise<Result> {
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return fail("Bitte Zeiten prüfen.");
  const viewer = await requireAdminArea();
  const v = parsed.data;
  const { startsAt, endsAt } = toRange(v.date, v.from, v.to);
  if (Date.parse(endsAt) - Date.parse(startsAt) > 16 * 3600000) return fail("Eine Schicht darf höchstens 16 Stunden lang sein.");
  const supabase = await createClient();
  const row = {
    location_id: v.locationId,
    membership_id: v.membershipId,
    starts_at: startsAt,
    ends_at: endsAt,
    break_minutes: v.breakMinutes,
    position: v.position || null,
  };
  const { error } = v.id
    ? await supabase.from("shifts").update(row).eq("id", v.id).eq("org_id", viewer.active.orgId)
    : await supabase.from("shifts").insert({ ...row, org_id: viewer.active.orgId, status: "draft", created_by: viewer.userId });
  if (error) return fail(error.code === "42501" ? "Keine Berechtigung für diese Person." : "Speichern fehlgeschlagen.");
  revalidatePath("/admin/schichtplan");
  return { ok: true };
}

/** Per Drag & Drop verschieben: andere Person und/oder anderer Tag, Uhrzeiten bleiben. */
export async function moveShift(id: string, membershipId: string | null, date: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Ungültiges Datum");
  await requireAdminArea();
  const supabase = await createClient();
  const { data: s } = await supabase.from("shifts").select("starts_at, ends_at").eq("id", id).single();
  if (!s) return fail("Schicht nicht gefunden.");
  const dayShift = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${dateKeyOf(new Date(s.starts_at))}T12:00:00Z`)) / 86400000);
  // Verschieben um ganze Kalendertage in Berliner Zeit (sommerzeitsicher)
  const move = (iso: string) => {
    const d = new TZDate(new Date(iso), "Europe/Berlin");
    return new TZDate(d.getFullYear(), d.getMonth(), d.getDate() + dayShift, d.getHours(), d.getMinutes(), "Europe/Berlin").toISOString();
  };
  const { error } = await supabase
    .from("shifts")
    .update({ membership_id: membershipId, starts_at: move(s.starts_at), ends_at: move(s.ends_at) })
    .eq("id", id);
  if (error) return fail("Verschieben fehlgeschlagen.");
  revalidatePath("/admin/schichtplan");
  return { ok: true };
}

export async function deleteShift(id: string): Promise<Result> {
  await requireAdminArea();
  const supabase = await createClient();
  const { data: s } = await supabase.from("shifts").select("status").eq("id", id).single();
  if (!s) return fail("Schicht nicht gefunden.");
  // Entwürfe dürfen weg, veröffentlichte werden abgesagt (nachvollziehbar)
  const { error } = s.status === "draft" ? await supabase.from("shifts").delete().eq("id", id) : await supabase.from("shifts").update({ status: "cancelled" }).eq("id", id);
  if (error) return fail("Löschen fehlgeschlagen.");
  revalidatePath("/admin/schichtplan");
  return { ok: true };
}

export async function publishWeek(monday: string, locationId: string | null): Promise<Result<{ count: number }>> {
  const viewer = await requireAdminArea();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_shifts", {
    p_org: viewer.active.orgId,
    p_from: monday,
    p_to: addDaysKey(monday, 6),
    p_location: locationId ?? undefined,
  });
  if (error) return fail(error.code === "42501" ? "Keine Berechtigung." : "Veröffentlichen fehlgeschlagen.");
  schedulePush();
  revalidatePath("/admin/schichtplan");
  return { ok: true, data: { count: data ?? 0 } };
}

/** Vorwoche als Entwurf übernehmen – bereits geplante Tage bleiben unangetastet. */
export async function copyPreviousWeek(monday: string, locationId: string | null): Promise<Result<{ count: number }>> {
  const viewer = await requireAdminArea();
  const supabase = await createClient();
  const prevFrom = localTime(addDaysKey(monday, -7), 0).toISOString();
  const thisFrom = localTime(monday, 0).toISOString();
  const nextFrom = localTime(addDaysKey(monday, 7), 0).toISOString();
  let q = supabase.from("shifts").select("location_id, membership_id, starts_at, ends_at, break_minutes, position").eq("org_id", viewer.active.orgId).neq("status", "cancelled");
  if (locationId) q = q.eq("location_id", locationId);
  const [{ data: prev }, { data: current }] = await Promise.all([
    q.gte("starts_at", prevFrom).lt("starts_at", thisFrom),
    supabase.from("shifts").select("membership_id, starts_at").eq("org_id", viewer.active.orgId).gte("starts_at", thisFrom).lt("starts_at", nextFrom).neq("status", "cancelled"),
  ]);
  const taken = new Set((current ?? []).map((c) => `${c.membership_id}|${dateKeyOf(new Date(c.starts_at))}`));
  const plus7 = (iso: string) => {
    const d = new TZDate(new Date(iso), "Europe/Berlin");
    return new TZDate(d.getFullYear(), d.getMonth(), d.getDate() + 7, d.getHours(), d.getMinutes(), "Europe/Berlin").toISOString();
  };
  const rows = (prev ?? [])
    .map((s) => ({ ...s, starts_at: plus7(s.starts_at), ends_at: plus7(s.ends_at) }))
    .filter((s) => !s.membership_id || !taken.has(`${s.membership_id}|${dateKeyOf(new Date(s.starts_at))}`))
    .map((s) => ({ ...s, org_id: viewer.active.orgId, status: "draft", created_by: viewer.userId }));
  if (rows.length === 0) return { ok: true, data: { count: 0 } };
  const { error } = await supabase.from("shifts").insert(rows);
  if (error) return fail("Kopieren fehlgeschlagen.");
  revalidatePath("/admin/schichtplan");
  return { ok: true, data: { count: rows.length } };
}

// ---------------------------------------------------------------------------
// Mitarbeitende: Schichtbörse & Tausch
// ---------------------------------------------------------------------------
async function rpcResult(fn: () => PromiseLike<{ error: { code?: string; message: string } | null }>, okPath = "/app/plan"): Promise<Result> {
  const { error } = await fn();
  if (error) return fail(error.code === "P0001" || error.code === "42501" ? error.message : "Fehlgeschlagen.");
  schedulePush();
  revalidatePath(okPath);
  return { ok: true };
}

export async function claimShift(shiftId: string) {
  await requireMember();
  const supabase = await createClient();
  return rpcResult(() => supabase.rpc("claim_open_shift", { p_shift: shiftId }));
}

export async function requestSwap(shiftId: string, targetId: string) {
  await requireMember();
  const supabase = await createClient();
  return rpcResult(() => supabase.rpc("request_shift_swap", { p_shift: shiftId, p_target: targetId }));
}

export async function respondSwap(requestId: string, accept: boolean) {
  await requireMember();
  const supabase = await createClient();
  return rpcResult(() => supabase.rpc("respond_shift_swap", { p_request: requestId, p_accept: accept }));
}

export async function reviewClaim(claimId: string, approve: boolean) {
  await requireAdminArea();
  const supabase = await createClient();
  return rpcResult(() => supabase.rpc("review_shift_claim", { p_claim: claimId, p_approve: approve }), "/admin");
}

export async function reviewSwap(requestId: string, approve: boolean) {
  await requireAdminArea();
  const supabase = await createClient();
  return rpcResult(() => supabase.rpc("review_shift_swap", { p_request: requestId, p_approve: approve }), "/admin");
}
