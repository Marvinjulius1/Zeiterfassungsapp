/**
 * Prüfungen über mehrere Tage.
 *
 * § 3 ArbZG      Ausgleich auf durchschnittlich 8 h je Werktag in 6 Kalendermonaten
 * § 11 ArbZG     Ersatzruhetag (Sonntag: 2 Wochen, Feiertag: 8 Wochen), 15 freie Sonntage/Jahr
 * §§ 8, 15 JArbSchG  40 h/Woche, 5-Tage-Woche
 * § 4 MuSchG     90 h in der Doppelwoche
 * § 17 MiLoG     Aufzeichnung spätestens 7 Tage nach dem Arbeitstag
 */
import { addDaysKey, daysBetweenKeys, mondayOfKey, weekdayOf } from "./time";
import type { Violation, WorkerProfile } from "./types";

export interface DayRecord {
  date: string;
  netMin: number;
  targetMin: number;
  hasEvents: boolean;
  hasAbsence: boolean;
  /** Zeitpunkt, an dem die erste Buchung des Tages im System einging */
  firstReceivedAt?: Date | null;
}

export type PeriodResult = Map<string, Violation[]>;

function push(map: PeriodResult, date: string, v: Violation) {
  const list = map.get(date) ?? [];
  list.push(v);
  map.set(date, list);
}

const fmtH = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")} h`;

/** Werktage = Montag bis Samstag ohne Feiertage */
export function isWerktag(date: string, holidays: ReadonlyMap<string, string>): boolean {
  return weekdayOf(date) <= 6 && !holidays.has(date);
}

// ---------------------------------------------------------------------------
// Jugendliche: 40-Stunden- und 5-Tage-Woche
// ---------------------------------------------------------------------------
export function minorWeekViolations(days: readonly DayRecord[], p: WorkerProfile, out: PeriodResult = new Map()): PeriodResult {
  if (!p.isMinor) return out;
  const weeks = new Map<string, DayRecord[]>();
  for (const d of days) {
    const k = mondayOfKey(d.date);
    weeks.set(k, [...(weeks.get(k) ?? []), d]);
  }
  for (const list of weeks.values()) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let sum = 0;
    let workDays = 0;
    let weeklyFlagged = false;
    let fiveFlagged = false;
    for (const d of sorted) {
      const school = p.schoolDays.includes(weekdayOf(d.date));
      // Berufsschultag wird mit 8 h angerechnet (§ 9 Abs. 2 JArbSchG)
      sum += school ? Math.max(480, d.netMin) : d.netMin;
      if (d.netMin > 0 || school) workDays++;
      if (!weeklyFlagged && sum > 40 * 60) {
        weeklyFlagged = true;
        push(out, d.date, {
          code: "JARBSCHG_WEEKLY_MAX",
          severity: "violation",
          law: "§ 8 JArbSchG",
          message: `${fmtH(sum)} diese Woche (inkl. Berufsschule) – Jugendliche dürfen höchstens 40 Stunden arbeiten.`,
          details: { weekMin: sum },
        });
      }
      if (!fiveFlagged && workDays > 5) {
        fiveFlagged = true;
        push(out, d.date, {
          code: "JARBSCHG_FIVE_DAY_WEEK",
          severity: "violation",
          law: "§ 15 JArbSchG",
          message: "Mehr als 5 Arbeitstage in dieser Woche – für Jugendliche gilt die 5-Tage-Woche.",
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mutterschutz: 90 Stunden in der Doppelwoche
// ---------------------------------------------------------------------------
export function maternityDoubleWeekViolations(days: readonly DayRecord[], p: WorkerProfile, out: PeriodResult = new Map()): PeriodResult {
  if (!p.maternityProtection || p.isMinor) return out;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const mondays = [...new Set(days.map((d) => mondayOfKey(d.date)))].sort();
  for (const mon of mondays) {
    // Doppelwoche = Vorwoche + diese Woche
    let sum = 0;
    let lastDate = "";
    for (let i = -7; i < 7; i++) {
      const k = addDaysKey(mon, i);
      const d = byDate.get(k);
      if (d) {
        sum += d.netMin;
        if (d.netMin > 0 && i >= 0) lastDate = k;
      }
    }
    if (sum > 90 * 60 && lastDate) {
      push(out, lastDate, {
        code: "MUSCHG_DOUBLE_WEEK_MAX",
        severity: "violation",
        law: "§ 4 MuSchG",
        message: `${fmtH(sum)} in der Doppelwoche – im Mutterschutz sind höchstens 90 Stunden erlaubt.`,
        details: { doubleWeekMin: sum },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6-Monats-Ausgleich (§ 3 Satz 2 ArbZG)
// ---------------------------------------------------------------------------
export interface AverageResult {
  from: string;
  to: string;
  werktage: number;
  totalMin: number;
  averageMin: number;
  withinLimit: boolean;
  /** Minuten, die noch ausgeglichen werden müssen, um auf ≤ 8 h zu kommen */
  excessMin: number;
}

/** Durchschnitt je Werktag über die letzten 6 Kalendermonate bis `to` (inklusive). */
export function sixMonthAverage(days: readonly DayRecord[], to: string, holidays: ReadonlyMap<string, string>): AverageResult {
  const [y, m, d] = to.split("-").map(Number);
  const fromDate = new Date(Date.UTC(y, m - 1 - 6, d + 1, 12));
  const from = fromDate.toISOString().slice(0, 10);
  let werktage = 0;
  for (let k = from; k <= to; k = addDaysKey(k, 1)) if (isWerktag(k, holidays)) werktage++;
  const totalMin = days.filter((x) => x.date >= from && x.date <= to).reduce((s, x) => s + x.netMin, 0);
  const averageMin = werktage === 0 ? 0 : totalMin / werktage;
  return {
    from,
    to,
    werktage,
    totalMin,
    averageMin: Math.round(averageMin),
    withinLimit: averageMin <= 480,
    excessMin: Math.max(0, totalMin - werktage * 480),
  };
}

export function averageViolations(
  days: readonly DayRecord[],
  evaluateDates: readonly string[],
  holidays: ReadonlyMap<string, string>,
  p: WorkerProfile,
  out: PeriodResult = new Map(),
): PeriodResult {
  if (p.isMinor) return out; // für Jugendliche gilt ohnehin die harte 8-h-Grenze
  for (const date of evaluateDates) {
    const day = days.find((d) => d.date === date);
    if (!day || day.netMin <= 480) continue; // nur relevant an Tagen mit Mehrarbeit
    const avg = sixMonthAverage(days, date, holidays);
    if (!avg.withinLimit) {
      push(out, date, {
        code: "ARBZG_AVERAGE_EXCEEDED",
        severity: "violation",
        law: "§ 3 ArbZG",
        message: `Durchschnitt der letzten 6 Monate liegt bei ${fmtH(avg.averageMin)} je Werktag – über 8 Stunden. ${fmtH(avg.excessMin)} müssen ausgeglichen werden.`,
        details: { ...avg },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ersatzruhetag & freie Sonntage (§ 11 ArbZG)
// ---------------------------------------------------------------------------
export function replacementRestViolations(
  days: readonly DayRecord[],
  today: string,
  holidays: ReadonlyMap<string, string>,
  out: PeriodResult = new Map(),
): PeriodResult {
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const d of days) {
    if (d.netMin <= 0) continue;
    const isSunday = weekdayOf(d.date) === 7;
    const isWeekdayHoliday = holidays.has(d.date) && weekdayOf(d.date) <= 6;
    if (!isSunday && !isWeekdayHoliday) continue;
    const windowDays = isSunday ? 14 : 56;
    const deadline = addDaysKey(d.date, windowDays);
    if (deadline > today) continue; // Frist läuft noch
    let found = false;
    for (let i = 1; i <= windowDays && !found; i++) {
      const k = addDaysKey(d.date, i);
      if (!isWerktag(k, holidays)) continue;
      const rec = byDate.get(k);
      if (!rec || rec.netMin === 0) found = true; // arbeitsfreier Werktag
    }
    if (!found) {
      push(out, d.date, {
        code: "ARBZG_REPLACEMENT_REST_MISSING",
        severity: "violation",
        law: "§ 11 Abs. 3 ArbZG",
        message: `Kein Ersatzruhetag innerhalb von ${isSunday ? "2 Wochen" : "8 Wochen"} nach der ${isSunday ? "Sonntags" : "Feiertags"}arbeit.`,
        details: { deadline },
      });
    }
  }
  return out;
}

export function sundaysOffViolations(days: readonly DayRecord[], out: PeriodResult = new Map()): PeriodResult {
  const byYear = new Map<string, string[]>();
  for (const d of days) {
    if (d.netMin > 0 && weekdayOf(d.date) === 7) {
      const y = d.date.slice(0, 4);
      byYear.set(y, [...(byYear.get(y) ?? []), d.date]);
    }
  }
  for (const [year, sundays] of byYear) {
    const totalSundays = countSundays(Number(year));
    const allowed = totalSundays - 15;
    const sorted = sundays.sort();
    if (sorted.length > allowed) {
      push(out, sorted[allowed], {
        code: "ARBZG_SUNDAYS_OFF",
        severity: "violation",
        law: "§ 11 Abs. 1 ArbZG",
        message: `Mehr als ${allowed} Sonntage gearbeitet – mindestens 15 Sonntage im Jahr müssen frei bleiben.`,
        details: { worked: sorted.length, allowed },
      });
    }
  }
  return out;
}

function countSundays(year: number): number {
  let n = 0;
  for (let k = `${year}-01-01`; k <= `${year}-12-31`; k = addDaysKey(k, 1)) if (weekdayOf(k) === 7) n++;
  return n;
}

// ---------------------------------------------------------------------------
// MiLoG § 17: Aufzeichnungsfrist
// ---------------------------------------------------------------------------
export function milogApplies(p: WorkerProfile, allEmployees: boolean): boolean {
  return allEmployees || p.contractType === "minijob";
}

export function milogViolations(
  days: readonly DayRecord[],
  today: string,
  p: WorkerProfile,
  allEmployees: boolean,
  out: PeriodResult = new Map(),
): PeriodResult {
  if (!milogApplies(p, allEmployees)) return out;
  for (const d of days) {
    const age = daysBetweenKeys(d.date, today);
    if (d.targetMin > 0 && !d.hasEvents && !d.hasAbsence && age > 7) {
      push(out, d.date, {
        code: "MILOG_RECORD_MISSING",
        severity: "warning",
        law: "§ 17 MiLoG",
        message: "Für diesen Arbeitstag fehlt die Aufzeichnung – sie war bis 7 Tage danach fällig.",
      });
    }
    if (d.hasEvents && d.firstReceivedAt) {
      const lateBy = daysBetweenKeys(d.date, d.firstReceivedAt.toISOString().slice(0, 10));
      if (lateBy > 7) {
        push(out, d.date, {
          code: "MILOG_RECORD_LATE",
          severity: "info",
          law: "§ 17 MiLoG",
          message: `Zeiten wurden erst ${lateBy} Tage nach dem Arbeitstag erfasst (Frist: 7 Tage).`,
          details: { lateBy },
        });
      }
    }
  }
  return out;
}
