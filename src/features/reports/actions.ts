"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isOrgAdmin } from "@/lib/auth/roles";
import { requireAdminArea, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMonthReport, snapshotOf } from "./month-report";
import { payrollSettingsSchema } from "./payroll-settings";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const monthSchema = z.string().regex(/^\d{4}-\d{2}-01$/);
const dbMsg = (e: { code?: string; message: string }, fallback: string) => (e.code === "P0001" || e.code === "42501" ? e.message : fallback);

/** Mitarbeitende bestätigen ihre Zeiten eines abgelaufenen Monats */
export async function confirmMonth(month: string): Promise<Result> {
  if (!monthSchema.safeParse(month).success) return fail("Ungültiger Monat");
  const viewer = await requireMember();
  const supabase = await createClient();
  const report = await getMonthReport(supabase, viewer.active.id, month);
  if (!report) return fail("Bericht nicht gefunden.");
  if (report.totals.incompleteDays > 0) return fail(`An ${report.totals.incompleteDays} Tag(en) fehlt das Ausstempeln. Bitte erst korrigieren.`);
  const { error } = await supabase.rpc("confirm_month", { p_membership_id: viewer.active.id, p_month: month, p_snapshot: snapshotOf(report) });
  if (error) return fail(dbMsg(error, "Bestätigen fehlgeschlagen."));
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Verwaltung schließt einen Monat für ausgewählte Personen ab */
export async function lockMonths(month: string, membershipIds: string[]): Promise<Result<{ count: number }>> {
  if (!monthSchema.safeParse(month).success || membershipIds.length === 0) return fail("Bitte Personen auswählen.");
  const viewer = await requireAdminArea();
  if (!isOrgAdmin(viewer.active.role)) return fail("Nur Owner und Admins können Monate abschließen.");
  const supabase = await createClient();
  const reports = await Promise.all(membershipIds.map((id) => getMonthReport(supabase, id, month)));
  const items = reports.filter((r) => !!r).map((r) => ({ membership_id: r!.membershipId, snapshot: snapshotOf(r!) }));
  const { data, error } = await supabase.rpc("lock_months", { p_month: month, p_items: items });
  if (error) return fail(dbMsg(error, "Abschließen fehlgeschlagen."));
  revalidatePath("/admin/berichte");
  return { ok: true, data: { count: data ?? 0 } };
}

export async function unlockMonth(month: string, membershipId: string, reason: string): Promise<Result> {
  if (!monthSchema.safeParse(month).success) return fail("Ungültiger Monat");
  await requireAdminArea();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlock_month", { p_membership_id: membershipId, p_month: month, p_reason: reason });
  if (error) return fail(dbMsg(error, "Entsperren fehlgeschlagen."));
  revalidatePath("/admin/berichte");
  return { ok: true };
}

export async function savePayrollSettings(input: z.input<typeof payrollSettingsSchema>): Promise<Result> {
  const parsed = payrollSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("Bitte nur Ziffern eintragen (Berater-Nr. max. 7, Mandanten-Nr. max. 5 Stellen).");
  const viewer = await requireAdminArea();
  if (!isOrgAdmin(viewer.active.role)) return fail("Nur Owner und Admins.");
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ payroll_settings: parsed.data }).eq("id", viewer.active.orgId);
  if (error) return fail("Speichern fehlgeschlagen.");
  revalidatePath("/admin/berichte");
  return { ok: true };
}
