import { describe, expect, it } from "vitest";
import { paletteFilter } from "./palette-filter";

describe("paletteFilter", () => {
  it("findet Personen am Wortanfang", () => {
    expect(paletteFilter("person Noah Klein", "noah")).toBe(1);
    expect(paletteFilter("person Noah Klein", "kle")).toBe(1);
  });
  it("keine verstreuten Treffer", () => {
    expect(paletteFilter("gehe zu Audit-Log", "noah")).toBe(0);
  });
  it("Teilstring zählt schwächer", () => {
    expect(paletteFilter("gehe zu Freigaben", "gabe")).toBe(0.5);
  });
});
