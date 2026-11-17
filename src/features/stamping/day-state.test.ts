import { describe, expect, it } from "vitest";
import { allowedActions, nextState, summarizeDay, type DayEvent } from "./day-state";

const ev = (kind: DayEvent["kind"], hhmm: string): DayEvent => ({
  id: `${kind}-${hhmm}`,
  kind,
  occurredAt: `2026-11-16T${hhmm}:00.000Z`,
});
const at = (hhmm: string) => new Date(`2026-11-16T${hhmm}:00.000Z`);

describe("Zustandsautomat", () => {
  it("erlaubt nur gültige Aktionen", () => {
    expect(allowedActions("out")).toEqual(["check_in"]);
    expect(allowedActions("in")).toEqual(["break_start", "check_out"]);
    expect(allowedActions("break")).toEqual(["break_end", "check_out"]);
  });
  it("wirft bei ungültigem Übergang", () => {
    expect(() => nextState("out", "break_start")).toThrow();
    expect(nextState("break", "check_out")).toBe("out");
  });
});

describe("summarizeDay", () => {
  it("leerer Tag", () => {
    const s = summarizeDay([], at("12:00"));
    expect(s.state).toBe("out");
    expect(s.netSeconds).toBe(0);
  });

  it("laufender Tag zählt bis jetzt", () => {
    const s = summarizeDay([ev("check_in", "07:00")], at("09:30"));
    expect(s.state).toBe("in");
    expect(s.netSeconds).toBe(2.5 * 3600);
    expect(s.secondsSinceLastBreak).toBe(2.5 * 3600);
  });

  it("zieht Pausen ab – auch laufende", () => {
    const s = summarizeDay([ev("check_in", "07:00"), ev("break_start", "11:00")], at("11:10"));
    expect(s.state).toBe("break");
    expect(s.grossSeconds).toBe(4 * 3600 + 600);
    expect(s.breakSeconds).toBe(600);
    expect(s.netSeconds).toBe(4 * 3600);
    expect(s.breakStart?.toISOString()).toBe(at("11:00").toISOString());
  });

  it("vollständiger Tag", () => {
    const s = summarizeDay(
      [ev("check_in", "07:00"), ev("break_start", "11:00"), ev("break_end", "11:30"), ev("check_out", "15:52")],
      at("20:00"),
    );
    expect(s.state).toBe("out");
    expect(s.netSeconds).toBe(8 * 3600 + 22 * 60);
    expect(s.breakBlocks).toEqual([1800]);
    expect(s.lastOut?.toISOString()).toBe(at("15:52").toISOString());
  });

  it("Auschecken in der Pause beendet die Pause", () => {
    const s = summarizeDay([ev("check_in", "07:00"), ev("break_start", "11:00"), ev("check_out", "11:20")], at("12:00"));
    expect(s.state).toBe("out");
    expect(s.breakSeconds).toBe(1200);
    expect(s.netSeconds).toBe(4 * 3600);
  });

  it("mehrere Blöcke am Tag", () => {
    const s = summarizeDay(
      [ev("check_in", "07:00"), ev("check_out", "09:00"), ev("check_in", "10:00"), ev("check_out", "12:00")],
      at("13:00"),
    );
    expect(s.netSeconds).toBe(4 * 3600);
    expect(s.firstIn?.toISOString()).toBe(at("07:00").toISOString());
  });

  it("Arbeit seit letzter Pause", () => {
    const s = summarizeDay([ev("check_in", "07:00"), ev("break_start", "10:00"), ev("break_end", "10:15")], at("12:15"));
    expect(s.secondsSinceLastBreak).toBe(2 * 3600);
  });

  it("vergessenes Ausstempeln: nach 16 h gilt der Block als beendet", () => {
    const s = summarizeDay([ev("check_in", "07:00")], new Date("2026-11-17T00:30:00Z"));
    expect(s.state).toBe("out");
    expect(s.netSeconds).toBe(0);
  });

  it("ignoriert ungültige Folgen und unsortierte Eingaben", () => {
    const s = summarizeDay([ev("check_out", "12:00"), ev("break_end", "08:00"), ev("check_in", "08:00")], at("13:00"));
    expect(s.netSeconds).toBe(4 * 3600);
  });
});
