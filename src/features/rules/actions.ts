"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ruleOverrideSchema } from "@/compliance";
import { requireAdminArea } from "@/lib/auth/session";
import { isOrgAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  scope: z.enum(["org", "location"]),
  scopeId: z.uuid(),
  override: ruleOverrideSchema,
});

export type SaveRulesResult = { ok: true } | { ok: false; error: string };

export async function saveRules(input: z.input<typeof inputSchema>): Promise<SaveRulesResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ungültige Regelwerte." };
  const viewer = await requireAdminArea();
  if (!isOrgAdmin(viewer.active.role)) return { ok: false, error: "Nur Owner und Admins dürfen Regeln ändern." };

  const { scope, scopeId, override } = parsed.data;
  const orgId = viewer.active.orgId;
  if (scope === "org" && scopeId !== orgId) return { ok: false, error: "Falsche Firma." };

  const supabase = await createClient();
  if (scope === "location") {
    const { data: loc } = await supabase.from("locations").select("id").eq("id", scopeId).eq("org_id", orgId).maybeSingle();
    if (!loc) return { ok: false, error: "Standort nicht gefunden." };
  }

  const { data: existing } = await supabase
    .from("rule_sets")
    .select("id, version")
    .eq("scope", scope)
    .eq("scope_id", scopeId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("rule_sets")
        .update({ settings: override, version: existing.version + 1, updated_by: viewer.userId })
        .eq("id", existing.id)
    : await supabase
        .from("rule_sets")
        .insert({ org_id: orgId, scope, scope_id: scopeId, settings: override, updated_by: viewer.userId });

  if (error) return { ok: false, error: "Speichern fehlgeschlagen." };
  revalidatePath("/admin/regeln");
  return { ok: true };
}
