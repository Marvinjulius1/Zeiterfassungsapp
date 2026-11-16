import { describe, expect, it } from "vitest";
import { summarizeDay, type DayEvent } from "./day-state";
import { buildHints } from "./hints";

const ev = (kind: DayEvent["kind"], hhmm: string): DayEvent => ({ id: kind + hhmm, kind, occurredAt: `2026-11-16T${hhmm}:00.000Z` });
const at = (hhmm: string) => new Date(`2026-11-16T${hhmm}:00.000Z`);

function hints(events: DayEvent[], now: string, extra: Partial<Parameters<typeof buildHints>[0]> = {}) {
  const n = at(now);
  return buildHints({ summary: summarizeDay(events, n), now: n, isMinor: false, targetMinutes: 480, weekMinutesBefore: 0, ...extra });
}

describe("buildHints", () => {
  it("frischer Morgen: keine Hinweise", () => {
    expect(hints([ev("check_in", "07:00")], "08:00")).toEqual([]);
  });

  it("Pause bald fällig", () => {
    const h = hints([ev("check_in", "07:00")], "12:48");
    expect(h[0]).toMatchObject({ id: "break-due", tone: "pause", title: "Gesetzliche Pause fällig in 12 Min." });
  });

  it("Pause überfällig", () => {
    expect(hints([ev("check_in", "07:00")], "13:10")[0]).toMatchObject({ id: "break-overdue", tone: "alert" });
  });

  it("Abend-Zusammenfassung mit eingehaltenen Pausen", () => {
    const h = hints(
      [ev("check_in", "07:00"), ev("break_start", "11:00"), ev("break_end", "11:30"), ev("check_out", "15:22")],
      "20:00",
    );
    expect(h[0]).toMatchObject({ id: "summary", tone: "ok", title: "7:52 h gearbeitet · Pausen eingehalten ✓" });
    expect(h[0].body).toBe("−0:08 h gegenüber deinem Soll.");
  });

  it("Abend-Zusammenfassung ohne Pause", () => {
    const h = hints([ev("check_in", "07:00"), ev("check_out", "14:00")], "20:00");
    expect(h[0]).toMatchObject({ id: "summary", tone: "alert", title: "7:00 h gearbeitet · Pause zu kurz" });
  });

  it("Wochenhinweis ab 44 h", () => {
    const h = hints([ev("check_in", "07:00")], "09:00", { weekMinutesBefore: 42 * 60 });
    expect(h.some((x) => x.id === "week" && x.title === "Du hast diese Woche schon 44 h.")).toBe(true);
  });

  it("Jugendliche: 40-h-Woche", () => {
    const h = hints([ev("check_in", "07:00")], "08:00", { isMinor: true, weekMinutesBefore: 39 * 60 + 30 });
    expect(h.find((x) => x.id === "week-minor")?.tone).toBe("alert");
  });

  it("über 10 h → Höchstgrenze", () => {
    const h = hints([ev("check_in", "05:00"), ev("break_start", "09:00"), ev("break_end", "09:45")], "15:50");
    expect(h.some((x) => x.id === "daily-max")).toBe(true);
  });
});
