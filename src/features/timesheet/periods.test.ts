import { describe, expect, it } from "vitest";
import { isoWeekNumber, parseDate, parseView, periodLabel, rangeFor, stepDate } from "./periods";

describe("Zeiträume für „Meine Zeiten“", () => {
  it("parst Parameter defensiv", () => {
    expect(parseView("month")).toBe("month");
    expect(parseView("quatsch")).toBe("week");
    expect(parseDate("2026-11-16")).toBe("2026-11-16");
    expect(parseDate("<script>")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("Kalenderwochen", () => {
    expect(isoWeekNumber("2026-11-16")).toBe(47);
    expect(isoWeekNumber("2026-01-01")).toBe(1);
    expect(isoWeekNumber("2027-01-01")).toBe(53);
  });
  it("blättert je Ansicht", () => {
    expect(stepDate("day", "2026-11-16", 1)).toBe("2026-11-17");
    expect(stepDate("week", "2026-11-16", -1)).toBe("2026-11-09");
    expect(stepDate("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(stepDate("month", "2026-01-15", -1)).toBe("2025-12-01");
  });
  it("Beschriftungen", () => {
    expect(periodLabel("week", "2026-11-18")).toBe("KW 47 · 16.–22.11.");
    expect(periodLabel("week", "2026-11-30")).toBe("KW 49 · 30.11.–6.12.");
    expect(periodLabel("month", "2026-11-18")).toBe("November 2026");
    expect(rangeFor("month", "2026-11-18")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });
});
