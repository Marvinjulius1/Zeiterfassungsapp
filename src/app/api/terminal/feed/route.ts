import { NextResponse, type NextRequest } from "next/server";
import { getTerminal, touchTerminal } from "@/features/terminal/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Neue Handy-Scans an diesem Terminal (für die Begrüßung auf dem Tablet).
 * Das Terminal fragt alle paar Sekunden nach – robust, auch ohne Realtime-Login.
 */
export async function GET(request: NextRequest) {
  const admin = createAdminClient();
  const terminal = await getTerminal(admin);
  if (!terminal) return NextResponse.json({ ok: false }, { status: 401 });
  const sinceParam = request.nextUrl.searchParams.get("since");
  const since = sinceParam && !Number.isNaN(Date.parse(sinceParam)) ? sinceParam : new Date(Date.now() - 10_000).toISOString();

  const [{ data }] = await Promise.all([
    admin
      .from("time_events")
      .select("id, kind, occurred_at, received_at, memberships(display_name)")
      .eq("terminal_id", terminal.id)
      .eq("source", "terminal_qr")
      .gt("received_at", since)
      .order("received_at")
      .limit(10),
    touchTerminal(admin, terminal.id),
  ]);
  return NextResponse.json({
    ok: true,
    serverNow: Date.now(),
    events: (data ?? []).map((e) => ({
      id: e.id,
      kind: e.kind,
      occurredAt: e.occurred_at,
      receivedAt: e.received_at,
      firstName: (e.memberships?.display_name ?? "").split(" ")[0],
    })),
  });
}
