import { describe, expect, it } from "vitest";
import { overlapMinutes, subtract, toIntervals, totalMinutes } from "./intervals";
import { addDaysKey, daysBetweenKeys, localTime, mondayOfKey, weekdayOf, dateKeyOf } from "./time";
import type { TimeEvent } from "./types";

const t = (hh: number, mm = 0) => localTime("2026-11-16", hh, mm);
const ev = (kind: TimeEvent["kind"], hh: number, mm = 0): TimeEvent => ({ kind, at: t(hh, mm) });

describe("toIntervals", () => {
  it("Arbeit minus Pause", () => {
    const r = toIntervals([ev("check_in", 8), ev("break_start", 12), ev("break_end", 12, 30), ev("check_out", 16, 30)], t(20));
    expect(totalMinutes(r.work)).toBe(510);
    expect(totalMinutes(r.breaks)).toBe(30);
    expect(totalMinutes(r.net)).toBe(480);
    expect(r.open).toBe(false);
  });
  it("offener Block läuft bis jetzt", () => {
    const r = toIntervals([ev("check_in", 8)], t(9, 15));
    expect(r.open).toBe(true);
    expect(totalMinutes(r.net)).toBe(75);
  });
  it("subtract und overlap", () => {
    expect(totalMinutes(subtract([{ start: t(8), end: t(12) }], [{ start: t(9), end: t(10) }]))).toBe(180);
    expect(overlapMinutes([{ start: t(20), end: t(23, 30) }], { start: t(22), end: t(23) })).toBe(60);
  });
});

describe("Zeit-Helfer", () => {
  it("lokale Zeit Berlin, auch Sommerzeit", () => {
    expect(localTime("2026-11-16", 8).toISOString()).toBe("2026-11-16T07:00:00.000Z");
    expect(localTime("2026-07-16", 8).toISOString()).toBe("2026-07-16T06:00:00.000Z");
    expect(dateKeyOf(new Date("2026-11-16T23:30:00Z"))).toBe("2026-11-17");
  });
  it("Datumsrechnung", () => {
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf("2026-11-22")).toBe(7);
    expect(mondayOfKey("2026-11-22")).toBe("2026-11-16");
    expect(daysBetweenKeys("2026-11-16", "2026-11-23")).toBe(7);
  });
});
