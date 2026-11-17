import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTerminal, identify, stampViaTerminal } from "@/features/terminal/server";
import { createAdminClient } from "@/lib/supabase/admin";

const item = z.object({
  eventId: z.uuid(),
  method: z.enum(["personal_qr", "pin", "rfid"]),
  value: z.string().min(1).max(500),
  occurredAt: z.iso.datetime({ offset: true }),
});

/**
 * Offline gepufferte Terminal-Buchungen nachreichen. Die Identität wird zum
 * damaligen Zeitpunkt geprüft (eigener QR), gebucht wird automatisch
 * (Kommen/Gehen/Pausenende) mit der Gerätezeit – markiert als offline.
 */
export async function POST(request: NextRequest) {
  const parsed = z.object({ items: z.array(item).max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ungültige Anfrage" }, { status: 400 });
  const admin = createAdminClient();
  const terminal = await getTerminal(admin);
  if (!terminal) return NextResponse.json({ ok: false, error: "Terminal nicht gekoppelt" }, { status: 401 });

  const results: { eventId: string; ok: boolean; retry?: boolean; name?: string; error?: string }[] = [];
  for (const it of [...parsed.data.items].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    const who = await identify(admin, terminal, it.method, it.value, new Date(it.occurredAt).getTime());
    if (!who.ok) {
      // Gesperrt (zu viele Fehlversuche) → später erneut versuchen, echte Buchungen nie verwerfen
      results.push({ eventId: it.eventId, ok: false, retry: !!who.locked, error: who.error });
      continue;
    }
    const res = await stampViaTerminal(admin, {
      terminalId: terminal.id,
      membershipId: who.person.membershipId,
      source: it.method,
      kind: null,
      eventId: it.eventId,
      offline: true,
      occurredAt: it.occurredAt,
    });
    // Technischer Fehler → erneut versuchen; fachliche Ablehnung (z. B. > 72 h) ist endgültig
    const retry = !res.ok && !!res.retryable;
    results.push({ eventId: it.eventId, ok: res.ok, retry, name: who.person.firstName, error: res.ok ? undefined : res.error });
  }
  return NextResponse.json({ ok: true, results });
}
