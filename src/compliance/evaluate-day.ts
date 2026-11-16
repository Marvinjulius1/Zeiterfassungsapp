import { toIntervals, totalMinutes } from "./intervals";
import { breakViolations, calendarViolations, dailyMaxViolations, restPeriodViolation } from "./legal";
import { autoBreakDeduction, overtimeViolation, roundWork, shiftWindowViolations, surchargeMinutes, type ShiftWindow, type SurchargeMinutes } from "./rules/company";
import type { RuleSettings } from "./rules/schema";
import { subtract } from "./intervals";
import type { TimeEvent, Violation, WorkerProfile } from "./types";

export interface DayContext {
  date: string;
  events: readonly TimeEvent[];
  now: Date;
  profile: WorkerProfile;
  rules: RuleSettings;
  holidays: ReadonlyMap<string, string>;
  targetMinutes: number;
  shift?: ShiftWindow | null;
  /** Ende des vorherigen Arbeitstags (für die Ruhezeit) */
  previousEnd?: Date | null;
}

export interface DayEvaluation {
  grossMin: number;
  breakMin: number;
  netMin: number;
  /** nach Rundung und automatischem Pausenabzug */
  valuedMin: number;
  autoBreakMin: number;
  surcharges: SurchargeMinutes;
  firstIn: Date | null;
  lastOut: Date | null;
  open: boolean;
  violations: Violation[];
}

/**
 * Bewertet einen Arbeitstag vollständig: Werte für Lohn & Stundenkonto
 * sowie alle Tagesverstöße (Gesetz + Firmenregeln).
 */
export function evaluateDay(ctx: DayContext): DayEvaluation {
  const iv = toIntervals(ctx.events, ctx.now);
  const grossMin = totalMinutes(iv.work);
  const breakMin = totalMinutes(iv.breaks);
  const netMin = totalMinutes(iv.net);

  const roundedNet = totalMinutes(subtract(roundWork(iv.work, ctx.rules.rounding), iv.breaks));
  const auto = iv.open
    ? { minutes: 0 }
    : autoBreakDeduction(netMin, iv.breaks, ctx.profile.isMinor, ctx.rules.autoBreak.enabled);
  const valuedMin = Math.max(0, roundedNet - auto.minutes);

  const firstIn = iv.work[0]?.start ?? null;
  const lastOut = iv.open ? null : (iv.work[iv.work.length - 1]?.end ?? null);

  const violations: Violation[] = [];
  if (netMin > 0) {
    violations.push(...dailyMaxViolations(netMin, ctx.profile));
    // Pausen erst bewerten, wenn der Tag abgeschlossen ist (live gibt es Hinweise in der App)
    if (!iv.open) violations.push(...breakViolations(netMin, iv.work, iv.breaks, ctx.profile));
    const rest = restPeriodViolation(ctx.previousEnd ?? null, firstIn, ctx.profile);
    if (rest) violations.push(rest);
    violations.push(...calendarViolations(ctx.date, iv.net, ctx.profile, ctx.holidays));
    violations.push(...shiftWindowViolations(firstIn, lastOut, ctx.shift ?? null, ctx.rules));
    const ot = iv.open ? null : overtimeViolation(netMin, ctx.targetMinutes, ctx.rules);
    if (ot) violations.push(ot);
  }
  if (auto.violation) violations.push(auto.violation);
  if (ctx.events.some((e) => e.source === "system_auto")) {
    violations.push({
      code: "RULE_AUTO_CHECKOUT",
      severity: "warning",
      message: "Automatisch ausgecheckt – bitte das tatsächliche Arbeitsende prüfen und ggf. korrigieren.",
    });
  }

  return {
    grossMin,
    breakMin,
    netMin,
    valuedMin,
    autoBreakMin: auto.minutes,
    surcharges: surchargeMinutes(iv.net, ctx.date, ctx.rules.surcharges, ctx.holidays),
    firstIn,
    lastOut,
    open: iv.open,
    violations,
  };
}
