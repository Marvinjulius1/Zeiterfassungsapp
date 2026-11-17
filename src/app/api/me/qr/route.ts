import { NextResponse } from "next/server";
import { makeCode, secondsLeft } from "@/features/terminal/crypto";
import { getViewer } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/** Aktueller persönlicher QR-Code (wechselt alle 30 s). Das Geheimnis verlässt nie den Server. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.active) return NextResponse.json({ ok: false }, { status: 401 });
  const { data } = await createAdminClient()
    .from("member_credentials")
    .select("personal_qr_secret")
    .eq("membership_id", viewer.active.id)
    .single();
  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  const now = Date.now();
  return NextResponse.json(
    { ok: true, code: await makeCode("P1", viewer.active.id, data.personal_qr_secret, now), secondsLeft: secondsLeft(now) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
