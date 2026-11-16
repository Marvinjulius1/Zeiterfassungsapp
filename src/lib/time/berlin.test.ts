import { describe, expect, it } from "vitest";
import {
  berlinDateKey, daysInRange, formatDayShort, formatTime, isoWeekRange, isoWeekday, monthRange, relativeDayLabel, shiftDays,
} from "./berlin";

describe("Berliner Zeit", () => {
  it("Datum wechselt um Mitternacht Berliner Zeit, nicht UTC", () => {
    expect(berlinDateKey(new Date("2026-11-16T23:30:00Z"))).toBe("2026-11-17");
    expect(berlinDateKey(new Date("2026-07-16T22:30:00Z"))).toBe("2026-07-17"); // Sommerzeit
  });
  it("Uhrzeit", () => {
    expect(formatTime("2026-11-16T06:58:00Z")).toBe("07:58");
  });
});

describe("Zeiträume", () => {
  it("ISO-Woche Mo–So", () => {
    expect(isoWeekRange("2026-11-19")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(isoWeekRange("2026-11-16")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(isoWeekRange("2026-11-22")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
  });
  it("Monat", () => {
    expect(monthRange("2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(daysInRange(monthRange("2026-11-03"))).toHaveLength(30);
  });
  it("über Zeitumstellung hinweg", () => {
    expect(shiftDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(shiftDays("2026-03-28", 2)).toBe("2026-03-30");
  });
  it("Wochentag & Beschriftung", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(isoWeekday("2026-11-22")).toBe(7);
    expect(formatDayShort("2026-11-16")).toBe("Mo, 16.11.");
    expect(relativeDayLabel("2026-11-17", "2026-11-16")).toBe("Morgen");
  });
});
