"use server";

import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !data) return { ok: false, error: error?.message ?? "Einladung konnte nicht angenommen werden." };
  (await cookies()).set(ACTIVE_ORG_COOKIE, data, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 31536000 });
  return { ok: true };
}
