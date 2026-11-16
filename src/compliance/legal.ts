/**
 * Gesetzliche Prüfungen auf Tagesebene.
 *
 * ArbZG   §§ 3, 4, 5, 9–11
 * JArbSchG §§ 8, 9, 11, 13, 14, 16, 17
 * MuSchG  §§ 4, 5, 6
 */
import { MIN_BREAK_BLOCK_MIN, breakRulesFor, countableBreakMinutes, requiredBreakMinutes } from "./breaks";
import { overlapMinutes } from "./intervals";
import { addDaysKey, localTime, weekdayOf } from "./time";
import type { Interval, Violation, WorkerProfile } from "./types";

const H = 60;

// ---------------------------------------------------------------------------
// Tägliche Höchstarbeitszeit
// ---------------------------------------------------------------------------
export function dailyMaxViolations(netMin: number, p: WorkerProfile): Violation[] {
  const out: Violation[] = [];
  if (p.isMinor) {
    if (netMin > 8 * H)
      out.push({
        code: "JARBSCHG_DAILY_MAX",
        severity: "violation",
        law: "§ 8 JArbSchG",
        message: `${fmt(netMin)} gearbeitet – Jugendliche dürfen höchstens 8 Stunden täglich arbeiten.`,
        details: { netMin },
      });
    return out;
  }
  if (p.maternityProtection && netMin > 8.5 * H) {
    out.push({
      code: "MUSCHG_DAILY_MAX",
      severity: "violation",
      law: "§ 4 MuSchG",
      message: `${fmt(netMin)} gearbeitet – im Mutterschutz sind höchstens 8,5 Stunden täglich erlaubt.`,
      details: { netMin },
    });
  }
  if (netMin > 10 * H) {
    out.push({
      code: "ARBZG_DAILY_OVER_10",
      severity: "violation",
      law: "§ 3 ArbZG",
      message: `${fmt(netMin)} gearbeitet – mehr als 10 Stunden sind nicht erlaubt.`,
      details: { netMin },
    });
  } else if (netMin > 8 * H) {
    out.push({
      code: "ARBZG_DAILY_OVER_8",
      // erlaubt, wenn im 6-Monats-Schnitt ausgeglichen → eigener Verstoß ARBZG_AVERAGE_EXCEEDED
      severity: "info",
      law: "§ 3 ArbZG",
      message: `${fmt(netMin)} gearbeitet – über 8 Stunden müssen innerhalb von 6 Monaten ausgeglichen werden.`,
      details: { netMin },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ruhepausen
// ---------------------------------------------------------------------------
/** Längste Arbeitsstrecke ohne anrechenbare Pause (Pausen < 15 Min. unterbrechen nicht). */
export function longestContinuousMinutes(work: readonly Interval[], breaks: readonly Interval[]): number {
  const cuts = breaks.filter((b) => b.end.getTime() - b.start.getTime() >= MIN_BREAK_BLOCK_MIN * 60000);
  let longest = 0;
  for (const w of work) {
    let segStart = w.start.getTime();
    let pausedInSeg = 0;
    const inside = [...breaks].filter((b) => b.start >= w.start && b.end <= w.end).sort((a, b) => a.start.getTime() - b.start.getTime());
    for (const b of inside) {
      if (cuts.includes(b)) {
        longest = Math.max(longest, (b.start.getTime() - segStart - pausedInSeg) / 60000);
        segStart = b.end.getTime();
        pausedInSeg = 0;
      } else {
        pausedInSeg += b.end.getTime() - b.start.getTime(); // kurze Pause zählt nicht als Arbeit
      }
    }
    longest = Math.max(longest, (w.end.getTime() - segStart - pausedInSeg) / 60000);
  }
  return Math.floor(longest);
}

export function breakViolations(netMin: number, work: readonly Interval[], breaks: readonly Interval[], p: WorkerProfile): Violation[] {
  const out: Violation[] = [];
  const counted = countableBreakMinutes(breaks.map((b) => (b.end.getTime() - b.start.getTime()) / 1000));
  const required = requiredBreakMinutes(netMin, p.isMinor);
  if (counted < required) {
    out.push({
      code: p.isMinor ? "JARBSCHG_BREAK" : "ARBZG_BREAK_TOO_SHORT",
      severity: "violation",
      law: p.isMinor ? "§ 11 JArbSchG" : "§ 4 ArbZG",
      message: `Pause zu kurz: ${counted} von ${required} Min. (nur Pausen ab 15 Min. zählen).`,
      details: { counted, required },
    });
  }
  const limit = breakRulesFor(p.isMinor).maxContinuousMin;
  const longest = longestContinuousMinutes(work, breaks);
  if (longest > limit) {
    out.push({
      code: "ARBZG_CONTINUOUS_WORK",
      severity: "violation",
      law: p.isMinor ? "§ 11 JArbSchG" : "§ 4 ArbZG",
      message: `${fmt(longest)} am Stück ohne Pause – erlaubt sind höchstens ${fmt(limit)}.`,
      details: { longest, limit },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ruhezeit zwischen zwei Arbeitstagen
// ---------------------------------------------------------------------------
export function restPeriodHours(p: WorkerProfile): number {
  return p.isMinor ? 12 : 11;
}

export function restPeriodViolation(previousEnd: Date | null, nextStart: Date | null, p: WorkerProfile): Violation | null {
  if (!previousEnd || !nextStart) return null;
  const gapMin = Math.floor((nextStart.getTime() - previousEnd.getTime()) / 60000);
  const need = restPeriodHours(p) * H;
  if (gapMin >= need || gapMin < 0) return null;
  return {
    code: p.isMinor ? "JARBSCHG_REST_PERIOD" : "ARBZG_REST_PERIOD",
    severity: "violation",
    law: p.isMinor ? "§ 13 JArbSchG" : "§ 5 ArbZG",
    message: `Nur ${fmt(gapMin)} Ruhezeit seit dem letzten Arbeitsende – mindestens ${restPeriodHours(p)} Stunden sind vorgeschrieben.`,
    details: { gapMin, need },
  };
}

// ---------------------------------------------------------------------------
// Sonn- und Feiertage, Wochenende, Nachtruhe, Berufsschule
// ---------------------------------------------------------------------------
export function calendarViolations(
  date: string,
  net: readonly Interval[],
  p: WorkerProfile,
  holidays: ReadonlyMap<string, string>,
): Violation[] {
  const out: Violation[] = [];
  if (net.length === 0) return out;
  const wd = weekdayOf(date);
  const holiday = holidays.get(date);

  if (wd === 7) {
    out.push({
      code: "ARBZG_SUNDAY_WORK",
      severity: "info",
      law: "§ 11 ArbZG",
      message: "Sonntagsarbeit – ein Ersatzruhetag ist innerhalb von 2 Wochen fällig.",
    });
  }
  if (holiday) {
    out.push({
      code: "ARBZG_HOLIDAY_WORK",
      severity: "info",
      law: "§ 11 ArbZG",
      message: `Arbeit am Feiertag (${holiday}) – ${wd <= 6 ? "Ersatzruhetag innerhalb von 8 Wochen fällig." : "zuschlagsrelevant."}`,
      details: { holiday },
    });
  }
  if (p.maternityProtection && (wd === 7 || holiday)) {
    out.push({
      code: "MUSCHG_SUNDAY_HOLIDAY",
      severity: "warning",
      law: "§ 6 MuSchG",
      message: "Sonn-/Feiertagsarbeit im Mutterschutz nur mit ausdrücklicher Bereitschaft der Mitarbeiterin.",
    });
  }

  // Nachtzeit 20–6 Uhr am Arbeitstag und am Folgetag
  const nightOverlap =
    overlapMinutes(net, { start: localTime(addDaysKey(date, -1), 20), end: localTime(date, 6) }) +
    overlapMinutes(net, { start: localTime(date, 20), end: localTime(addDaysKey(date, 1), 6) });

  if (p.isMinor) {
    if (wd >= 6 || holiday) {
      out.push({
        code: "JARBSCHG_WEEKEND",
        severity: "warning",
        law: "§§ 16–18 JArbSchG",
        message: "Jugendliche dürfen am Wochenende und an Feiertagen nur in Ausnahmebranchen arbeiten.",
      });
    }
    if (nightOverlap > 0) {
      out.push({
        code: "JARBSCHG_NIGHT_REST",
        severity: "violation",
        law: "§ 14 JArbSchG",
        message: `${nightOverlap} Min. zwischen 20 und 6 Uhr – für Jugendliche gilt Nachtruhe (Ausnahmen je Branche).`,
        details: { minutes: nightOverlap },
      });
    }
    if (p.schoolDays.includes(wd)) {
      out.push({
        code: "JARBSCHG_SCHOOL_DAY",
        severity: "warning",
        law: "§ 9 JArbSchG",
        message: "Arbeit an einem Berufsschultag – nach mehr als 5 Unterrichtsstunden ist keine Beschäftigung mehr erlaubt.",
      });
    }
  } else if (p.maternityProtection && nightOverlap > 0) {
    out.push({
      code: "MUSCHG_NIGHT",
      severity: "warning",
      law: "§ 5 MuSchG",
      message: "Arbeit zwischen 20 und 6 Uhr im Mutterschutz – bis 22 Uhr nur mit behördlicher Genehmigung.",
      details: { minutes: nightOverlap },
    });
  }
  return out;
}

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")} h`;
}
