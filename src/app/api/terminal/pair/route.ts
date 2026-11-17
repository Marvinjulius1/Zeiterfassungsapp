import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { TERMINAL_COOKIE, pairTerminal } from "@/features/terminal/server";

/** Tablet koppeln: 6-stelliger Code aus der Verwaltung → Geräte-Cookie + QR-Schlüssel */
export async function POST(request: NextRequest) {
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Bitte den 6-stelligen Code eingeben." }, { status: 400 });
  const res = await pairTerminal(parsed.data.code);
  if (!res) return NextResponse.json({ ok: false, error: "Code ungültig oder abgelaufen." }, { status: 404 });
  const response = NextResponse.json({ ok: true, terminalId: res.terminalId, signingSecret: res.signingSecret });
  response.cookies.set(TERMINAL_COOKIE, `${res.terminalId}.${res.deviceToken}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return response;
}
