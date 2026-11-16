import { describe, expect, it } from "vitest";
import { autoCheckoutAt } from "./auto-checkout";
import { localTime } from "./time";

const t = (hh: number, mm = 0, d = "2026-11-16") => localTime(d, hh, mm);
const rules = { enabled: true, afterHours: 12, atMidnight: false };

describe("autoCheckoutAt", () => {
  it("nach x Stunden", () => {
    expect(autoCheckoutAt(t(8), t(19, 59), rules)).toBeNull();
    expect(autoCheckoutAt(t(8), t(20, 5), rules)).toEqual(t(20));
  });
  it("um Mitternacht, falls früher", () => {
    expect(autoCheckoutAt(t(18), t(0, 30, "2026-11-17"), { ...rules, atMidnight: true })).toEqual(t(0, 0, "2026-11-17"));
  });
  it("deaktiviert", () => {
    expect(autoCheckoutAt(t(8), t(23), { ...rules, enabled: false })).toBeNull();
  });
});
