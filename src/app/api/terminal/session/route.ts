import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { TERMINAL_COOKIE, getTerminal, touchTerminal, verifyKioskPin } from "@/features/terminal/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Status + Herzschlag des Terminals (inkl. Serverzeit für die Uhr-Synchronisierung) */
export async function GET() {
  const admin = createAdminClient();
  const terminal = await getTerminal(admin);
  if (!terminal) return NextResponse.json({ ok: false }, { status: 401 });
  await touchTerminal(admin, terminal.id);
  return NextResponse.json({ ok: true, terminal, serverNow: Date.now() });
}

/** Kiosk-Menü: { action: "unlock" | "unpair", pin } – Kiosk-PIN wird serverseitig geprüft */
export async function POST(request: NextRequest) {
  const parsed = z.object({ action: z.enum(["unlock", "unpair"]), pin: z.string().regex(/^\d{4,8}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ungültige PIN" }, { status: 400 });
  const admin = createAdminClient();
  const terminal = await getTerminal(admin);
  if (!terminal) return NextResponse.json({ ok: false, error: "Nicht gekoppelt" }, { status: 401 });
  if (!(await verifyKioskPin(admin, terminal.id, parsed.data.pin))) {
    await admin.from("terminal_auth_failures").insert({ terminal_id: terminal.id, method: "kiosk" });
    return NextResponse.json({ ok: false, error: "Falsche Kiosk-PIN" }, { status: 403 });
  }
  if (parsed.data.action === "unlock") return NextResponse.json({ ok: true });
  await admin.from("terminal_secrets").update({ device_token_hash: null }).eq("terminal_id", terminal.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(TERMINAL_COOKIE);
  return res;
}
