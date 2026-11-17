import "server-only";
import { absenceEffect, computeBalance, holidayMap, weekdayOf, type BalanceDay, type State } from "@/compliance";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface BalanceResult {
  minutes: number;
  since: string | null;
  days: BalanceDay[];
}

/**
 * Stundenkonto bis einschließlich `to`. Startet am ersten erfassten Arbeitstag
 * („seit Einführung von Zeitgeist"), damit niemand rückwirkend ins Minus fällt.
 * Berücksichtigt Feiertage, Berufsschule, Urlaub/Krankheit (Soll erfüllt),
 * unbezahlte Abwesenheit (kein Soll), Überstundenabbau und manuelle Buchungen.
 */
export async function loadBalance(supabase: Client, membershipId: string, to: string): Promise<BalanceResult> {
  const [{ data: member }, { data: first }] = await Promise.all([
    supabase.from("memberships").select("locations(state), organizations(default_state)").eq("id", membershipId).single(),
    supabase.from("work_days").select("work_date").eq("membership_id", membershipId).order("work_date").limit(1).maybeSingle(),
  ]);
  if (!first || first.work_date > to) return { minutes: 0, since: null, days: [] };
  const from = first.work_date;

  const [contracts, days, absences, adjustments] = await Promise.all([
    supabase.from("employment_contracts").select("valid_from, valid_to, daily_targets, school_days").eq("membership_id", membershipId),
    supabase.from("work_days").select("work_date, valued_minutes, status").eq("membership_id", membershipId).gte("work_date", from).lte("work_date", to),
    supabase
      .from("absences")
      .select("start_date, end_date, half_day_start, half_day_end, absence_types(key)")
      .eq("membership_id", membershipId)
      .eq("status", "approved")
      .lte("start_date", to)
      .gte("end_date", from),
    supabase.from("time_account_adjustments").select("minutes, effective_date").eq("membership_id", membershipId).lte("effective_date", to),
  ]);

  const state = (member?.locations?.state ?? member?.organizations?.default_state ?? "NW") as State;
  const holidays = holidayMap(state, Number(from.slice(0, 4)), Number(to.slice(0, 4)));
  const targetOn = (d: string) => {
    if (holidays.has(d)) return 0;
    const c = contracts.data?.find((x) => x.valid_from <= d && (!x.valid_to || x.valid_to >= d));
    if (!c) return 0;
    const wd = weekdayOf(d);
    if (c.school_days.includes(wd)) return 0;
    return Number((c.daily_targets as Record<string, number>)[String(wd)] ?? 0);
  };
  const valued = new Map((days.data ?? []).filter((d) => d.status !== "open").map((d) => [d.work_date, d.valued_minutes]));
  const absenceOn = (d: string) => {
    const a = absences.data?.find((x) => x.start_date <= d && x.end_date >= d);
    if (!a) return null;
    const half = (d === a.start_date && a.half_day_start) || (d === a.end_date && a.half_day_end);
    return { effect: absenceEffect(a.absence_types?.key ?? ""), half };
  };
  const r = computeBalance({
    from,
    to,
    targetOn,
    valued,
    absenceOn,
    adjustments: (adjustments.data ?? []).reduce((s, a) => s + a.minutes, 0),
  });
  return { minutes: r.minutes, since: from, days: r.days };
}

