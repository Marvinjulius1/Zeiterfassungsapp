"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { dispatchPendingPush, pushConfigured } from "@/lib/push/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const subSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Push-Abo dieses Geräts speichern */
export async function savePushSubscription(input: unknown): Promise<Result> {
  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ungültiges Push-Abo" };
  const supabase = await createClient();
  const ua = (await headers()).get("user-agent");
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_user_agent: ua ?? undefined,
  });
  if (error) return { ok: false, error: "Speichern fehlgeschlagen" };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

export async function markNotificationsRead(ids?: string[]): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: ids });
  return error ? { ok: false, error: "Fehlgeschlagen" } : { ok: true };
}

/** Test-Nachricht an sich selbst – prüft Abo und Zustellung */
export async function sendTestPush(): Promise<Result<{ sent: number }>> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Bitte melde dich an." };
  if (!pushConfigured()) return { ok: false, error: "Push ist auf dem Server nicht eingerichtet (VAPID-Schlüssel fehlen)." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .insert({ user_id: auth.user.id, kind: "test", title: "Push funktioniert ✓", body: "So sehen Benachrichtigungen von Zeitgeist aus." });
  if (error) return { ok: false, error: "Fehlgeschlagen" };
  const res = await dispatchPendingPush(admin);
  return { ok: true, data: { sent: res.sent } };
}
