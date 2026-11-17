/**
 * Konfliktprüfung für geplante Schichten – dieselben Maßstäbe wie bei der
 * Bewertung echter Arbeitszeit (ArbZG, JArbSchG, MuSchG) plus Abwesenheiten.
 */
import { requiredBreakMinutes } from "./breaks";
import { calendarViolations, restPeriodHours } from "./legal";
import { dateKeyOf, mondayOfKey } from "./time";
import type { Violation, WorkerProfile } from "./types";

export interface PlannedShift {
  id: string;
  start: Date;
  end: Date;
  breakMinutes: number;
}

export interface PlanAbsence {
  start: string;
  end: string;
  label: string;
  status: "approved" | "pending";
}

const fmt = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;

export function netShiftMinutes(s: PlannedShift): number {
  return Math.max(0, Math.round((s.end.getTime() - s.start.getTime()) / 60000) - s.breakMinutes);
}

/** Prüft alle Schichten EINER Person; Ergebnis je Schicht-ID. */
export function shiftConflicts(
  shifts: readonly PlannedShift[],
  profile: WorkerProfile,
  absences: readonly PlanAbsence[],
  holidays: ReadonlyMap<string, string>,
): Map<string, Violation[]> {
  const out = new Map<string, Violation[]>();
  const sorted = [...shifts].sort((a, b) => a.start.getTime() - b.start.getTime());
  const add = (id: string, v: Violation) => out.set(id, [...(out.get(id) ?? []), v]);

  sorted.forEach((s, i) => {
    const date = dateKeyOf(s.start);
    const net = netShiftMinutes(s);

    // Abwesenheit am selben Tag
    const abs = absences.find((a) => a.start <= date && a.end >= date);
    if (abs) {
      add(s.id, {
        code: "PLAN_ABSENCE_CONFLICT",
        severity: abs.status === "approved" ? "violation" : "warning",
        message: `${abs.label} ${abs.status === "approved" ? "genehmigt" : "beantragt"} – Person ist an diesem Tag nicht da.`,
      });
    }

    // Doppelt eingeplant
    const prev = sorted[i - 1];
    if (prev && prev.end > s.start) {
      add(s.id, { code: "PLAN_SHIFT_OVERLAP", severity: "violation", message: "Überschneidet sich mit einer anderen Schicht." });
    }

    // Ruhezeit zur vorherigen Schicht
    if (prev && prev.end <= s.start) {
      const gap = Math.round((s.start.getTime() - prev.end.getTime()) / 60000);
      const need = restPeriodHours(profile) * 60;
      if (gap < need) {
        add(s.id, {
          code: profile.isMinor ? "JARBSCHG_REST_PERIOD" : "ARBZG_REST_PERIOD",
          severity: "violation",
          law: profile.isMinor ? "§ 13 JArbSchG" : "§ 5 ArbZG",
          message: `Nur ${fmt(gap)} Ruhezeit seit der letzten Schicht (mind. ${restPeriodHours(profile)} h).`,
        });
      }
    }

    // Tageshöchstgrenzen
    const limit = profile.isMinor ? 480 : profile.maternityProtection ? 510 : 600;
    if (net > limit) {
      add(s.id, {
        code: profile.isMinor ? "JARBSCHG_DAILY_MAX" : profile.maternityProtection ? "MUSCHG_DAILY_MAX" : "ARBZG_DAILY_OVER_10",
        severity: "violation",
        law: profile.isMinor ? "§ 8 JArbSchG" : profile.maternityProtection ? "§ 4 MuSchG" : "§ 3 ArbZG",
        message: `${fmt(net)} geplant – erlaubt sind höchstens ${fmt(limit)}.`,
      });
    }

    // Geplante Pause
    const needBreak = requiredBreakMinutes(net, profile.isMinor);
    if (s.breakMinutes < needBreak) {
      add(s.id, {
        code: profile.isMinor ? "JARBSCHG_BREAK" : "ARBZG_BREAK_TOO_SHORT",
        severity: "warning",
        law: profile.isMinor ? "§ 11 JArbSchG" : "§ 4 ArbZG",
        message: `Geplante Pause ${s.breakMinutes} Min. – nötig sind ${needBreak} Min.`,
      });
    }

    // Kalender: Sonn-/Feiertag, Nachtruhe Jugendliche, Wochenende, Berufsschule, Mutterschutz
    for (const v of calendarViolations(date, [{ start: s.start, end: s.end }], profile, holidays)) {
      if (v.code === "ARBZG_SUNDAY_WORK" || v.code === "ARBZG_HOLIDAY_WORK") add(s.id, { ...v, severity: "info" });
      else add(s.id, v);
    }
  });

  // Woche: Jugendliche 40 h / 5 Tage, Erwachsene 48 h (6 Werktage × 8 h)
  const weeks = new Map<string, PlannedShift[]>();
  for (const s of sorted) {
    const k = mondayOfKey(dateKeyOf(s.start));
    weeks.set(k, [...(weeks.get(k) ?? []), s]);
  }
  for (const list of weeks.values()) {
    let sum = 0;
    const days = new Set<string>();
    for (const s of list) {
      sum += netShiftMinutes(s);
      days.add(dateKeyOf(s.start));
      const schoolDays = profile.isMinor ? profile.schoolDays.length * 480 : 0;
      if (profile.isMinor && sum + schoolDays > 40 * 60) {
        add(s.id, { code: "JARBSCHG_WEEKLY_MAX", severity: "violation", law: "§ 8 JArbSchG", message: `Woche: ${fmt(sum + schoolDays)} inkl. Berufsschule – max. 40 h.` });
        break;
      }
      if (profile.isMinor && days.size + profile.schoolDays.length > 5) {
        add(s.id, { code: "JARBSCHG_FIVE_DAY_WEEK", severity: "violation", law: "§ 15 JArbSchG", message: "Mehr als 5 Tage in dieser Woche (inkl. Berufsschule)." });
        break;
      }
      if (!profile.isMinor && sum > 48 * 60) {
        add(s.id, { code: "ARBZG_AVERAGE_EXCEEDED", severity: "warning", law: "§ 3 ArbZG", message: `Woche: ${fmt(sum)} geplant – mehr als 48 h nur mit Ausgleich.` });
        break;
      }
    }
  }
  return out;
}
