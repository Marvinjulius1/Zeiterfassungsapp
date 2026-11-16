/**
 * Ruhepausen
 *
 * § 4 ArbZG (Erwachsene)
 *   – mehr als 6 h Arbeit → mind. 30 Min. Pause, mehr als 9 h → mind. 45 Min.
 *   – Pausen zählen nur in Blöcken von mind. 15 Min.
 *   – nicht länger als 6 h am Stück ohne Ruhepause
 *
 * § 11 JArbSchG (Jugendliche unter 18)
 *   – mehr als 4,5 h → mind. 30 Min., mehr als 6 h → mind. 60 Min.
 *   – Blöcke von mind. 15 Min.
 *   – nicht länger als 4,5 h am Stück ohne Ruhepause
 */

export const MIN_BREAK_BLOCK_MIN = 15;

interface BreakRules {
  /** [ab Netto-Minuten (exklusiv), nötige Pausenminuten] – aufsteigend */
  tiers: readonly (readonly [number, number])[];
  maxContinuousMin: number;
}

export const ADULT_BREAK_RULES: BreakRules = {
  tiers: [
    [6 * 60, 30],
    [9 * 60, 45],
  ],
  maxContinuousMin: 6 * 60,
};

export const MINOR_BREAK_RULES: BreakRules = {
  tiers: [
    [4.5 * 60, 30],
    [6 * 60, 60],
  ],
  maxContinuousMin: 4.5 * 60,
};

export function breakRulesFor(isMinor: boolean): BreakRules {
  return isMinor ? MINOR_BREAK_RULES : ADULT_BREAK_RULES;
}

/** Nötige Pausenminuten für eine Netto-Arbeitszeit. */
export function requiredBreakMinutes(netMinutes: number, isMinor = false): number {
  let req = 0;
  for (const [above, minutes] of breakRulesFor(isMinor).tiers) {
    if (netMinutes > above) req = minutes;
  }
  return req;
}

/** Nur Pausen ≥ 15 Min. zählen als Ruhepause. */
export function countableBreakMinutes(blocksSeconds: readonly number[]): number {
  return blocksSeconds
    .map((s) => Math.floor(s / 60))
    .filter((m) => m >= MIN_BREAK_BLOCK_MIN)
    .reduce((a, b) => a + b, 0);
}

export interface BreakStatusInput {
  netSeconds: number;
  /** abgeschlossene Pausenblöcke in Sekunden */
  breakBlocks: readonly number[];
  /** laufende Pause in Sekunden (0, wenn keine läuft) */
  currentBreakSeconds: number;
  /** Arbeit seit Check-in bzw. letztem Pausenende in Sekunden */
  secondsSinceLastBreak: number;
  isMinor: boolean;
}

export type BreakStatus =
  | { kind: "ok"; countedMinutes: number; requiredMinutes: number }
  /** Pause wird bald fällig */
  | { kind: "due_soon"; inMinutes: number; needMinutes: number; reason: "total" | "continuous" }
  /** Grenze überschritten, Pause fehlt */
  | { kind: "overdue"; missingMinutes: number; reason: "total" | "continuous" };

/**
 * Bewertet den laufenden Tag: Ist eine Pause fällig, überfällig oder alles gut?
 * Eine laufende Pause zählt bereits mit, sobald sie 15 Min. erreicht.
 */
export function breakStatus(input: BreakStatusInput, warnWithinMinutes = 60): BreakStatus {
  const rules = breakRulesFor(input.isMinor);
  const netMin = Math.floor(input.netSeconds / 60);
  const counted = countableBreakMinutes(
    input.currentBreakSeconds > 0 ? [...input.breakBlocks, input.currentBreakSeconds] : input.breakBlocks,
  );
  const required = requiredBreakMinutes(netMin, input.isMinor);

  // 1) Gesamtpause für die bisherige Arbeitszeit
  if (counted < required) {
    return { kind: "overdue", missingMinutes: required - counted, reason: "total" };
  }

  // 2) Am Stück zu lange gearbeitet (nur relevant, wenn gerade gearbeitet wird)
  const continuousMin = Math.floor(input.secondsSinceLastBreak / 60);
  if (input.currentBreakSeconds === 0 && continuousMin > rules.maxContinuousMin) {
    return { kind: "overdue", missingMinutes: MIN_BREAK_BLOCK_MIN, reason: "continuous" };
  }

  // 3) Nächste Schwelle in Reichweite?
  const candidates: { inMinutes: number; needMinutes: number; reason: "total" | "continuous" }[] = [];
  for (const [above, minutes] of rules.tiers) {
    if (netMin <= above && counted < minutes) {
      candidates.push({ inMinutes: above - netMin, needMinutes: minutes - counted, reason: "total" });
      break;
    }
  }
  if (input.currentBreakSeconds === 0 && input.secondsSinceLastBreak > 0) {
    candidates.push({
      inMinutes: rules.maxContinuousMin - continuousMin,
      needMinutes: MIN_BREAK_BLOCK_MIN,
      reason: "continuous",
    });
  }
  const next = candidates.sort((a, b) => a.inMinutes - b.inMinutes)[0];
  if (next && next.inMinutes <= warnWithinMinutes && input.currentBreakSeconds === 0) {
    return { kind: "due_soon", ...next };
  }
  return { kind: "ok", countedMinutes: counted, requiredMinutes: required };
}
