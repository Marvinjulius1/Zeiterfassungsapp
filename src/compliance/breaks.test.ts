import { describe, expect, it } from "vitest";
import { breakStatus, countableBreakMinutes, requiredBreakMinutes } from "./breaks";

const H = 3600;
const M = 60;

describe("requiredBreakMinutes – § 4 ArbZG", () => {
  it.each([
    [360, 0], // genau 6 h: noch keine Pflicht
    [361, 30],
    [540, 30], // genau 9 h
    [541, 45],
  ])("%i Min. Arbeit → %i Min. Pause", (net, req) => {
    expect(requiredBreakMinutes(net)).toBe(req);
  });
});

describe("requiredBreakMinutes – § 11 JArbSchG", () => {
  it.each([
    [270, 0], // 4,5 h
    [271, 30],
    [360, 30],
    [361, 60],
  ])("Jugendliche: %i Min. → %i Min.", (net, req) => {
    expect(requiredBreakMinutes(net, true)).toBe(req);
  });
});

describe("countableBreakMinutes", () => {
  it("zählt nur Blöcke ab 15 Minuten", () => {
    expect(countableBreakMinutes([10 * M, 15 * M, 20 * M])).toBe(35);
    expect(countableBreakMinutes([14 * M + 59])).toBe(0);
  });
});

describe("breakStatus", () => {
  const base = { breakBlocks: [], currentBreakSeconds: 0, isMinor: false };

  it("weit weg von jeder Grenze → ok", () => {
    expect(breakStatus({ ...base, netSeconds: 2 * H, secondsSinceLastBreak: 2 * H }).kind).toBe("ok");
  });

  it("„Pause fällig in 12 Min.“ kurz vor 6 h", () => {
    const s = breakStatus({ ...base, netSeconds: 5 * H + 48 * M, secondsSinceLastBreak: 5 * H + 48 * M });
    expect(s).toEqual({ kind: "due_soon", inMinutes: 12, needMinutes: 30, reason: "total" });
  });

  it("über 6 h ohne Pause → überfällig", () => {
    const s = breakStatus({ ...base, netSeconds: 6 * H + 5 * M, secondsSinceLastBreak: 6 * H + 5 * M });
    expect(s).toEqual({ kind: "overdue", missingMinutes: 30, reason: "total" });
  });

  it("zwei 10-Minuten-Pausen zählen nicht", () => {
    const s = breakStatus({ ...base, netSeconds: 6.5 * H, breakBlocks: [10 * M, 10 * M], secondsSinceLastBreak: 1 * H });
    expect(s.kind).toBe("overdue");
  });

  it("30 Min. Pause genommen → ok bis 9 h", () => {
    const s = breakStatus({ ...base, netSeconds: 7 * H, breakBlocks: [30 * M], secondsSinceLastBreak: 3 * H });
    expect(s.kind).toBe("ok");
  });

  it("kurz vor 9 h mit nur 30 Min. → 15 Min. mehr nötig", () => {
    const s = breakStatus({ ...base, netSeconds: 8 * H + 30 * M, breakBlocks: [30 * M], secondsSinceLastBreak: 4 * H });
    expect(s).toEqual({ kind: "due_soon", inMinutes: 30, needMinutes: 15, reason: "total" });
  });

  it("mehr als 6 h am Stück → überfällig, auch wenn Gesamtpause reicht", () => {
    const s = breakStatus({ ...base, netSeconds: 8 * H, breakBlocks: [30 * M], secondsSinceLastBreak: 6 * H + 1 * M });
    expect(s).toEqual({ kind: "overdue", missingMinutes: 15, reason: "continuous" });
  });

  it("laufende Pause ≥ 15 Min. zählt bereits", () => {
    const s = breakStatus({ ...base, netSeconds: 6.5 * H, currentBreakSeconds: 30 * M, secondsSinceLastBreak: 0 });
    expect(s.kind).toBe("ok");
  });

  it("während der Pause keine „bald fällig“-Hinweise", () => {
    const s = breakStatus({ ...base, netSeconds: 5.9 * H, currentBreakSeconds: 5 * M, secondsSinceLastBreak: 0 });
    expect(s.kind).toBe("ok");
  });

  it("Jugendliche: Pause fällig nach 4,5 h", () => {
    const s = breakStatus({ ...base, isMinor: true, netSeconds: 4 * H + 20 * M, secondsSinceLastBreak: 4 * H + 20 * M });
    expect(s).toMatchObject({ kind: "due_soon", inMinutes: 10, needMinutes: 30 });
  });
});
