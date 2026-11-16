import type { Interval, TimeEvent } from "./types";

export interface DayIntervals {
  work: Interval[]; // Anwesenheit (brutto, inkl. Pausen)
  breaks: Interval[];
  /** tatsächliche Arbeit (Anwesenheit minus Pausen) */
  net: Interval[];
  open: boolean;
}

/**
 * Wandelt Stempel-Ereignisse in Intervalle um. Ungültige Folgen werden ignoriert
 * (wie in der Datenbank). Offene Blöcke laufen bis `now`.
 */
export function toIntervals(events: readonly TimeEvent[], now: Date): DayIntervals {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const work: Interval[] = [];
  const breaks: Interval[] = [];
  let inAt: Date | null = null;
  let breakAt: Date | null = null;

  for (const e of sorted) {
    if (e.kind === "check_in" && !inAt) inAt = e.at;
    else if (e.kind === "break_start" && inAt && !breakAt) breakAt = e.at;
    else if (e.kind === "break_end" && breakAt) {
      breaks.push({ start: breakAt, end: e.at });
      breakAt = null;
    } else if (e.kind === "check_out" && inAt) {
      if (breakAt) {
        breaks.push({ start: breakAt, end: e.at });
        breakAt = null;
      }
      work.push({ start: inAt, end: e.at });
      inAt = null;
    }
  }
  const open = inAt !== null;
  if (inAt) {
    if (breakAt) breaks.push({ start: breakAt, end: now });
    work.push({ start: inAt, end: now });
  }
  return { work, breaks, net: subtract(work, breaks), open };
}

/** Intervalle a minus b */
export function subtract(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  let result = a.map((i) => ({ ...i }));
  for (const cut of b) {
    const next: Interval[] = [];
    for (const i of result) {
      if (cut.end <= i.start || cut.start >= i.end) {
        next.push(i);
        continue;
      }
      if (cut.start > i.start) next.push({ start: i.start, end: cut.start });
      if (cut.end < i.end) next.push({ start: cut.end, end: i.end });
    }
    result = next;
  }
  return result.filter((i) => i.end > i.start);
}

export function totalMinutes(list: readonly Interval[]): number {
  return Math.floor(list.reduce((s, i) => s + (i.end.getTime() - i.start.getTime()), 0) / 60000);
}

/** Überschneidung in Minuten */
export function overlapMinutes(list: readonly Interval[], window: Interval): number {
  return totalMinutes(
    list
      .map((i) => ({ start: new Date(Math.max(i.start.getTime(), window.start.getTime())), end: new Date(Math.min(i.end.getTime(), window.end.getTime())) }))
      .filter((i) => i.end > i.start),
  );
}
