import { describe, expect, it } from "vitest";
import { canStamp } from "./can-stamp";
import { evaluateDay, type DayContext } from "./evaluate-day";
import { DEFAULT_RULES, resolveRules } from "./rules/schema";
import { localTime } from "./time";
import type { TimeEvent, WorkerProfile } from "./types";

const D = "2026-11-16";
const t = (hh: number, mm = 0, day = D) => localTime(day, hh, mm);
const ev = (kind: TimeEvent["kind"], hh: number, mm = 0): TimeEvent => ({ kind, at: t(hh, mm) });
const adult: WorkerProfile = { isMinor: false, maternityProtection: false, contractType: "full_time", schoolDays: [], trustBasedHours: false };
const minor: WorkerProfile = { ...adult, isMinor: true };
const base: DayContext = { date: D, events: [], now: t(22), profile: adult, rules: DEFAULT_RULES, holidays: new Map(), targetMinutes: 480 };
const codes = (v: { code: string }[]) => v.map((x) => x.code);

describe("evaluateDay", () => {
  it("normaler Tag ohne Befund", () => {
    const r = evaluateDay({ ...base, events: [ev("check_in", 8), ev("break_start", 12), ev("break_end", 12, 30), ev("check_out", 16, 30)] });
    expect(r).toMatchObject({ grossMin: 510, breakMin: 30, netMin: 480, valuedMin: 480, autoBreakMin: 0, open: false });
    expect(r.violations).toEqual([]);
  });

  it("Rundung + automatischer Pausenabzug wirken nur auf die bewertete Zeit", () => {
    const rules = resolveRules({ rounding: { mode: "employee_favor", unitMin: 15 }, autoBreak: { enabled: true } });
    const r = evaluateDay({ ...base, rules, events: [ev("check_in", 7, 58), ev("check_out", 15, 2)] });
    expect(r.netMin).toBe(424); // Rohzeit bleibt
    expect(r.valuedMin).toBe(450 - 30); // 7:45–15:15 gerundet, minus 30 Min. Pause
    expect(codes(r.violations)).toEqual(["ARBZG_BREAK_TOO_SHORT", "ARBZG_CONTINUOUS_WORK", "RULE_AUTO_BREAK_DEDUCTED"]);
  });

  it("offener Tag: keine Pausen-Verstöße, kein Auto-Abzug", () => {
    const r = evaluateDay({ ...base, now: t(15), events: [ev("check_in", 8)] });
    expect(r.open).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.netMin).toBe(420);
  });

  it("10,5 h + zu kurze Ruhezeit", () => {
    const r = evaluateDay({
      ...base,
      previousEnd: t(23, 0, "2026-11-15"),
      events: [ev("check_in", 6), ev("break_start", 11), ev("break_end", 11, 45), ev("check_out", 17, 15)],
    });
    expect(codes(r.violations)).toEqual(["ARBZG_DAILY_OVER_10", "ARBZG_REST_PERIOD"]);
  });

  it("Jugendlicher: 7,5 h mit nur 30 Min. Pause → 60 Min. wären Pflicht", () => {
    const r = evaluateDay({ ...base, profile: minor, events: [ev("check_in", 10), ev("break_start", 13), ev("break_end", 13, 30), ev("check_out", 18)] });
    expect(codes(r.violations)).toEqual(["JARBSCHG_BREAK"]);
  });

  it("Jugendlicher bis 21 Uhr → Nachtruhe", () => {
    const r = evaluateDay({ ...base, profile: minor, events: [ev("check_in", 13), ev("break_start", 16), ev("break_end", 17), ev("check_out", 21)] });
    expect(codes(r.violations)).toEqual(["JARBSCHG_NIGHT_REST"]);
  });
});

describe("vergessenes Ausstempeln", () => {
  it("vergangener Tag ohne Check-out → Hinweis statt Fantasie-Stunden", () => {
    const r = evaluateDay({ ...base, now: t(12, 0, "2026-11-20"), events: [ev("check_in", 8), ev("break_start", 12), ev("break_end", 12, 30)] });
    expect(r.netMin).toBe(0);
    expect(codes(r.violations)).toEqual(["RULE_MISSING_CHECK_OUT"]);
  });
});

describe("automatisches Auschecken", () => {
  it("markiert den Tag zur Prüfung", () => {
    const r = evaluateDay({ ...base, events: [ev("check_in", 8), ev("break_start", 12), ev("break_end", 12, 30), { kind: "check_out", at: t(16, 30), source: "system_auto" }] });
    expect(codes(r.violations)).toEqual(["RULE_AUTO_CHECKOUT"]);
  });
});

describe("canStamp", () => {
  const ctx = { kind: "check_in" as const, method: "app" as const, now: t(8), profile: adult, rules: DEFAULT_RULES, lastEnd: null, netTodayMin: 0 };

  it("normal erlaubt", () => {
    expect(canStamp(ctx)).toEqual({ allowed: true, blockReason: undefined, warnings: [] });
  });
  it("Ruhezeit unterschritten: Standard = Warnung", () => {
    const r = canStamp({ ...ctx, lastEnd: t(23, 0, "2026-11-15") });
    expect(r.allowed).toBe(true);
    expect(codes(r.warnings)).toEqual(["ARBZG_REST_PERIOD"]);
    expect(r.warnings[0].message).toBe("Deine Ruhezeit von 11 Stunden endet erst in 2:00 h.");
  });
  it("Ruhezeit unterschritten: blockiert, wenn eingestellt", () => {
    const r = canStamp({ ...ctx, rules: resolveRules({ enforcement: { restPeriod: "block" } }), lastEnd: t(23, 0, "2026-11-15") });
    expect(r.allowed).toBe(false);
    expect(r.blockReason).toContain("Ruhezeit");
  });
  it("Jugendliche: Ruhezeit wird immer blockiert (außer „aus“)", () => {
    expect(canStamp({ ...ctx, profile: minor, lastEnd: t(22, 0, "2026-11-15") }).allowed).toBe(false);
  });
  it("Jugendliche: Nachtruhe", () => {
    expect(canStamp({ ...ctx, profile: minor, now: t(5, 30) }).allowed).toBe(false);
    expect(canStamp({ ...ctx, profile: minor, now: t(6, 0) }).allowed).toBe(true);
  });
  it("zu früh vor Schichtbeginn", () => {
    const rules = resolveRules({ checkIn: { earliestEnforcement: "block", earliestBeforeShiftMin: 15 } });
    const shift = { startsAt: t(9), endsAt: t(17) };
    expect(canStamp({ ...ctx, rules, shift, now: t(8, 30) }).allowed).toBe(false);
    expect(canStamp({ ...ctx, rules, shift, now: t(8, 50) }).allowed).toBe(true);
  });
  it("nicht erlaubter Erfassungsweg", () => {
    const rules = resolveRules({ methods: { allowed: ["terminal_qr"] } });
    expect(canStamp({ ...ctx, rules }).blockReason).toContain("Erfassungsweg");
  });
  it("Geofence-Pflicht", () => {
    const rules = resolveRules({ methods: { requireGeofence: true } });
    expect(canStamp({ ...ctx, rules, insideGeofence: false }).allowed).toBe(false);
    expect(canStamp({ ...ctx, rules, insideGeofence: true }).allowed).toBe(true);
  });
  it("Auschecken wird nie blockiert", () => {
    const rules = resolveRules({ enforcement: { restPeriod: "block", dailyMax: "block" } });
    expect(canStamp({ ...ctx, kind: "check_out", rules, netTodayMin: 700 }).allowed).toBe(true);
  });
});
