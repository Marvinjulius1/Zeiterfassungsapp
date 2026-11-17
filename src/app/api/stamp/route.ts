import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dateKeyOf, insideGeofence, type Violation } from "@/compliance";
import { checkStamp } from "@/features/compliance/check-stamp";
import { evaluateMemberRange } from "@/features/compliance/evaluate-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  membershipId: z.uuid(),
  eventId: z.uuid(),
  kind: z.enum(["check_in", "break_start", "break_end", "check_out"]),
  offline: z.boolean().optional().default(false),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  /** Nur beim Einchecken und nur mit Einwilligung (Geofence) */
  geo: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000).optional() }).optional(),
});

export type StampResponse =
  | { ok: true; event: { id: string; kind: string; occurredAt: string; workDate: string }; warnings: Pick<Violation, "code" | "message" | "severity">[] }
  | { ok: false; error: string; blocked?: boolean; needsLocation?: boolean };

/**
 * Stempeln aus der App mit Regelprüfung.
 * 1. Live-Buchungen: canStamp() – warnt oder blockiert je nach Firmenregel (inkl. Geofence)
 * 2. Buchung über public.stamp() mit der Session des Nutzers (RLS + Zustandsautomat)
 * 3. Tag neu bewerten und Verstöße speichern
 * Offline nachgereichte Buchungen werden nie blockiert – die Arbeit hat stattgefunden.
 */
export async function POST(request: NextRequest): Promise<NextResponse<StampResponse>> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ungültige Anfrage" }, { status: 400 });
  const body = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Bitte melde dich erneut an." }, { status: 401 });

  const { data: own } = await supabase
    .from("memberships")
    .select("id, location_id")
    .eq("id", body.membershipId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!own) return NextResponse.json({ ok: false, error: "Keine Berechtigung" }, { status: 403 });

  const admin = createAdminClient();
  const now = new Date();
  let warnings: Violation[] = [];

  if (!body.offline) {
    let inside: boolean | null = null;
    if (body.geo && own.location_id) {
      const { data: loc } = await admin
        .from("locations")
        .select("geofence_lat, geofence_lng, geofence_radius_m")
        .eq("id", own.location_id)
        .single();
      inside =
        loc?.geofence_lat != null && loc.geofence_lng != null && loc.geofence_radius_m != null
          ? insideGeofence(body.geo, { lat: loc.geofence_lat, lng: loc.geofence_lng, radiusM: loc.geofence_radius_m })
          : true; // kein Geofence hinterlegt → nicht prüfbar, nicht blockieren
    }
    const decision = await checkStamp(admin, body.membershipId, body.kind, "app", now, inside);
    if (!decision.allowed) {
      const needsLocation = decision.ctx.rules.methods.requireGeofence && inside === null;
      return NextResponse.json({ ok: false, error: decision.blockReason ?? "Nicht erlaubt", blocked: true, needsLocation }, { status: 422 });
    }
    warnings = decision.warnings;
  }

  const { data, error } = await supabase.rpc("stamp", {
    p_membership_id: body.membershipId,
    p_event_id: body.eventId,
    p_kind: body.kind,
    p_source: "app",
    p_offline: body.offline,
    p_occurred_at: body.occurredAt,
    p_geo_lat: body.geo?.lat,
    p_geo_lng: body.geo?.lng,
    p_geo_accuracy: body.geo?.accuracy,
  });
  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Stempeln fehlgeschlagen" }, { status: 422 });
  }

  try {
    const to = dateKeyOf(now) > data.work_date ? dateKeyOf(now) : data.work_date;
    const result = await evaluateMemberRange(admin, body.membershipId, data.work_date, to, now);
    if (body.kind === "check_out") {
      warnings = [...warnings, ...(result.violations.get(data.work_date) ?? []).filter((v) => v.severity === "violation")];
    }
  } catch (e) {
    console.error("Compliance-Bewertung fehlgeschlagen", e);
  }

  return NextResponse.json({
    ok: true,
    event: { id: data.id, kind: data.kind, occurredAt: data.occurred_at, workDate: data.work_date },
    warnings: warnings.map(({ code, message, severity }) => ({ code, message, severity })),
  });
}
