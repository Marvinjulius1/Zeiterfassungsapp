import { countableBreakMinutes, requiredBreakMinutes } from "../breaks";
import { overlapMinutes } from "../intervals";
import { addDaysKey, dateKeyOf, localTime, weekdayOf } from "../time";
import type { Interval, Violation } from "../types";
import type { RuleSettings } from "./schema";

// ---------------------------------------------------------------------------
// Rundung – betrifft NUR die bewertete Zeit, nie die Rohzeit
// ---------------------------------------------------------------------------
function roundTo(d: Date, unitMin: number, how: "floor" | "ceil" | "nearest"): Date {
  const unit = unitMin * 60000;
  const t = d.getTime();
  const r = how === "floor" ? Math.floor(t / unit) * unit : how === "ceil" ? Math.ceil(t / unit) * unit : Math.round(t / unit) * unit;
  return new Date(r);
}

/**
 * Rundet Beginn und Ende jedes Arbeitsblocks.
 * - employee_favor: Beginn ab-, Ende aufrunden (nie zulasten des Mitarbeiters)
 * - commercial: kaufmännisch auf die nächste Einheit
 */
export function roundWork(work: readonly Interval[], rounding: RuleSettings["rounding"]): Interval[] {
  if (rounding.mode === "none") return work.map((i) => ({ ...i }));
  return work.map((i) => ({
    start: roundTo(i.start, rounding.unitMin, rounding.mode === "employee_favor" ? "floor" : "nearest"),
    end: roundTo(i.end, rounding.unitMin, rounding.mode === "employee_favor" ? "ceil" : "nearest"),
  }));
}

// ---------------------------------------------------------------------------
// Automatischer Pausenabzug
// ---------------------------------------------------------------------------
export function autoBreakDeduction(
  netMinutes: number,
  breaks: readonly Interval[],
  isMinor: boolean,
  enabled: boolean,
): { minutes: number; violation?: Violation } {
  if (!enabled) return { minutes: 0 };
  const counted = countableBreakMinutes(breaks.map((b) => (b.end.getTime() - b.start.getTime()) / 1000));
  const missing = requiredBreakMinutes(netMinutes, isMinor) - counted;
  if (missing <= 0) return { minutes: 0 };
  return {
    minutes: missing,
    violation: {
      code: "RULE_AUTO_BREAK_DEDUCTED",
      severity: "info",
      message: `${missing} Min. Pause wurden automatisch abgezogen, weil keine ausreichende Pause gebucht war.`,
      details: { minutes: missing },
    },
  };
}

// ---------------------------------------------------------------------------
// Zuschlagsrelevante Minuten (Nacht, Sonntag, Feiertag)
// ---------------------------------------------------------------------------
export interface SurchargeMinutes {
  nightMin: number;
  sundayMin: number;
  holidayMin: number;
}

export function surchargeMinutes(
  net: readonly Interval[],
  workDate: string,
  surcharges: RuleSettings["surcharges"],
  holidays: ReadonlyMap<string, string>,
): SurchargeMinutes {
  if (net.length === 0) return { nightMin: 0, sundayMin: 0, holidayMin: 0 };
  // alle Kalendertage, die berührt werden (Nachtschichten!)
  const first = dateKeyOf(net[0].start);
  const last = dateKeyOf(net[net.length - 1].end);
  const days: string[] = [];
  for (let k = addDaysKey(first < workDate ? first : workDate, -1); k <= last; k = addDaysKey(k, 1)) days.push(k);

  let nightMin = 0;
  let sundayMin = 0;
  let holidayMin = 0;
  for (const d of days) {
    // Nachtfenster beginnt an Tag d um nightFromHour und endet am Folgetag um nightToHour
    const nightStart = localTime(d, surcharges.nightFromHour % 24);
    const nightStartAdj = surcharges.nightFromHour === 24 ? localTime(addDaysKey(d, 1), 0) : nightStart;
    nightMin += overlapMinutes(net, { start: nightStartAdj, end: localTime(addDaysKey(d, 1), surcharges.nightToHour) });

    const dayWindow = { start: localTime(d, 0), end: localTime(addDaysKey(d, 1), 0) };
    if (weekdayOf(d) === 7) sundayMin += overlapMinutes(net, dayWindow);
    if (holidays.has(d)) holidayMin += overlapMinutes(net, dayWindow);
  }
  return { nightMin, sundayMin, holidayMin };
}

// ---------------------------------------------------------------------------
// Schichtfenster & Pünktlichkeit
// ---------------------------------------------------------------------------
export interface ShiftWindow {
  startsAt: Date;
  endsAt: Date;
}

export function shiftWindowViolations(
  firstIn: Date | null,
  lastOut: Date | null,
  shift: ShiftWindow | null,
  rules: RuleSettings,
): Violation[] {
  if (!shift || rules.trustBasedHours) return [];
  const out: Violation[] = [];
  if (firstIn) {
    const earlyBy = Math.floor((shift.startsAt.getTime() - firstIn.getTime()) / 60000);
    if (rules.checkIn.earliestEnforcement !== "off" && earlyBy > rules.checkIn.earliestBeforeShiftMin) {
      out.push({
        code: "RULE_EARLY_CHECK_IN",
        severity: "info",
        message: `${earlyBy} Min. vor Schichtbeginn eingecheckt (erlaubt: ${rules.checkIn.earliestBeforeShiftMin} Min.).`,
        details: { minutes: earlyBy },
      });
    }
    const lateBy = -earlyBy;
    if (lateBy > rules.checkIn.lateToleranceMin) {
      out.push({
        code: "RULE_LATE_ARRIVAL",
        severity: "info",
        message: `${lateBy} Min. nach Schichtbeginn eingecheckt.`,
        details: { minutes: lateBy, notifyLead: rules.checkIn.notifyLeadOnLate },
      });
    }
  }
  if (lastOut && rules.checkOut.latestEnforcement !== "off") {
    const overBy = Math.floor((lastOut.getTime() - shift.endsAt.getTime()) / 60000);
    if (overBy > rules.checkOut.latestAfterShiftMin) {
      out.push({
        code: "RULE_LATE_CHECK_OUT",
        severity: "warning",
        message: `${overBy} Min. nach Schichtende ausgecheckt.`,
        details: { minutes: overBy },
      });
    }
  }
  return out;
}

export function overtimeViolation(netMinutes: number, targetMinutes: number, rules: RuleSettings): Violation | null {
  const over = netMinutes - targetMinutes;
  if (rules.overtime.approvalAboveMin <= 0 || over <= rules.overtime.approvalAboveMin) return null;
  return {
    code: "RULE_OVERTIME_APPROVAL",
    severity: "info",
    message: `${over} Min. Mehrarbeit – Freigabe erforderlich.`,
    details: { minutes: over },
  };
}

