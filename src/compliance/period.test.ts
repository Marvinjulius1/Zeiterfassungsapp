import { describe, expect, it } from "vitest";
import { holidayMap } from "./holidays";
import {
  averageViolations, maternityDoubleWeekViolations, milogViolations, minorWeekViolations, replacementRestViolations,
  sixMonthAverage, sundaysOffViolations, type DayRecord,
} from "./period";
import { addDaysKey, weekdayOf } from "./time";
import type { WorkerProfile } from "./types";

const adult: WorkerProfile = { isMinor: false, maternityProtection: false, contractType: "full_time", schoolDays: [], trustBasedHours: false };
const minor: WorkerProfile = { ...adult, isMinor: true, contractType: "apprentice", schoolDays: [2] };
const day = (date: string, netMin: number, extra: Partial<DayRecord> = {}): DayRecord => ({
  date, netMin, targetMin: 480, hasEvents: netMin > 0, hasAbsence: false, ...extra,
});
const codesOn = (r: Map<string, { code: string }[]>, d: string) => (r.get(d) ?? []).map((v) => v.code);
const week = (monday: string, mins: number[]) => mins.map((m, i) => day(addDaysKey(monday, i), m));

describe("JArbSchG – Woche", () => {
  it("Berufsschultag zählt 8 h → 4 × 8 h + Schule = 40 h ok", () => {
    const r = minorWeekViolations(week("2026-11-16", [480, 0, 480, 480, 480]), minor);
    expect(r.size).toBe(0);
  });
  it("mehr als 40 h → Verstoß am Tag der Überschreitung", () => {
    const r = minorWeekViolations(week("2026-11-16", [480, 0, 480, 480, 500]), minor);
    expect(codesOn(r, "2026-11-20")).toEqual(["JARBSCHG_WEEKLY_MAX"]);
  });
  it("6. Arbeitstag → 5-Tage-Woche verletzt", () => {
    const r = minorWeekViolations(week("2026-11-16", [300, 0, 300, 300, 300, 120]), minor);
    expect(codesOn(r, "2026-11-21")).toEqual(["JARBSCHG_FIVE_DAY_WEEK"]);
  });
  it("gilt nicht für Erwachsene", () => {
    expect(minorWeekViolations(week("2026-11-16", [600, 600, 600, 600, 600, 600]), adult).size).toBe(0);
  });
});

describe("MuSchG – Doppelwoche", () => {
  const mother = { ...adult, maternityProtection: true };
  it("2 × 5 × 8,5 h = 85 h ok, 2 × 5 × 9,1 h > 90 h", () => {
    const ok = [...week("2026-11-09", [510, 510, 510, 510, 510]), ...week("2026-11-16", [510, 510, 510, 510, 510])];
    expect(maternityDoubleWeekViolations(ok, mother).size).toBe(0);
    const tooMuch = [...week("2026-11-09", [546, 546, 546, 546, 546]), ...week("2026-11-16", [546, 546, 546, 546, 546])];
    expect(codesOn(maternityDoubleWeekViolations(tooMuch, mother), "2026-11-20")).toEqual(["MUSCHG_DOUBLE_WEEK_MAX"]);
  });
});

describe("§ 3 ArbZG – 6-Monats-Durchschnitt", () => {
  const holidays = holidayMap("NW", 2026);
  function history(minutesPerWerktag: number, to: string): DayRecord[] {
    const out: DayRecord[] = [];
    for (let k = addDaysKey(to, -190); k <= to; k = addDaysKey(k, 1)) {
      out.push(day(k, weekdayOf(k) <= 5 && !holidays.has(k) ? minutesPerWerktag : 0));
    }
    return out;
  }
  it("5 × 9,5 h pro Woche liegt dank freiem Samstag unter 8 h je Werktag", () => {
    const avg = sixMonthAverage(history(570, "2026-11-16"), "2026-11-16", holidays);
    expect(avg.averageMin).toBeLessThanOrEqual(480);
    expect(avg.withinLimit).toBe(true);
  });
  it("dauerhaft 10 h an 5 Tagen ist zu viel", () => {
    const days = history(600, "2026-11-16");
    const avg = sixMonthAverage(days, "2026-11-16", holidays);
    expect(avg.withinLimit).toBe(false);
    expect(avg.excessMin).toBeGreaterThan(0);
    expect(codesOn(averageViolations(days, ["2026-11-16"], holidays, adult), "2026-11-16")).toEqual(["ARBZG_AVERAGE_EXCEEDED"]);
  });
});

describe("§ 11 ArbZG – Ersatzruhetag & freie Sonntage", () => {
  const none = new Map<string, string>();
  it("Sonntag gearbeitet, freier Samstag danach → ok", () => {
    const days = [day("2026-11-01", 300), ...week("2026-11-02", [480, 480, 480, 480, 480, 0])];
    expect(replacementRestViolations(days, "2026-11-30", none).size).toBe(0);
  });
  it("Sonntag gearbeitet und 2 Wochen lang jeden Werktag → Verstoß", () => {
    const days = [day("2026-11-01", 300), ...week("2026-11-02", [480, 480, 480, 480, 480, 480]), ...week("2026-11-09", [480, 480, 480, 480, 480, 480])];
    expect(codesOn(replacementRestViolations(days, "2026-11-30", none), "2026-11-01")).toEqual(["ARBZG_REPLACEMENT_REST_MISSING"]);
  });
  it("Frist läuft noch → noch kein Verstoß", () => {
    const days = [day("2026-11-15", 300), ...week("2026-11-16", [480, 480, 480])];
    expect(replacementRestViolations(days, "2026-11-18", none).size).toBe(0);
  });
  it("mehr als 37 Sonntage im Jahr", () => {
    const sundays: DayRecord[] = [];
    for (let k = "2026-01-04"; k <= "2026-12-31"; k = addDaysKey(k, 7)) sundays.push(day(k, 240));
    const r = sundaysOffViolations(sundays);
    expect([...r.values()].flat().map((v) => v.code)).toEqual(["ARBZG_SUNDAYS_OFF"]);
  });
});

describe("§ 17 MiLoG – Aufzeichnungsfrist", () => {
  const mini = { ...adult, contractType: "minijob" as const };
  it("fehlende Aufzeichnung nach 7 Tagen", () => {
    const r = milogViolations([day("2026-11-05", 0, { targetMin: 270 })], "2026-11-16", mini, false);
    expect(codesOn(r, "2026-11-05")).toEqual(["MILOG_RECORD_MISSING"]);
  });
  it("innerhalb der Frist oder mit Abwesenheit → ok", () => {
    expect(milogViolations([day("2026-11-12", 0)], "2026-11-16", mini, false).size).toBe(0);
    expect(milogViolations([day("2026-11-05", 0, { hasAbsence: true })], "2026-11-16", mini, false).size).toBe(0);
  });
  it("verspätet erfasst", () => {
    const r = milogViolations([day("2026-11-01", 240, { firstReceivedAt: new Date("2026-11-12T10:00:00Z") })], "2026-11-16", mini, false);
    expect(codesOn(r, "2026-11-01")).toEqual(["MILOG_RECORD_LATE"]);
  });
  it("nur für Minijobs – außer die Firma prüft alle", () => {
    expect(milogViolations([day("2026-11-05", 0)], "2026-11-16", adult, false).size).toBe(0);
    expect(milogViolations([day("2026-11-05", 0)], "2026-11-16", adult, true).size).toBe(1);
  });
});
