import { describe, expect, it } from "vitest";
import { breakViolations, calendarViolations, dailyMaxViolations, longestContinuousMinutes, restPeriodViolation } from "./legal";
import { localTime } from "./time";
import type { WorkerProfile } from "./types";

const t = (hh: number, mm = 0, day = "2026-11-16") => localTime(day, hh, mm);
const adult: WorkerProfile = { isMinor: false, maternityProtection: false, contractType: "full_time", schoolDays: [], trustBasedHours: false };
const minor: WorkerProfile = { ...adult, isMinor: true, contractType: "apprentice", schoolDays: [2] };
const mother: WorkerProfile = { ...adult, maternityProtection: true };
const codes = (v: { code: string }[]) => v.map((x) => x.code);

describe("§ 3 ArbZG – tägliche Höchstarbeitszeit", () => {
  it.each([
    [480, []],
    [481, ["ARBZG_DAILY_OVER_8"]],
    [600, ["ARBZG_DAILY_OVER_8"]],
    [601, ["ARBZG_DAILY_OVER_10"]],
  ])("%i Min. → %j", (net, expected) => expect(codes(dailyMaxViolations(net, adult))).toEqual(expected));

  it("§ 8 JArbSchG: Jugendliche max. 8 h", () => {
    expect(codes(dailyMaxViolations(481, minor))).toEqual(["JARBSCHG_DAILY_MAX"]);
    expect(dailyMaxViolations(480, minor)).toEqual([]);
  });
  it("§ 4 MuSchG: max. 8,5 h", () => {
    expect(codes(dailyMaxViolations(511, mother))).toEqual(["MUSCHG_DAILY_MAX", "ARBZG_DAILY_OVER_8"]);
    expect(codes(dailyMaxViolations(510, mother))).toEqual(["ARBZG_DAILY_OVER_8"]);
  });
});

describe("§ 4 ArbZG – Ruhepausen", () => {
  it("7 h ohne Pause → Pause zu kurz und zu lange am Stück", () => {
    expect(codes(breakViolations(420, [{ start: t(8), end: t(15) }], [], adult))).toEqual(["ARBZG_BREAK_TOO_SHORT", "ARBZG_CONTINUOUS_WORK"]);
  });
  it("korrekte Pause nach 4 h", () => {
    expect(breakViolations(480, [{ start: t(8), end: t(16, 30) }], [{ start: t(12), end: t(12, 30) }], adult)).toEqual([]);
  });
  it("Pausen unter 15 Min. zählen nicht", () => {
    const v = breakViolations(450, [{ start: t(8), end: t(16) }], [{ start: t(11), end: t(11, 10) }, { start: t(13), end: t(13, 10) }, { start: t(14), end: t(14, 10) }], adult);
    expect(codes(v)).toContain("ARBZG_BREAK_TOO_SHORT");
  });
  it("30 Min. Pause, aber erst nach 6,5 h → am Stück zu lang", () => {
    const v = breakViolations(450, [{ start: t(7), end: t(15) }], [{ start: t(13, 30), end: t(14) }], adult);
    expect(codes(v)).toEqual(["ARBZG_CONTINUOUS_WORK"]);
  });
  it("§ 11 JArbSchG: 60 Min. ab 6 h", () => {
    const v = breakViolations(390, [{ start: t(8), end: t(15) }], [{ start: t(11), end: t(11, 30) }], minor);
    expect(codes(v)).toEqual(["JARBSCHG_BREAK"]);
  });
  it("längste Strecke ignoriert kurze Unterbrechungen", () => {
    expect(longestContinuousMinutes([{ start: t(8), end: t(15) }], [{ start: t(10), end: t(10, 5) }])).toBe(415);
  });
});

describe("§ 5 ArbZG / § 13 JArbSchG – Ruhezeit", () => {
  it("11 h genügen für Erwachsene", () => {
    expect(restPeriodViolation(t(22), t(9, 0, "2026-11-17"), adult)).toBeNull();
  });
  it("10 h sind zu wenig", () => {
    expect(restPeriodViolation(t(22), t(8, 0, "2026-11-17"), adult)?.code).toBe("ARBZG_REST_PERIOD");
  });
  it("Jugendliche brauchen 12 h", () => {
    expect(restPeriodViolation(t(20), t(7, 30, "2026-11-17"), minor)?.code).toBe("JARBSCHG_REST_PERIOD");
    expect(restPeriodViolation(t(19), t(7, 0, "2026-11-17"), minor)).toBeNull();
  });
  it("ohne Vortag keine Prüfung", () => {
    expect(restPeriodViolation(null, t(8), adult)).toBeNull();
  });
});

describe("Kalender: Sonntag, Feiertag, Nacht, Berufsschule", () => {
  const sunday = "2026-11-22";
  it("Sonntagsarbeit wird gekennzeichnet", () => {
    expect(codes(calendarViolations(sunday, [{ start: t(10, 0, sunday), end: t(14, 0, sunday) }], adult, new Map()))).toEqual(["ARBZG_SUNDAY_WORK"]);
  });
  it("Feiertag", () => {
    const d = "2026-12-25";
    const v = calendarViolations(d, [{ start: t(10, 0, d), end: t(14, 0, d) }], adult, new Map([[d, "1. Weihnachtsfeiertag"]]));
    expect(codes(v)).toEqual(["ARBZG_HOLIDAY_WORK"]);
  });
  it("§ 14 JArbSchG: Nachtruhe 20–6 Uhr", () => {
    expect(codes(calendarViolations("2026-11-16", [{ start: t(14), end: t(21) }], minor, new Map()))).toEqual(["JARBSCHG_NIGHT_REST"]);
    expect(calendarViolations("2026-11-16", [{ start: t(6), end: t(14) }], minor, new Map())).toEqual([]);
  });
  it("§ 9 JArbSchG: Berufsschultag (Dienstag)", () => {
    expect(codes(calendarViolations("2026-11-17", [{ start: t(14, 0, "2026-11-17"), end: t(18, 0, "2026-11-17") }], minor, new Map()))).toEqual(["JARBSCHG_SCHOOL_DAY"]);
  });
  it("Jugendliche am Samstag", () => {
    const sat = "2026-11-21";
    expect(codes(calendarViolations(sat, [{ start: t(8, 0, sat), end: t(12, 0, sat) }], minor, new Map()))).toEqual(["JARBSCHG_WEEKEND"]);
  });
  it("§ 5/6 MuSchG: Nacht und Sonntag", () => {
    expect(codes(calendarViolations(sunday, [{ start: t(18, 0, sunday), end: t(21, 0, sunday) }], mother, new Map()))).toEqual(["ARBZG_SUNDAY_WORK", "MUSCHG_SUNDAY_HOLIDAY", "MUSCHG_NIGHT"]);
  });
});
