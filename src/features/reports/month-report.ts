import "server-only";
import { addDaysKey, computeBalance, weekdayOf } from "@/compliance";
import { loadBalance, loadMemberCalendar } from "@/features/timesheet/balance";
import type { createClient } from "@/lib/supabase/server";
import { monthRange } from "@/lib/time/berlin";

type Client = Awaited<ReturnType<typeof createClient>>;

export interface ReportDay {
  date: string;
  weekday: number;
  firstIn: string | null;
  lastOut: string | null;
  breakMinutes: number;
  netMinutes: number;
  valuedMinutes: number;
  targetMinutes: number;
  creditMinutes: number;
  diffMinutes: number;
  note: string; // Feiertag, Abwesenheit, „Ausstempeln fehlt"
  night: number;
  sunday: number;
  holiday: number;
}

export interface MonthTotals {
  valued: number;
  net: number;
  target: number;
  credit: number;
  diff: number;
  balanceEnd: number;
  vacationMinutes: number;
  sickMinutes: number;
  vacationDays: number;
  sickDays: number;
  night: number;
  sunday: number;
  holiday: number;
  incompleteDays: number;
}

export interface MonthReport {
  month: string;
  membershipId: string;
  name: string;
  employeeNo: string | null;
  orgName: string;
  locationName: string | null;
  weeklyMinutes: number | null;
  days: ReportDay[];
  totals: MonthTotals;
  closing: { confirmedAt: string | null; lockedAt: string | null } | null;
}

const surcharge = (s: unknown, k: string) => Number((s as Record<string, number> | null)?.[k] ?? 0);

export async function getMonthReport(supabase: Client, membershipId: string, month: string): Promise<MonthReport | null> {
  const r = monthRange(month);
  const [{ data: m }, cal, { data: days }, balance, { data: closing }, { data: contract }] = await Promise.all([
    supabase.from("memberships").select("display_name, employee_no, organizations(name), locations(name)").eq("id", membershipId).maybeSingle(),
    loadMemberCalendar(supabase, membershipId, r.from, r.to),
    supabase
      .from("work_days")
      .select("work_date, first_in, last_out, break_minutes, net_minutes, valued_minutes, surcharges, status")
      .eq("membership_id", membershipId)
      .gte("work_date", r.from)
      .lte("work_date", r.to),
    loadBalance(supabase, membershipId, r.to),
    supabase.from("month_closings").select("employee_confirmed_at, locked_at").eq("membership_id", membershipId).eq("month", r.from).maybeSingle(),
    supabase.from("employment_contracts").select("weekly_minutes").eq("membership_id", membershipId).lte("valid_from", r.to).order("valid_from", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!m) return null;

  const byDate = new Map((days ?? []).map((d) => [d.work_date, d]));
  const valued = new Map((days ?? []).filter((d) => d.status !== "open").map((d) => [d.work_date, d.valued_minutes]));
  // Wie beim Stundenkonto: Soll zählt erst ab dem ersten erfassten Arbeitstag („seit Einführung von Zeitgeist")
  const start = balance.since && balance.since > r.from ? balance.since : r.from;
  const monthBalance = balance.since
    ? computeBalance({ from: start, to: r.to, targetOn: cal.targetOn, valued, absenceOn: cal.absenceOn })
    : { days: [] as ReturnType<typeof computeBalance>["days"] };
  const balByDate = new Map(monthBalance.days.map((d) => [d.date, d]));

  const out: ReportDay[] = [];
  const t: MonthTotals = {
    valued: 0, net: 0, target: 0, credit: 0, diff: 0, balanceEnd: balance.minutes,
    vacationMinutes: 0, sickMinutes: 0, vacationDays: 0, sickDays: 0, night: 0, sunday: 0, holiday: 0, incompleteDays: 0,
  };
  for (let d = r.from; d <= r.to; d = addDaysKey(d, 1)) {
    const w = byDate.get(d);
    const b = balByDate.get(d);
    const abs = cal.absenceOn(d);
    const notes = [cal.holidays.get(d), abs?.label, w?.status === "incomplete" ? "Ausstempeln fehlt" : null].filter(Boolean);
    const row: ReportDay = {
      date: d,
      weekday: weekdayOf(d),
      firstIn: w?.first_in ?? null,
      lastOut: w?.last_out ?? null,
      breakMinutes: w?.break_minutes ?? 0,
      netMinutes: w?.net_minutes ?? 0,
      valuedMinutes: b?.actual ?? 0,
      targetMinutes: b?.target ?? 0,
      creditMinutes: b?.credit ?? 0,
      diffMinutes: b?.diff ?? 0,
      note: notes.join(" · "),
      night: surcharge(w?.surcharges, "nightMin"),
      sunday: surcharge(w?.surcharges, "sundayMin"),
      holiday: surcharge(w?.surcharges, "holidayMin"),
    };
    out.push(row);
    t.valued += row.valuedMinutes;
    t.net += row.netMinutes;
    t.target += row.targetMinutes;
    t.credit += row.creditMinutes;
    t.diff += row.diffMinutes;
    t.night += row.night;
    t.sunday += row.sunday;
    t.holiday += row.holiday;
    if (w?.status === "incomplete") t.incompleteDays++;
    if (abs && row.creditMinutes > 0) {
      const share = abs.half ? 0.5 : 1;
      if (abs.key === "vacation") {
        t.vacationMinutes += row.creditMinutes;
        t.vacationDays += share;
      } else if (abs.key === "sick") {
        t.sickMinutes += row.creditMinutes;
        t.sickDays += share;
      }
    }
  }

  return {
    month: r.from,
    membershipId,
    name: m.display_name,
    employeeNo: m.employee_no,
    orgName: m.organizations?.name ?? "",
    locationName: m.locations?.name ?? null,
    weeklyMinutes: contract?.weekly_minutes ?? null,
    days: out,
    totals: t,
    closing: closing ? { confirmedAt: closing.employee_confirmed_at, lockedAt: closing.locked_at } : null,
  };
}

/** Kompakter Snapshot für den Monatsabschluss (unveränderlich gespeichert) */
export function snapshotOf(r: MonthReport) {
  const { valued, target, credit, diff, balanceEnd, vacationDays, sickDays, night, sunday, holiday, incompleteDays } = r.totals;
  return { valued, target, credit, diff, balanceEnd, vacationDays, sickDays, night, sunday, holiday, incompleteDays, createdAt: new Date().toISOString() };
}
