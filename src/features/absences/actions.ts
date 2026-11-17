"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dateKeyOf } from "@/compliance";
import { evaluateMemberRange } from "@/features/compliance/evaluate-member";
import { requireAdminArea, requireMember } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  type: z.enum(["vacation", "sick", "child_sick", "special", "unpaid", "comp_time"]),
  start: z.iso.date(),
  end: z.iso.date(),
  halfStart: z.boolean().default(false),
  halfEnd: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
  attachmentPath: z.string().max(500).optional(),
});

export type AbsenceResult = { ok: true; status: string } | { ok: false; error: string };

export async function requestAbsence(input: z.input<typeof schema>): Promise<AbsenceResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bitte Zeitraum prüfen." };
  const viewer = await requireMember();
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_absence", {
    p_membership_id: viewer.active.id,
    p_type_key: v.type,
    p_start: v.start,
    p_end: v.end,
    p_half_start: v.halfStart,
    p_half_end: v.halfEnd,
    p_note: v.note,
    p_attachment: v.attachmentPath,
  });
  if (error || !data) return { ok: false, error: error?.code === "P0001" ? error.message : "Speichern fehlgeschlagen." };

  // Krankheit wirkt sofort → betroffene vergangene Tage neu bewerten (z. B. MiLoG „fehlt")
  if (data.status === "approved") {
    const today = dateKeyOf(new Date());
    if (v.start <= today) {
      try {
        await evaluateMemberRange(createAdminClient(), viewer.active.id, v.start, v.end < today ? v.end : today);
      } catch (e) {
        console.error(e);
      }
    }
  }
  revalidatePath("/app", "layout");
  return { ok: true, status: data.status };
}

export async function cancelAbsence(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_absence", { p_absence: id });
  if (error) return { ok: false, error: error.code === "P0001" ? error.message : "Fehlgeschlagen." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

const adminSchema = z.object({
  membershipId: z.uuid(),
  type: z.enum(["vacation", "sick", "child_sick", "school", "special", "unpaid", "comp_time"]),
  start: z.iso.date(),
  end: z.iso.date(),
  note: z.string().trim().max(500).optional(),
});

/** Verwaltung trägt eine Abwesenheit direkt ein (z. B. telefonische Krankmeldung) – genehmigt. */
export async function createAbsenceForMember(input: z.input<typeof adminSchema>): Promise<AbsenceResult> {
  const parsed = adminSchema.safeParse(input);
  if (!parsed.success || parsed.data.end < parsed.data.start) return { ok: false, error: "Bitte Zeitraum prüfen." };
  const viewer = await requireAdminArea();
  const v = parsed.data;
  const supabase = await createClient();
  const [{ data: type }, { data: overlap }] = await Promise.all([
    supabase.from("absence_types").select("id").eq("org_id", viewer.active.orgId).eq("key", v.type).single(),
    supabase.from("absences").select("id").eq("membership_id", v.membershipId).in("status", ["pending", "approved"]).lte("start_date", v.end).gte("end_date", v.start).limit(1),
  ]);
  if (!type) return { ok: false, error: "Unbekannte Abwesenheitsart." };
  if (overlap?.length) return { ok: false, error: "In diesem Zeitraum ist bereits eine Abwesenheit eingetragen." };
  const { error } = await supabase.from("absences").insert({
    org_id: viewer.active.orgId,
    membership_id: v.membershipId,
    type_id: type.id,
    start_date: v.start,
    end_date: v.end,
    status: "approved",
    note: v.note || null,
    reviewed_by: viewer.userId,
    reviewed_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.code === "42501" ? "Keine Berechtigung für diese Person." : "Speichern fehlgeschlagen." };
  const today = dateKeyOf(new Date());
  if (v.start <= today) {
    try {
      await evaluateMemberRange(createAdminClient(), v.membershipId, v.start, v.end < today ? v.end : today);
    } catch (e) {
      console.error(e);
    }
  }
  revalidatePath("/admin/abwesenheiten");
  return { ok: true, status: "approved" };
}
