/**
 * Gemeinsame Typen des Compliance-Service.
 * Dieses Modul hat bewusst keine Abhängigkeit zu React, Next.js oder Supabase.
 */

export type EventKind = "check_in" | "break_start" | "break_end" | "check_out";

export interface TimeEvent {
  kind: EventKind;
  at: Date;
  /** Erfassungsweg, z. B. „system_auto" bei automatischem Auschecken */
  source?: string;
}

export interface Interval {
  start: Date;
  end: Date;
}

export type Severity = "info" | "warning" | "violation";

export type ViolationCode =
  | "ARBZG_DAILY_OVER_8"
  | "ARBZG_DAILY_OVER_10"
  | "ARBZG_BREAK_TOO_SHORT"
  | "ARBZG_CONTINUOUS_WORK"
  | "ARBZG_REST_PERIOD"
  | "ARBZG_AVERAGE_EXCEEDED"
  | "ARBZG_SUNDAY_WORK"
  | "ARBZG_HOLIDAY_WORK"
  | "ARBZG_REPLACEMENT_REST_MISSING"
  | "ARBZG_SUNDAYS_OFF"
  | "JARBSCHG_DAILY_MAX"
  | "JARBSCHG_WEEKLY_MAX"
  | "JARBSCHG_FIVE_DAY_WEEK"
  | "JARBSCHG_NIGHT_REST"
  | "JARBSCHG_WEEKEND"
  | "JARBSCHG_SCHOOL_DAY"
  | "JARBSCHG_REST_PERIOD"
  | "JARBSCHG_BREAK"
  | "MUSCHG_DAILY_MAX"
  | "MUSCHG_DOUBLE_WEEK_MAX"
  | "MUSCHG_NIGHT"
  | "MUSCHG_SUNDAY_HOLIDAY"
  | "MILOG_RECORD_MISSING"
  | "MILOG_RECORD_LATE"
  | "RULE_EARLY_CHECK_IN"
  | "RULE_LATE_CHECK_OUT"
  | "RULE_LATE_ARRIVAL"
  | "RULE_AUTO_BREAK_DEDUCTED"
  | "RULE_AUTO_CHECKOUT"
  | "RULE_OVERTIME_APPROVAL"
  | "RULE_MISSING_CHECK_OUT"
  | "PLAN_ABSENCE_CONFLICT"
  | "PLAN_SHIFT_OVERLAP";

export interface Violation {
  code: ViolationCode;
  severity: Severity;
  /** kurzer, freundlicher deutscher Text */
  message: string;
  /** Rechtsgrundlage, z. B. „§ 4 ArbZG" */
  law?: string;
  details?: Record<string, unknown>;
}

export type ContractType = "minijob" | "part_time" | "full_time" | "apprentice" | "working_student";

/** Was die Regeln über eine Person wissen müssen – Datenminimierung. */
export interface WorkerProfile {
  isMinor: boolean;
  maternityProtection: boolean;
  contractType: ContractType;
  /** ISO-Wochentage mit Berufsschule */
  schoolDays: readonly number[];
  trustBasedHours: boolean;
}

export const minutes = (ms: number) => Math.floor(ms / 60000);
export const diffMinutes = (a: Date, b: Date) => minutes(b.getTime() - a.getTime());
