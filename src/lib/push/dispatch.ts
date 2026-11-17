import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { linkFor } from "@/features/notifications/links";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub!, priv!);
  return configured;
}

export const pushConfigured = () => configure();

/**
 * Verschickt alle noch nicht gepushten Benachrichtigungen der letzten Stunde.
 * Idempotent: `pushed_at` wird vor dem Senden gesetzt (Claim), parallele Aufrufe senden nichts doppelt.
 * Abgelaufene Abos (404/410) werden gelöscht.
 */
export async function dispatchPendingPush(admin: Admin = createAdminClient()): Promise<{ sent: number; skipped: number }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: claimed } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .is("pushed_at", null)
    .gte("created_at", since)
    .select("id, user_id, kind, title, body, payload");
  if (!claimed?.length || !configure()) return { sent: 0, skipped: claimed?.length ?? 0 };

  const userIds = [...new Set(claimed.map((n) => n.user_id))];
  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    claimed.flatMap((n) =>
      (subs ?? [])
        .filter((s) => s.user_id === n.user_id)
        .map(async (s) => {
          try {
            await sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: n.title, body: n.body ?? "", url: linkFor(n.kind, n.payload), tag: n.id }),
              { TTL: 60 * 60 * 24, urgency: "normal" },
            );
            sent++;
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) dead.push(s.id);
            else console.error("Push fehlgeschlagen", code ?? e);
          }
        }),
    ),
  );
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  return { sent, skipped: 0 };
}
