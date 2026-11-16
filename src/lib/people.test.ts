import { describe, expect, it } from "vitest";
import { ageOn, isMinorOn } from "./people";

describe("ageOn / isMinorOn", () => {
  it("Geburtstag zählt ab dem Tag selbst", () => {
    expect(ageOn("2009-08-20", "2027-08-19")).toBe(17);
    expect(ageOn("2009-08-20", "2027-08-20")).toBe(18);
  });
  it("ohne Geburtsdatum kein Jugendschutz", () => {
    expect(isMinorOn(null, "2026-11-16")).toBe(false);
    expect(isMinorOn("2009-08-20", "2026-11-16")).toBe(true);
  });
});
