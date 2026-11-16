import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, resolveRules, ruleOverrideSchema } from "./schema";

describe("resolveRules", () => {
  it("ohne Ebenen gelten die Standardwerte", () => {
    expect(resolveRules()).toEqual(DEFAULT_RULES);
  });
  it("spätere Ebenen überschreiben frühere – feldweise", () => {
    const r = resolveRules(
      { rounding: { mode: "employee_favor", unitMin: 15 } },
      { rounding: { unitMin: 5 } }, // Standort
    );
    expect(r.rounding).toEqual({ mode: "employee_favor", unitMin: 5 });
    expect(r.checkIn).toEqual(DEFAULT_RULES.checkIn);
  });
  it("Arrays werden ersetzt, nicht gemischt", () => {
    expect(resolveRules({ methods: { allowed: ["terminal_qr"] } }).methods.allowed).toEqual(["terminal_qr"]);
  });
  it("ungültige Werte fallen auf den Standard zurück, Rest bleibt", () => {
    const r = resolveRules({ rounding: { unitMin: 7 }, trustBasedHours: true });
    expect(r.rounding).toEqual(DEFAULT_RULES.rounding);
    expect(r.trustBasedHours).toBe(true);
  });
  it("unbekannte Schlüssel werden ignoriert", () => {
    expect(resolveRules({ hacker: true })).toEqual(DEFAULT_RULES);
  });
});

describe("ruleOverrideSchema", () => {
  it("akzeptiert Teil-Überschreibungen", () => {
    expect(ruleOverrideSchema.safeParse({ checkIn: { lateToleranceMin: 10 } }).success).toBe(true);
  });
  it("lehnt unbekannte Abschnitte und ungültige Werte ab", () => {
    expect(ruleOverrideSchema.safeParse({ foo: 1 }).success).toBe(false);
    expect(ruleOverrideSchema.safeParse({ surcharges: { nightPct: 500 } }).success).toBe(false);
  });
});

import { diffRules } from "./schema";

describe("diffRules", () => {
  it("speichert nur Abweichungen", () => {
    const parent = resolveRules({ rounding: { mode: "employee_favor", unitMin: 15 } });
    const effective = resolveRules(parent, { rounding: { unitMin: 5 }, trustBasedHours: true });
    expect(diffRules(parent, effective)).toEqual({ rounding: { unitMin: 5 }, trustBasedHours: true });
  });
  it("keine Abweichung → leeres Objekt", () => {
    expect(diffRules(DEFAULT_RULES, DEFAULT_RULES)).toEqual({});
  });
  it("Rundreise: parent ⊕ diff = effective", () => {
    const effective = resolveRules({ methods: { allowed: ["terminal_qr", "pin"] }, surcharges: { nightPct: 25 } });
    expect(resolveRules(DEFAULT_RULES, diffRules(DEFAULT_RULES, effective))).toEqual(effective);
  });
});
