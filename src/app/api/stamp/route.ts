import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canStamp, dateKeyOf, toIntervals, totalMinutes, type Violation } from "@/compliance";
import { evaluateMemberRange, loadMemberContext, profileOn } from "@/features/compliance/evaluate-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  membershipId: z.uuid(),
  eventId: z.uuid(),
  kind: z.enum(["check_in", "break_start", "break_end", "check_out"]),
  offline: z.boolean().optional().default(false),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
});

export type StampResponse =
  | { ok: true; event: { id: string; kind: string; occurredAt: string; workDate: string }; warnings: Pick<Violation, "code" | "message" | "severity">[] }
  | { ok: false; error: string; blocked?: boolean };

/**
 * Stempeln mit Regelprüfung.
 * 1. Live-Buchungen: canStamp() – warnt oder blockiert je nach Firmenregel
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

  // Gehört die Mitgliedschaft dem Nutzer? (RLS-geschützte Abfrage)
  const { data: own } = await supabase
    .from("memberships")
    .select("id")
    .eq("id", body.membershipId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!own) return NextResponse.json({ ok: false, error: "Keine Berechtigung" }, { status: 403 });

  const admin = createAdminClient();
  const now = new Date();
  let warnings: Violation[] = [];

  if (!body.offline) {
    const ctx = await loadMemberContext(admin, body.membershipId);
    const today = dateKeyOf(now);
    const [lastOut, todayEvents, shift] = await Promise.all([
      admin
        .from("time_events")
        .select("occurred_at")
        .eq("membership_id", body.membershipId)
        .eq("kind", "check_out")
        .lt("work_date", today) // Ruhezeit zählt ab dem vorherigen Arbeitstag, nicht ab einer Unterbrechung heute
        .is("voided_at", null)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("time_events")
        .select("kind, occurred_at")
        .eq("membership_id", body.membershipId)
        .eq("work_date", today)
        .is("voided_at", null),
      admin
        .from("shifts")
        .select("starts_at, ends_at")
        .eq("membership_id", body.membershipId)
        .eq("status", "published")
        .gte("ends_at", now.toISOString())
        .order("starts_at")
        .limit(1)
        .maybeSingle(),
    ]);
    const net = totalMinutes(
      toIntervals((todayEvents.data ?? []).map((e) => ({ kind: e.kind, at: new Date(e.occurred_at) })), now).net,
    );
    const shiftToday = shift.data && dateKeyOf(new Date(shift.data.starts_at)) === today
      ? { startsAt: new Date(shift.data.starts_at), endsAt: new Date(shift.data.ends_at) }
      : null;

    const decision = canStamp({
      kind: body.kind,
      method: "app",
      now,
      profile: profileOn(ctx, today),
      rules: ctx.rules,
      lastEnd: lastOut.data ? new Date(lastOut.data.occurred_at) : null,
      netTodayMin: net,
      shift: shiftToday,
      insideGeofence: null, // Geofence-Prüfung folgt mit Standort-Einwilligung (Phase 6)
    });
    if (!decision.allowed) {
      return NextResponse.json({ ok: false, error: decision.blockReason ?? "Nicht erlaubt", blocked: true }, { status: 422 });
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
  });
  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Stempeln fehlgeschlagen" }, { status: 422 });
  }

  // Tag bewerten (bei Offline-Nachträgen bis heute, wegen Ruhezeit-Folgen)
  try {
    const to = dateKeyOf(now) > data.work_date ? dateKeyOf(now) : data.work_date;
    const result = await evaluateMemberRange(admin, body.membershipId, data.work_date, to, now);
    if (body.kind === "check_out") {
      const dayViolations = (result.violations.get(data.work_date) ?? []).filter((v) => v.severity === "violation");
      warnings = [...warnings, ...dayViolations];
    }
  } catch (e) {
    // Die Buchung ist gespeichert – Bewertung holt der nächtliche Job nach.
    console.error("Compliance-Bewertung fehlgeschlagen", e);
  }

  return NextResponse.json({
    ok: true,
    event: { id: data.id, kind: data.kind, occurredAt: data.occurred_at, workDate: data.work_date },
    warnings: warnings.map(({ code, message, severity }) => ({ code, message, severity })),
  });
}
