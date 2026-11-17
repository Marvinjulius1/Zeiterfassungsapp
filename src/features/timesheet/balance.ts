import "server-only";
import { absenceEffect, computeBalance, holidayMap, weekdayOf, type AbsenceEffect, type BalanceDay, type State } from "@/compliance";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface MemberCalendar {
  holidays: ReadonlyMap<string, string>;
  /** Soll-Minuten laut Vertrag (0 an Feiertagen, freien Tagen, Berufsschultagen) */
  targetOn: (date: string) => number;
  /** genehmigte Abwesenheit an einem Tag */
  absenceOn: (date: string) => { effect: AbsenceEffect; half: boolean; key: string; label: string } | null;
}

/** Kalender einer Person: Soll je Tag, Feiertage, genehmigte Abwesenheiten – gemeinsame Basis für Konto, Bericht, Export. */
export async function loadMemberCalendar(supabase: Client, membershipId: string, from: string, to: string): Promise<MemberCalendar> {
  const [{ data: member }, contracts, absences] = await Promise.all([
    supabase.from("memberships").select("locations(state), organizations(default_state)").eq("id", membershipId).single(),
    supabase.from("employment_contracts").select("valid_from, valid_to, daily_targets, school_days").eq("membership_id", membershipId),
    supabase
      .from("absences")
      .select("start_date, end_date, half_day_start, half_day_end, absence_types(key, label)")
      .eq("membership_id", membershipId)
      .eq("status", "approved")
      .lte("start_date", to)
      .gte("end_date", from),
  ]);
  const state = (member?.locations?.state ?? member?.organizations?.default_state ?? "NW") as State;
  const holidays = holidayMap(state, Number(from.slice(0, 4)), Number(to.slice(0, 4)));
  return {
    holidays,
    targetOn: (d) => {
      if (holidays.has(d)) return 0;
      const c = contracts.data?.find((x) => x.valid_from <= d && (!x.valid_to || x.valid_to >= d));
      if (!c) return 0;
      const wd = weekdayOf(d);
      if (c.school_days.includes(wd)) return 0;
      return Number((c.daily_targets as Record<string, number>)[String(wd)] ?? 0);
    },
    absenceOn: (d) => {
      const a = absences.data?.find((x) => x.start_date <= d && x.end_date >= d);
      if (!a) return null;
      const half = (d === a.start_date && a.half_day_start) || (d === a.end_date && a.half_day_end);
      const key = a.absence_types?.key ?? "";
      return { effect: absenceEffect(key), half, key, label: a.absence_types?.label ?? "Abwesend" };
    },
  };
}

const PAGE = 1000; // = max_rows der Datenbank-API

/** Alle Tageswerte im Zeitraum – seitenweise, damit auch nach Jahren nichts abgeschnitten wird. */
async function loadWorkDays(supabase: Client, membershipId: string, from: string, to: string) {
  const out: { work_date: string; valued_minutes: number; status: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("work_days")
      .select("work_date, valued_minutes, status")
      .eq("membership_id", membershipId)
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`Tageswerte konnten nicht geladen werden: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

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
  const { data: first } = await supabase.from("work_days").select("work_date").eq("membership_id", membershipId).order("work_date").limit(1).maybeSingle();
  if (!first || first.work_date > to) return { minutes: 0, since: null, days: [] };
  const from = first.work_date;

  const [cal, days, adjustments] = await Promise.all([
    loadMemberCalendar(supabase, membershipId, from, to),
    loadWorkDays(supabase, membershipId, from, to),
    supabase.from("time_account_adjustments").select("minutes, effective_date").eq("membership_id", membershipId).lte("effective_date", to),
  ]);
  const valued = new Map(days.filter((d) => d.status !== "open").map((d) => [d.work_date, d.valued_minutes]));
  const r = computeBalance({
    from,
    to,
    targetOn: cal.targetOn,
    valued,
    absenceOn: cal.absenceOn,
    adjustments: (adjustments.data ?? []).reduce((s, a) => s + a.minutes, 0),
  });
  return { minutes: r.minutes, since: from, days: r.days };
}
