import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTerminal, readTicket, stampViaTerminal } from "@/features/terminal/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Stempeln am Terminal mit gültigem Ticket aus /identify */
export async function POST(request: NextRequest) {
  const parsed = z
    .object({ ticket: z.string().min(10).max(2000), kind: z.enum(["check_in", "break_start", "break_end", "check_out"]).nullable(), eventId: z.uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ungültige Anfrage" }, { status: 400 });
  const admin = createAdminClient();
  const terminal = await getTerminal(admin);
  if (!terminal) return NextResponse.json({ ok: false, error: "Terminal nicht gekoppelt" }, { status: 401 });
  const ticket = await readTicket(parsed.data.ticket);
  if (!ticket || ticket.t !== terminal.id) return NextResponse.json({ ok: false, error: "Zeit abgelaufen – bitte erneut anmelden." }, { status: 401 });

  const res = await stampViaTerminal(admin, {
    terminalId: terminal.id,
    membershipId: ticket.m,
    source: ticket.s,
    kind: parsed.data.kind,
    eventId: parsed.data.eventId,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 422 });
}
