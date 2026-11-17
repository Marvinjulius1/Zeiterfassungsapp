import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTerminal, identify, issueTicket } from "@/features/terminal/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Person am Terminal erkennen (eigener QR, PIN oder RFID) → Name, Zustand, Ticket */
export async function POST(request: NextRequest) {
  const parsed = z
    .object({ method: z.enum(["personal_qr", "pin", "rfid"]), value: z.string().min(1).max(500) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ungültige Anfrage" }, { status: 400 });
  const admin = createAdminClient();
  const terminal = await getTerminal(admin);
  if (!terminal) return NextResponse.json({ ok: false, error: "Terminal nicht gekoppelt" }, { status: 401 });

  const res = await identify(admin, terminal, parsed.data.method, parsed.data.value);
  if (!res.ok) return NextResponse.json(res, { status: res.locked ? 429 : 404 });
  const ticket = await issueTicket({ m: res.person.membershipId, t: terminal.id, s: parsed.data.method });
  return NextResponse.json({ ok: true, person: res.person, ticket });
}
