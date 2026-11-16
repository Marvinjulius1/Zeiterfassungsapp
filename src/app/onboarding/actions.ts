"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/session";
import { STATE_CODES } from "@/lib/germany";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  companyName: z.string().trim().min(2, "Mindestens 2 Zeichen").max(120),
  state: z.enum(STATE_CODES),
  locationName: z.string().trim().min(1, "Bitte gib einen Standort an").max(120),
  displayName: z.string().trim().min(2, "Bitte gib deinen Namen an").max(120),
});

export type CreateOrgInput = z.input<typeof schema>;
export type CreateOrgResult = { ok: true; orgId: string } | { ok: false; error: string };

export async function createOrganization(input: CreateOrgInput): Promise<CreateOrgResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.companyName,
    p_state: parsed.data.state,
    p_location_name: parsed.data.locationName,
    p_display_name: parsed.data.displayName,
  });
  if (error || !data) return { ok: false, error: "Die Firma konnte nicht angelegt werden. Bitte versuch es erneut." };

  (await cookies()).set(ACTIVE_ORG_COOKIE, data, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true, orgId: data };
}
