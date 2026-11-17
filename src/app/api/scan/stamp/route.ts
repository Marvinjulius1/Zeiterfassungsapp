import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readTicket, stampViaTerminal } from "@/features/terminal/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Handy hat den Terminal-QR gescannt → mit Ticket stempeln (Person = angemeldeter Nutzer) */
export async function POST(request: NextRequest) {
  const parsed = z
    .object({ ticket: z.string().min(10).max(2000), kind: z.enum(["check_in", "break_start", "break_end", "check_out"]).nullable(), eventId: z.uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ungültige Anfrage" }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Bitte melde dich an." }, { status: 401 });
  const ticket = await readTicket(parsed.data.ticket);
  if (!ticket || ticket.s !== "terminal_qr") return NextResponse.json({ ok: false, error: "Zeit abgelaufen – bitte den Code erneut scannen." }, { status: 401 });
  // Ticket gehört zu genau dieser Person
  const { data: own } = await supabase.from("memberships").select("id").eq("id", ticket.m).eq("user_id", auth.user.id).maybeSingle();
  if (!own) return NextResponse.json({ ok: false, error: "Keine Berechtigung" }, { status: 403 });

  const res = await stampViaTerminal(createAdminClient(), {
    terminalId: ticket.t,
    membershipId: ticket.m,
    source: "terminal_qr",
    kind: parsed.data.kind,
    eventId: parsed.data.eventId,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 422 });
}
