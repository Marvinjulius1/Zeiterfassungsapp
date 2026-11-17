import { addDaysKey } from "./time";

export interface AbsenceSpan {
  start: string; // yyyy-MM-dd
  end: string;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
}

/**
 * Wie viele Arbeitstage kostet eine Abwesenheit? Nur Tage mit Soll zählen
 * (Vertrags-Arbeitstage, keine Feiertage); halbe Tage am Anfang/Ende zählen 0,5.
 */
export function absenceWorkdays(span: AbsenceSpan, isWorkday: (date: string) => boolean): number {
  if (span.end < span.start) return 0;
  let days = 0;
  for (let d = span.start; d <= span.end; d = addDaysKey(d, 1)) {
    if (!isWorkday(d)) continue;
    const half = (d === span.start && span.halfDayStart) || (d === span.end && span.halfDayEnd);
    days += half ? 0.5 : 1;
  }
  return days;
}

/** Überschneiden sich zwei Zeiträume (inklusive)? */
export function spansOverlap(a: AbsenceSpan, b: AbsenceSpan): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export interface VacationBalance {
  entitlement: number;
  carriedOver: number;
  taken: number; // genehmigt, Vergangenheit
  planned: number; // genehmigt, Zukunft
  pending: number; // beantragt
  remaining: number; // nach genehmigten
  remainingAfterPending: number;
}

export function vacationBalance(
  entitlement: number,
  carriedOver: number,
  absences: readonly (AbsenceSpan & { status: "approved" | "pending"; days: number })[],
  today: string,
): VacationBalance {
  let taken = 0;
  let planned = 0;
  let pending = 0;
  for (const a of absences) {
    if (a.status === "pending") pending += a.days;
    else if (a.start <= today) taken += a.days;
    else planned += a.days;
  }
  const total = entitlement + carriedOver;
  return {
    entitlement,
    carriedOver,
    taken,
    planned,
    pending,
    remaining: total - taken - planned,
    remainingAfterPending: total - taken - planned - pending,
  };
}

/**
 * Wirkung einer Abwesenheit auf das Stundenkonto:
 * - credit:    Soll gilt als erfüllt (Urlaub, Krankheit, Sonderurlaub, Berufsschule)
 * - no_target: an diesem Tag gibt es kein Soll (unbezahlt, Kind krank)
 * - none:      Soll bleibt bestehen – z. B. Überstundenabbau zieht vom Konto ab
 */
export type AbsenceEffect = "credit" | "no_target" | "none";

export function absenceEffect(key: string): AbsenceEffect {
  if (["vacation", "sick", "special", "school"].includes(key)) return "credit";
  if (["unpaid", "child_sick"].includes(key)) return "no_target";
  return "none";
}

export interface BalanceInput {
  from: string;
  to: string; // inklusive
  targetOn: (date: string) => number;
  /** bewertete Minuten je Tag (Rundung/Auto-Pause bereits angewandt) */
  valued: ReadonlyMap<string, number>;
  absenceOn: (date: string) => { effect: AbsenceEffect; half: boolean } | null;
  adjustments?: number;
}

export interface BalanceDay {
  date: string;
  target: number;
  actual: number;
  credit: number;
  diff: number;
}

/** Stundenkonto = Σ (Ist + Gutschrift − Soll) + manuelle Buchungen */
export function computeBalance(input: BalanceInput): { minutes: number; days: BalanceDay[] } {
  const days: BalanceDay[] = [];
  let sum = input.adjustments ?? 0;
  for (let d = input.from; d <= input.to; d = addDaysKey(d, 1)) {
    let target = input.targetOn(d);
    const actual = input.valued.get(d) ?? 0;
    let credit = 0;
    const abs = input.absenceOn(d);
    if (abs && target > 0) {
      const share = abs.half ? 0.5 : 1;
      if (abs.effect === "credit") credit = Math.round(target * share);
      else if (abs.effect === "no_target") target = Math.round(target * (1 - share));
    }
    const diff = actual + credit - target;
    if (target || actual || credit) days.push({ date: d, target, actual, credit, diff });
    sum += diff;
  }
  return { minutes: sum, days };
}
