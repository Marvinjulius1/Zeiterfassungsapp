import { restPeriodHours } from "./legal";
import type { Enforcement, RuleSettings, StampMethod } from "./rules/schema";
import type { ShiftWindow } from "./rules/company";
import { dateKeyOf, localTime } from "./time";
import type { EventKind, Violation, WorkerProfile } from "./types";

export interface StampContext {
  kind: EventKind;
  method: StampMethod;
  now: Date;
  profile: WorkerProfile;
  rules: RuleSettings;
  /** Ende des letzten Arbeitsblocks (für Ruhezeit) */
  lastEnd: Date | null;
  /** bereits gearbeitete Netto-Minuten am heutigen Arbeitstag */
  netTodayMin: number;
  shift?: ShiftWindow | null;
  /** innerhalb des Geofence? null = nicht geprüft/keine Einwilligung */
  insideGeofence?: boolean | null;
}

export interface StampDecision {
  allowed: boolean;
  blockReason?: string;
  warnings: Violation[];
}

/**
 * Darf jetzt gestempelt werden? Blockiert wird nur, wo die Firma es einstellt.
 * Pause, Pausenende und Auschecken werden NIE blockiert – niemand soll am
 * Aufhören gehindert werden.
 */
export function canStamp(ctx: StampContext): StampDecision {
  const warnings: Violation[] = [];
  let blockReason: string | undefined;
  const apply = (enf: Enforcement, v: Violation) => {
    if (enf === "off") return;
    if (enf === "block" && !blockReason) blockReason = v.message;
    else warnings.push(v);
  };

  if (!ctx.rules.methods.allowed.includes(ctx.method)) {
    return { allowed: false, blockReason: "Dieser Erfassungsweg ist an deinem Standort nicht freigegeben.", warnings };
  }

  if (ctx.kind !== "check_in") return { allowed: true, warnings };

  if (ctx.rules.methods.requireGeofence && ctx.method === "app" && ctx.insideGeofence !== true) {
    return {
      allowed: false,
      blockReason:
        ctx.insideGeofence === false
          ? "Du bist nicht am Arbeitsort. Einchecken ist hier nur vor Ort möglich."
          : "Für das Einchecken per App wird dein Standort benötigt.",
      warnings,
    };
  }

  // Ruhezeit
  if (ctx.lastEnd) {
    const hours = restPeriodHours(ctx.profile);
    const gapMin = Math.floor((ctx.now.getTime() - ctx.lastEnd.getTime()) / 60000);
    if (gapMin < hours * 60) {
      const missing = hours * 60 - gapMin;
      const enf: Enforcement = ctx.profile.isMinor && ctx.rules.enforcement.restPeriod === "warn" ? "block" : ctx.rules.enforcement.restPeriod;
      apply(enf, {
        code: ctx.profile.isMinor ? "JARBSCHG_REST_PERIOD" : "ARBZG_REST_PERIOD",
        severity: "violation",
        law: ctx.profile.isMinor ? "§ 13 JArbSchG" : "§ 5 ArbZG",
        message: `Deine Ruhezeit von ${hours} Stunden endet erst in ${Math.floor(missing / 60)}:${String(missing % 60).padStart(2, "0")} h.`,
        details: { gapMin, missingMin: missing },
      });
    }
  }

  // Tageshöchstgrenze bereits erreicht (z. B. zweiter Block am Tag)
  const dailyLimit = ctx.profile.isMinor ? 480 : ctx.profile.maternityProtection ? 510 : 600;
  if (ctx.netTodayMin >= dailyLimit) {
    apply(ctx.rules.enforcement.dailyMax, {
      code: ctx.profile.isMinor ? "JARBSCHG_DAILY_MAX" : "ARBZG_DAILY_OVER_10",
      severity: "violation",
      message: `Du hast heute schon ${Math.floor(dailyLimit / 60)} Stunden oder mehr gearbeitet.`,
    });
  }

  // Nachtruhe für Jugendliche (20–6 Uhr)
  if (ctx.profile.isMinor) {
    const today = dateKeyOf(ctx.now);
    const inNight = ctx.now >= localTime(today, 20) || ctx.now < localTime(today, 6);
    if (inNight) {
      apply(ctx.rules.enforcement.minorsNightRest, {
        code: "JARBSCHG_NIGHT_REST",
        severity: "violation",
        law: "§ 14 JArbSchG",
        message: "Zwischen 20 und 6 Uhr gilt für dich Nachtruhe.",
      });
    }
  }

  // Frühestes Einchecken vor Schichtbeginn
  if (ctx.shift && !ctx.rules.trustBasedHours && ctx.rules.checkIn.earliestEnforcement !== "off") {
    const earlyBy = Math.floor((ctx.shift.startsAt.getTime() - ctx.now.getTime()) / 60000);
    if (earlyBy > ctx.rules.checkIn.earliestBeforeShiftMin) {
      apply(ctx.rules.checkIn.earliestEnforcement, {
        code: "RULE_EARLY_CHECK_IN",
        severity: "info",
        message: `Deine Schicht beginnt erst in ${earlyBy} Min. Einchecken ist frühestens ${ctx.rules.checkIn.earliestBeforeShiftMin} Min. vorher möglich.`,
        details: { earlyBy },
      });
    }
  }

  return { allowed: !blockReason, blockReason, warnings };
}
