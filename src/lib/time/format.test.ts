import { describe, expect, it } from "vitest";
import { formatClock, formatDecimalHours, formatHours, formatMinutesShort } from "./format";

describe("formatClock", () => {
  it("formatiert Sekunden als H:MM:SS", () => {
    expect(formatClock(0)).toBe("0:00:00");
    expect(formatClock(6 * 3600 + 42 * 60 + 18)).toBe("6:42:18");
    expect(formatClock(36000)).toBe("10:00:00");
  });
  it("klemmt negative Werte auf 0", () => {
    expect(formatClock(-5)).toBe("0:00:00");
  });
});

describe("formatHours", () => {
  it("zeigt Stunden und Minuten", () => {
    expect(formatHours(472)).toBe("7:52 h");
  });
  it("zeigt Vorzeichen für Salden", () => {
    expect(formatHours(-75)).toBe("−1:15 h");
    expect(formatHours(90, { sign: true })).toBe("+1:30 h");
    expect(formatHours(0, { sign: true })).toBe("0:00 h");
  });
});

describe("formatDecimalHours", () => {
  it("nutzt deutsches Dezimalkomma", () => {
    expect(formatDecimalHours(450)).toBe("7,5 h");
  });
});

describe("formatMinutesShort", () => {
  it("kurze und lange Dauern", () => {
    expect(formatMinutesShort(12)).toBe("12 Min.");
    expect(formatMinutesShort(60)).toBe("1 Std.");
    expect(formatMinutesShort(65)).toBe("1 Std. 5 Min.");
  });
});
