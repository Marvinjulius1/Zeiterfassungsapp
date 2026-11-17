import { describe, expect, it } from "vitest";
import { absenceWorkdays, spansOverlap, vacationBalance } from "./absences";
import { holidayMap } from "./holidays";
import { weekdayOf } from "./time";

const nw = holidayMap("NW", 2026);
const monFri = (d: string) => weekdayOf(d) <= 5 && !nw.has(d);

describe("absenceWorkdays", () => {
  it("eine Woche Urlaub = 5 Tage", () => {
    expect(absenceWorkdays({ start: "2026-11-16", end: "2026-11-22" }, monFri)).toBe(5);
  });
  it("Feiertage kosten keinen Urlaub (Weihnachten in NRW)", () => {
    expect(absenceWorkdays({ start: "2026-12-21", end: "2027-01-01" }, (d) => weekdayOf(d) <= 5 && !holidayMap("NW", 2026, 2027).has(d))).toBe(8);
  });
  it("halbe Tage", () => {
    expect(absenceWorkdays({ start: "2026-11-16", end: "2026-11-17", halfDayStart: true }, monFri)).toBe(1.5);
    expect(absenceWorkdays({ start: "2026-11-16", end: "2026-11-16", halfDayStart: true, halfDayEnd: true }, monFri)).toBe(0.5);
  });
  it("Teilzeit: nur die Vertragstage zählen", () => {
    const monWed = (d: string) => [1, 3].includes(weekdayOf(d));
    expect(absenceWorkdays({ start: "2026-11-16", end: "2026-11-22" }, monWed)).toBe(2);
  });
  it("ungültiger Zeitraum", () => {
    expect(absenceWorkdays({ start: "2026-11-20", end: "2026-11-16" }, monFri)).toBe(0);
  });
});

describe("Überschneidung", () => {
  it("inklusive Grenzen", () => {
    expect(spansOverlap({ start: "2026-11-16", end: "2026-11-18" }, { start: "2026-11-18", end: "2026-11-20" })).toBe(true);
    expect(spansOverlap({ start: "2026-11-16", end: "2026-11-17" }, { start: "2026-11-18", end: "2026-11-20" })).toBe(false);
  });
});

describe("vacationBalance", () => {
  it("rechnet genommen, geplant, beantragt", () => {
    const b = vacationBalance(28, 3, [
      { start: "2026-08-03", end: "2026-08-14", status: "approved", days: 10 },
      { start: "2026-12-21", end: "2026-12-24", status: "approved", days: 4 },
      { start: "2026-12-28", end: "2026-12-30", status: "pending", days: 3 },
    ], "2026-11-17");
    expect(b).toMatchObject({ taken: 10, planned: 4, pending: 3, remaining: 17, remainingAfterPending: 14 });
  });
});

import { absenceEffect, computeBalance } from "./absences";

describe("computeBalance", () => {
  const target = (d: string) => (weekdayOf(d) <= 5 ? 480 : 0);
  const base = { from: "2026-11-16", to: "2026-11-20", targetOn: target, absenceOn: () => null };

  it("volle Woche gearbeitet + 1 h Überstunden", () => {
    const valued = new Map([["2026-11-16", 540], ["2026-11-17", 480], ["2026-11-18", 480], ["2026-11-19", 480], ["2026-11-20", 480]]);
    expect(computeBalance({ ...base, valued }).minutes).toBe(60);
  });
  it("fehlender Tag ohne Abwesenheit = Minus", () => {
    const valued = new Map([["2026-11-16", 480], ["2026-11-17", 480], ["2026-11-18", 480], ["2026-11-19", 480]]);
    expect(computeBalance({ ...base, valued }).minutes).toBe(-480);
  });
  it("Urlaub und Krankheit gelten als erfüllt", () => {
    const valued = new Map([["2026-11-16", 480], ["2026-11-17", 480], ["2026-11-18", 480]]);
    const r = computeBalance({ ...base, valued, absenceOn: (d) => (d >= "2026-11-19" ? { effect: absenceEffect("vacation"), half: false } : null) });
    expect(r.minutes).toBe(0);
  });
  it("Überstundenabbau zieht vom Konto ab", () => {
    const r = computeBalance({ ...base, from: "2026-11-16", to: "2026-11-16", valued: new Map(), absenceOn: () => ({ effect: absenceEffect("comp_time"), half: false }) });
    expect(r.minutes).toBe(-480);
  });
  it("unbezahlt: kein Soll, kein Minus", () => {
    const r = computeBalance({ ...base, from: "2026-11-16", to: "2026-11-16", valued: new Map(), absenceOn: () => ({ effect: absenceEffect("unpaid"), half: false }) });
    expect(r.minutes).toBe(0);
  });
  it("halber Urlaubstag + 4 h gearbeitet", () => {
    const r = computeBalance({ ...base, from: "2026-11-16", to: "2026-11-16", valued: new Map([["2026-11-16", 240]]), absenceOn: () => ({ effect: "credit", half: true }) });
    expect(r.minutes).toBe(0);
  });
  it("manuelle Buchungen (z. B. Auszahlung)", () => {
    expect(computeBalance({ ...base, from: "2026-11-21", to: "2026-11-21", valued: new Map(), adjustments: -600 }).minutes).toBe(-600);
  });
});
