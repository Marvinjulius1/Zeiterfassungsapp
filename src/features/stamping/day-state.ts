/**
 * Leitet aus den Buchungen eines Arbeitstags den aktuellen Zustand ab.
 * Spiegelt bewusst app.recompute_work_day() in der Datenbank, damit die
 * Live-Uhr im Client exakt dieselben Werte zeigt wie später der Server.
 */

export type EventKind = "check_in" | "break_start" | "break_end" | "check_out";
export type StampState = "out" | "in" | "break";

export interface DayEvent {
  id: string;
  kind: EventKind;
  /** ISO-Zeitstempel */
  occurredAt: string;
  /** noch nicht synchronisiert (Offline-Puffer) */
  pending?: boolean;
}

export interface DaySummary {
  state: StampState;
  grossSeconds: number;
  breakSeconds: number;
  netSeconds: number;
  /** Beginn des aktuellen Arbeitsblocks (seit letztem Check-in) */
  blockStart: Date | null;
  /** Beginn der laufenden Pause */
  breakStart: Date | null;
  /** Arbeitszeit seit der letzten Pause bzw. dem Check-in (für „max. 6 h am Stück") */
  secondsSinceLastBreak: number;
  /** Längste zusammenhängende Pause in Sekunden */
  breakBlocks: number[];
  firstIn: Date | null;
  lastOut: Date | null;
}

const ALLOWED: Record<StampState, EventKind[]> = {
  out: ["check_in"],
  in: ["break_start", "check_out"],
  break: ["break_end", "check_out"],
};

export function allowedActions(state: StampState): EventKind[] {
  return ALLOWED[state];
}

export function nextState(state: StampState, kind: EventKind): StampState {
  if (!ALLOWED[state].includes(kind)) {
    throw new Error(`Ungültiger Übergang: ${kind} im Zustand ${state}`);
  }
  if (kind === "check_in" || kind === "break_end") return "in";
  if (kind === "break_start") return "break";
  return "out";
}

const secs = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 1000));

export function summarizeDay(events: readonly DayEvent[], now: Date): DaySummary {
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  let state: StampState = "out";
  let blockStart: Date | null = null;
  let breakStart: Date | null = null;
  let workSegmentStart: Date | null = null; // seit Check-in bzw. Pausenende
  let gross = 0;
  let breaks = 0;
  let firstIn: Date | null = null;
  let lastOut: Date | null = null;
  const breakBlocks: number[] = [];

  for (const e of sorted) {
    const at = new Date(e.occurredAt);
    if (!ALLOWED[state].includes(e.kind)) continue; // ungültige Folgen ignorieren wie der Server
    switch (e.kind) {
      case "check_in":
        blockStart = at;
        workSegmentStart = at;
        firstIn ??= at;
        break;
      case "break_start":
        breakStart = at;
        break;
      case "break_end":
        if (breakStart) {
          const b = secs(breakStart, at);
          breaks += b;
          breakBlocks.push(b);
        }
        breakStart = null;
        workSegmentStart = at;
        break;
      case "check_out":
        if (breakStart) {
          const b = secs(breakStart, at);
          breaks += b;
          breakBlocks.push(b);
          breakStart = null;
        }
        if (blockStart) gross += secs(blockStart, at);
        blockStart = null;
        workSegmentStart = null;
        lastOut = at;
        break;
    }
    state = nextState(state, e.kind);
  }

  let secondsSinceLastBreak = 0;
  if (blockStart) {
    gross += secs(blockStart, now);
    if (breakStart) {
      const b = secs(breakStart, now);
      breaks += b;
    } else if (workSegmentStart) {
      secondsSinceLastBreak = secs(workSegmentStart, now);
    }
  }

  return {
    state,
    grossSeconds: gross,
    breakSeconds: breaks,
    netSeconds: Math.max(0, gross - breaks),
    blockStart,
    breakStart,
    secondsSinceLastBreak,
    breakBlocks,
    firstIn,
    lastOut,
  };
}
