import { describe, expect, it } from "vitest";
import { shiftConflicts, type PlannedShift } from "./shift-conflicts";
import { localTime } from "./time";
import type { WorkerProfile } from "./types";

const adult: WorkerProfile = { isMinor: false, maternityProtection: false, contractType: "full_time", schoolDays: [], trustBasedHours: false };
const minor: WorkerProfile = { ...adult, isMinor: true, schoolDays: [] };
const shift = (id: string, day: string, from: number, to: number, br = 30, toDay = day): PlannedShift => ({
  id, start: localTime(day, from), end: localTime(toDay, to), breakMinutes: br,
});
const codes = (m: Map<string, { message: string; code: string }[]>, id: string) => (m.get(id) ?? []).map((v) => v.code);

describe("shiftConflicts", () => {
  it("normale Woche ohne Konflikte", () => {
    const week = ["16", "17", "18", "19", "20"].map((d) => shift(d, `2026-11-${d}`, 8, 16, 30));
    expect(shiftConflicts(week, adult, [], new Map()).size).toBe(0);
  });

  it("Spätschicht → Frühschicht: Ruhezeit", () => {
    const r = shiftConflicts([shift("a", "2026-11-16", 14, 22), shift("b", "2026-11-17", 6, 14)], adult, [], new Map());
    expect(codes(r, "b")).toEqual(["ARBZG_REST_PERIOD"]);
  });

  it("Urlaub genehmigt = Konflikt, beantragt = Warnung", () => {
    const s = [shift("a", "2026-11-18", 8, 16)];
    expect(shiftConflicts(s, adult, [{ start: "2026-11-16", end: "2026-11-20", label: "Urlaub", status: "approved" }], new Map()).get("a")?.[0]).toMatchObject({ severity: "violation" });
    expect(shiftConflicts(s, adult, [{ start: "2026-11-18", end: "2026-11-18", label: "Urlaub", status: "pending" }], new Map()).get("a")?.[0]).toMatchObject({ severity: "warning" });
  });

  it("zu lang und Pause zu kurz", () => {
    const r = shiftConflicts([shift("a", "2026-11-16", 6, 17, 20)], adult, [], new Map());
    expect(codes(r, "a")).toEqual(["ARBZG_DAILY_OVER_10", "ARBZG_BREAK_TOO_SHORT"]);
  });

  it("Überschneidung", () => {
    const r = shiftConflicts([shift("a", "2026-11-16", 8, 14), shift("b", "2026-11-16", 13, 18)], adult, [], new Map());
    expect(codes(r, "b")).toContain("PLAN_SHIFT_OVERLAP");
  });

  it("Jugendliche: Abendschicht bis 21 Uhr und 9 h", () => {
    const r = shiftConflicts([shift("a", "2026-11-16", 11, 21, 60)], minor, [], new Map());
    expect(codes(r, "a")).toEqual(["JARBSCHG_DAILY_MAX", "JARBSCHG_NIGHT_REST"]);
  });

  it("Jugendliche: 6 Tage", () => {
    const week = ["16", "17", "18", "19", "20", "21"].map((d) => shift(d, `2026-11-${d}`, 8, 12, 0));
    const r = shiftConflicts(week, minor, [], new Map());
    expect(codes(r, "21")).toEqual(["JARBSCHG_WEEKEND", "JARBSCHG_FIVE_DAY_WEEK"]);
  });

  it("Sonntag nur als Hinweis", () => {
    const r = shiftConflicts([shift("a", "2026-11-22", 10, 16)], adult, [], new Map());
    expect(r.get("a")?.[0]).toMatchObject({ code: "ARBZG_SUNDAY_WORK", severity: "info" });
  });

  it("Erwachsene: mehr als 48 h pro Woche", () => {
    // 7:00–17:30 mit 45 Min. Pause = 9:45 h netto × 5 = 48:45 h
    const week = ["16", "17", "18", "19", "20"].map((d) => ({ ...shift(d, `2026-11-${d}`, 7, 17, 45), end: new Date(shift(d, `2026-11-${d}`, 7, 17).end.getTime() + 30 * 60000) }));
    expect(codes(shiftConflicts(week, adult, [], new Map()), "20")).toEqual(["ARBZG_AVERAGE_EXCEEDED"]);
  });
});
