import { describe, expect, it } from "vitest";
import { toIntervals, totalMinutes } from "../intervals";
import { localTime } from "../time";
import { autoBreakDeduction, overtimeViolation, roundWork, shiftWindowViolations, surchargeMinutes } from "./company";
import { DEFAULT_RULES, resolveRules } from "./schema";

const t = (hh: number, mm = 0, day = "2026-11-16") => localTime(day, hh, mm);

describe("Rundung", () => {
  const work = [{ start: t(7, 58), end: t(16, 41) }];
  it("aus = unverändert", () => {
    expect(totalMinutes(roundWork(work, { mode: "none", unitMin: 15 }))).toBe(523);
  });
  it("zugunsten des Mitarbeiters: Beginn ab-, Ende aufrunden", () => {
    const r = roundWork(work, { mode: "employee_favor", unitMin: 15 });
    expect(r[0].start).toEqual(t(7, 45));
    expect(r[0].end).toEqual(t(16, 45));
  });
  it("kaufmännisch", () => {
    const r = roundWork(work, { mode: "commercial", unitMin: 5 });
    expect(r[0].start).toEqual(t(8, 0));
    expect(r[0].end).toEqual(t(16, 40));
  });
});

describe("Automatischer Pausenabzug", () => {
  it("zieht fehlende Pause ab, wenn aktiv", () => {
    const r = autoBreakDeduction(7 * 60, [], false, true);
    expect(r.minutes).toBe(30);
    expect(r.violation?.code).toBe("RULE_AUTO_BREAK_DEDUCTED");
  });
  it("berücksichtigt bereits genommene Pausen ≥ 15 Min.", () => {
    expect(autoBreakDeduction(7 * 60, [{ start: t(12), end: t(12, 20) }], false, true).minutes).toBe(10);
    expect(autoBreakDeduction(7 * 60, [{ start: t(12), end: t(12, 10) }], false, true).minutes).toBe(30);
  });
  it("nichts, wenn deaktiviert oder ausreichend", () => {
    expect(autoBreakDeduction(7 * 60, [], false, false).minutes).toBe(0);
    expect(autoBreakDeduction(5 * 60, [], false, true).minutes).toBe(0);
  });
});

describe("Zuschlagsminuten", () => {
  const rules = DEFAULT_RULES.surcharges;
  it("Nachtschicht über Mitternacht (23–6 Uhr)", () => {
    const net = toIntervals([{ kind: "check_in", at: t(21) }, { kind: "check_out", at: t(5, 0, "2026-11-17") }], t(12, 0, "2026-11-17")).net;
    expect(surchargeMinutes(net, "2026-11-16", rules, new Map()).nightMin).toBe(6 * 60);
  });
  it("Frühschicht vor 6 Uhr zählt auch als Nacht", () => {
    const net = [{ start: t(4), end: t(12) }];
    expect(surchargeMinutes(net, "2026-11-16", rules, new Map()).nightMin).toBe(120);
  });
  it("Sonntag und Feiertag", () => {
    const sunday = [{ start: t(10, 0, "2026-11-22"), end: t(14, 0, "2026-11-22") }];
    expect(surchargeMinutes(sunday, "2026-11-22", rules, new Map()).sundayMin).toBe(240);
    const xmas = [{ start: t(8, 0, "2026-12-25"), end: t(12, 0, "2026-12-25") }];
    expect(surchargeMinutes(xmas, "2026-12-25", rules, new Map([["2026-12-25", "1. Weihnachtsfeiertag"]])).holidayMin).toBe(240);
  });
});

describe("Schichtfenster", () => {
  const shift = { startsAt: t(8), endsAt: t(16, 30) };
  const rules = resolveRules({ checkIn: { earliestEnforcement: "warn", earliestBeforeShiftMin: 15 }, checkOut: { latestEnforcement: "warn", latestAfterShiftMin: 30 } });
  it("zu früh eingecheckt", () => {
    expect(shiftWindowViolations(t(7, 30), null, shift, rules).map((v) => v.code)).toEqual(["RULE_EARLY_CHECK_IN"]);
  });
  it("innerhalb der Toleranz ist alles gut", () => {
    expect(shiftWindowViolations(t(7, 50), t(16, 50), shift, rules)).toEqual([]);
    expect(shiftWindowViolations(t(8, 4), null, shift, rules)).toEqual([]);
  });
  it("Verspätung und spätes Auschecken", () => {
    const codes = shiftWindowViolations(t(8, 20), t(17, 30), shift, rules).map((v) => v.code);
    expect(codes).toEqual(["RULE_LATE_ARRIVAL", "RULE_LATE_CHECK_OUT"]);
  });
  it("Vertrauensarbeitszeit: keine Kontrolle", () => {
    expect(shiftWindowViolations(t(10), t(20), shift, { ...rules, trustBasedHours: true })).toEqual([]);
  });
});

describe("Überstunden-Freigabe", () => {
  it("nur über der Schwelle", () => {
    const rules = resolveRules({ overtime: { approvalAboveMin: 60 } });
    expect(overtimeViolation(480 + 60, 480, rules)).toBeNull();
    expect(overtimeViolation(480 + 61, 480, rules)?.code).toBe("RULE_OVERTIME_APPROVAL");
    expect(overtimeViolation(900, 480, DEFAULT_RULES)).toBeNull();
  });
});
