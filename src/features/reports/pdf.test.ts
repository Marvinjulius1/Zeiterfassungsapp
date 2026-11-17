import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PDFDocument } from "pdf-lib";
import { pdfSafe, renderTimesheetPdf } from "./pdf";
import type { MonthReport } from "./month-report";

describe("pdfSafe", () => {
  it("ersetzt Zeichen außerhalb von WinAnsi", () => {
    expect(pdfSafe("−1:15 ✓ → 🎉")).toBe("-1:15 OK -> ");
    expect(pdfSafe("Größe · Äpfel – €")).toBe("Größe · Äpfel – €");
  });
});

describe("renderTimesheetPdf", () => {
  it("erzeugt ein gültiges einseitiges PDF – auch mit Umlauten und Sonderzeichen", async () => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const date = `2026-11-${String(i + 1).padStart(2, "0")}`;
      const wd = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
      const work = wd <= 5;
      return {
        date, weekday: wd,
        firstIn: work ? `${date}T07:00:00Z` : null, lastOut: work ? `${date}T15:30:00Z` : null,
        breakMinutes: work ? 30 : 0, netMinutes: work ? 480 : 0, valuedMinutes: work ? 480 : 0,
        targetMinutes: work ? 480 : 0, creditMinutes: 0, diffMinutes: 0,
        note: i === 0 ? "Allerheiligen · sehr lange Bemerkung die gekürzt werden muss, weil sie nicht passt 🎉" : "",
        night: 0, sunday: 0, holiday: 0,
      };
    });
    const r: MonthReport = {
      month: "2026-11-01", membershipId: "x", name: "Jürgen Weiß", employeeNo: "Z-001", orgName: "Bäckerei Größe GmbH",
      locationName: "Köln", weeklyMinutes: 2400, days,
      totals: { valued: 10080, net: 10080, target: 10080, credit: 0, diff: -75, balanceEnd: 754, vacationMinutes: 0, sickMinutes: 0, vacationDays: 1.5, sickDays: 0, night: 0, sunday: 0, holiday: 0, incompleteDays: 1 },
      closing: { confirmedAt: "2026-12-01T09:00:00Z", lockedAt: null },
    };
    const bytes = await renderTimesheetPdf(r, { generatedAt: new Date("2026-12-02T10:00:00Z") });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Stundenzettel Jürgen Weiß November 2026");
  });
});
