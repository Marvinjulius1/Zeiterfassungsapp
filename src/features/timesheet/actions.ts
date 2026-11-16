"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dateKeyOf } from "@/compliance";
import { evaluateMemberRange, loadMemberContext } from "@/features/compliance/evaluate-member";
import { requireMember } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  workDate: z.iso.date(),
  kind: z.enum(["missing_check_in", "missing_check_out", "wrong_time", "missing_break"]),
  proposed: z
    .array(z.object({ kind: z.enum(["check_in", "break_start", "break_end", "check_out"]), occurred_at: z.iso.datetime({ offset: true }) }))
    .min(1)
    .max(4),
  reason: z.string().trim().min(3, "Bitte gib eine Begründung an.").max(1000),
});

export type SubmitCorrectionResult = { ok: true; applied: boolean } | { ok: false; error: string };

/**
 * Korrekturantrag stellen. Erlaubt die Firmenregel Selbstkorrekturen,
 * wird der Antrag sofort übernommen – protokolliert wie jede Freigabe.
 */
export async function submitCorrection(input: z.input<typeof schema>): Promise<SubmitCorrectionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const viewer = await requireMember();
  const v = parsed.data;
  if (v.workDate > dateKeyOf(new Date())) return { ok: false, error: "Korrekturen für die Zukunft sind nicht möglich." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("correction_requests")
    .insert({
      org_id: viewer.active.orgId,
      membership_id: viewer.active.id,
      work_date: v.workDate,
      kind: v.kind,
      proposed: v.proposed,
      reason: v.reason,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Antrag konnte nicht gesendet werden." };

  let applied = false;
  try {
    const admin = createAdminClient();
    const ctx = await loadMemberContext(admin, viewer.active.id);
    if (ctx.rules.corrections.mode === "self") {
      const { error: applyError } = await admin.rpc("self_apply_correction", { p_request: data.id });
      if (!applyError) {
        applied = true;
        const today = dateKeyOf(new Date());
        await evaluateMemberRange(admin, viewer.active.id, v.workDate, today > v.workDate ? today : v.workDate);
      }
    }
  } catch (e) {
    console.error("Selbstkorrektur fehlgeschlagen – Antrag bleibt offen", e);
  }

  revalidatePath("/app", "layout");
  return { ok: true, applied };
}
