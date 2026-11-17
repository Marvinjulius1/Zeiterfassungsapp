import "server-only";
import { createClient } from "@/lib/supabase/server";
import { berlinDateKey, isoWeekRange, isoWeekday } from "@/lib/time/berlin";
import { isMinorOn } from "@/lib/people";
import { resolveRules } from "@/compliance";
import { STALE_AFTER_HOURS, type DayEvent } from "./day-state";

export interface NextShift {
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  locationName: string | null;
  position: string | null;
}

export interface TodayData {
  workDate: string;
  /** Arbeitstag mit vergessenem Ausstempeln (offener Block > 16 h) */
  missingCheckOut: string | null;
  events: DayEvent[];
  targetMinutes: number;
  isMinor: boolean;
  /** Firmenregel: Einchecken per App nur am Arbeitsort */
  requireGeofence: boolean;
  /** Einwilligung zur Standortprüfung liegt vor */
  geoConsent: boolean;
  /** Netto-Minuten dieser Woche ohne den angezeigten Tag */
  weekMinutesBefore: number;
  nextShift: NextShift | null;
}

export async function getTodayData(membershipId: string): Promise<TodayData> {
  const supabase = await createClient();
  const today = berlinDateKey();

  // Läuft noch ein Block (z. B. Nachtschicht von gestern)? Dann gehört er zum Arbeitstag des Check-ins.
  const { data: last } = await supabase
    .from("time_events")
    .select("kind, work_date, occurred_at")
    .eq("membership_id", membershipId)
    .is("voided_at", null)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const stale = !!last && last.kind !== "check_out" && Date.now() - Date.parse(last.occurred_at) > STALE_AFTER_HOURS * 3600000;
  const workDate = last && last.kind !== "check_out" && !stale ? last.work_date : today;
  const week = isoWeekRange(workDate);

  const [events, member, contract, weekDays, shift] = await Promise.all([
    supabase
      .from("time_events")
      .select("id, kind, occurred_at")
      .eq("membership_id", membershipId)
      .eq("work_date", workDate)
      .is("voided_at", null)
      .order("occurred_at"),
    supabase.from("memberships").select("birth_date, org_id, location_id").eq("id", membershipId).single(),
    supabase
      .from("employment_contracts")
      .select("daily_targets")
      .eq("membership_id", membershipId)
      .lte("valid_from", workDate)
      .or(`valid_to.is.null,valid_to.gte.${workDate}`)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("work_days")
      .select("net_minutes")
      .eq("membership_id", membershipId)
      .gte("work_date", week.from)
      .lte("work_date", week.to)
      .neq("work_date", workDate),
    supabase
      .from("shifts")
      .select("starts_at, ends_at, break_minutes, position, locations(name)")
      .eq("membership_id", membershipId)
      .eq("status", "published")
      .gt("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
  ]);

  const targets = (contract.data?.daily_targets ?? {}) as Record<string, number>;
  const m = member.data;
  const [{ data: ruleSets }, { data: consent }] = await Promise.all([
    supabase.from("rule_sets").select("scope, scope_id, settings").eq("org_id", m?.org_id ?? ""),
    supabase.from("geo_consents").select("id").eq("membership_id", membershipId).is("revoked_at", null).limit(1),
  ]);
  const layer = (scope: string, id: string | null | undefined) => ruleSets?.find((r) => r.scope === scope && r.scope_id === id)?.settings ?? {};
  const rules = resolveRules(layer("org", m?.org_id), layer("location", m?.location_id), layer("membership", membershipId));

  return {
    workDate,
    missingCheckOut: stale ? last.work_date : null,
    events: (events.data ?? []).map((e) => ({ id: e.id, kind: e.kind, occurredAt: e.occurred_at })),
    targetMinutes: Number(targets[String(isoWeekday(workDate))] ?? 0),
    isMinor: isMinorOn(member.data?.birth_date, workDate),
    requireGeofence: rules.methods.requireGeofence,
    geoConsent: (consent?.length ?? 0) > 0,
    weekMinutesBefore: (weekDays.data ?? []).reduce((s, d) => s + d.net_minutes, 0),
    nextShift: shift.data
      ? {
          startsAt: shift.data.starts_at,
          endsAt: shift.data.ends_at,
          breakMinutes: shift.data.break_minutes,
          locationName: shift.data.locations?.name ?? null,
          position: shift.data.position,
        }
      : null,
  };
}
