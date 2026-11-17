import "server-only";
import { absenceWorkdays, holidayMap, vacationBalance, weekdayOf, type State, type VacationBalance } from "@/compliance";
import { createClient } from "@/lib/supabase/server";
import { berlinDateKey } from "@/lib/time/berlin";

export interface MyAbsence {
  id: string;
  type: string;
  label: string;
  start: string;
  end: string;
  halfStart: boolean;
  halfEnd: boolean;
  status: string;
  days: number;
  note: string | null;
  hasAttachment: boolean;
  reviewNote: string | null;
}

export interface AbsenceContext {
  orgId: string;
  membershipId: string;
  state: State;
  /** Soll-Minuten je ISO-Wochentag */
  dailyTargets: Record<string, number>;
  schoolDays: number[];
  holidays: Record<string, string>;
  balance: VacationBalance;
  absences: MyAbsence[];
  year: number;
}

export async function getMyAbsences(membershipId: string): Promise<AbsenceContext> {
  const supabase = await createClient();
  const today = berlinDateKey();
  const year = Number(today.slice(0, 4));
  const [{ data: m }, { data: contract }, { data: ent }, { data: rows }] = await Promise.all([
    supabase.from("memberships").select("org_id, locations(state), organizations(default_state)").eq("id", membershipId).single(),
    supabase
      .from("employment_contracts")
      .select("daily_targets, school_days")
      .eq("membership_id", membershipId)
      .lte("valid_from", today)
      .or(`valid_to.is.null,valid_to.gte.${today}`)
      .maybeSingle(),
    supabase.from("vacation_entitlements").select("days, carried_over").eq("membership_id", membershipId).eq("year", year).maybeSingle(),
    supabase
      .from("absences")
      .select("id, start_date, end_date, half_day_start, half_day_end, status, note, attachment_path, review_note, absence_types(key, label)")
      .eq("membership_id", membershipId)
      .order("start_date", { ascending: false })
      .limit(60),
  ]);

  const state = (m?.locations?.state ?? m?.organizations?.default_state ?? "NW") as State;
  const hol = holidayMap(state, year - 1, year + 1);
  const targets = (contract?.daily_targets ?? {}) as Record<string, number>;
  const school = contract?.school_days ?? [];
  const isWorkday = (d: string) => !hol.has(d) && Number(targets[String(weekdayOf(d))] ?? 0) > 0 && !school.includes(weekdayOf(d));

  const absences: MyAbsence[] = (rows ?? []).map((a) => ({
    id: a.id,
    type: a.absence_types?.key ?? "other",
    label: a.absence_types?.label ?? "Abwesenheit",
    start: a.start_date,
    end: a.end_date,
    halfStart: a.half_day_start,
    halfEnd: a.half_day_end,
    status: a.status,
    days: absenceWorkdays({ start: a.start_date, end: a.end_date, halfDayStart: a.half_day_start, halfDayEnd: a.half_day_end }, isWorkday),
    note: a.note,
    hasAttachment: !!a.attachment_path,
    reviewNote: a.review_note,
  }));

  const vacationThisYear = absences.filter(
    (a) => a.type === "vacation" && (a.status === "approved" || a.status === "pending") && a.start.slice(0, 4) === String(year),
  ) as (MyAbsence & { status: "approved" | "pending" })[];

  return {
    orgId: m?.org_id ?? "",
    membershipId,
    state,
    dailyTargets: targets,
    schoolDays: school,
    holidays: Object.fromEntries(hol),
    balance: vacationBalance(Number(ent?.days ?? 0), Number(ent?.carried_over ?? 0), vacationThisYear, today),
    absences,
    year,
  };
}
