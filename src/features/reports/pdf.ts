import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatTime } from "@/lib/time/berlin";
import { dateDe, hhmm, hoursDe } from "./export-core";
import type { MonthReport } from "./month-report";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.42, 0.42, 0.45);
const LINE = rgb(0.86, 0.86, 0.88);
const SHADE = rgb(0.965, 0.965, 0.97);
const RED = rgb(0.79, 0.15, 0.11);

/** Standard-PDF-Schriften kennen nur WinAnsi – alles andere ersetzen statt abstürzen. */
export function pdfSafe(s: string): string {
  return s
    .replace(/[−–—]/g, (c) => (c === "−" ? "-" : "–"))
    .replace(/[✓✔]/g, "OK")
    .replace(/[→⟶]/g, "->")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[^\x20-\x7E -ÿ–—‘-„•…€]/g, "?");
}

export function monthTitle(month: string) {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

export async function renderTimesheetPdf(r: MonthReport, opts: { generatedAt?: Date } = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Stundenzettel ${r.name} ${monthTitle(r.month)}`);
  pdf.setAuthor(r.orgName);
  pdf.setCreator("Zeitgeist");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const M = 40;
  let y = 800;

  const text = (p: PDFPage, s: string, x: number, yy: number, size = 9, f: PDFFont = font, color = BLACK, align: "left" | "right" = "left") => {
    const t = pdfSafe(s);
    const w = f.widthOfTextAtSize(t, size);
    p.drawText(t, { x: align === "right" ? x - w : x, y: yy, size, font: f, color });
  };

  // Kopf
  text(page, "zeitgeist.", M, y, 12, bold);
  text(page, r.orgName, 595.28 - M, y, 9, font, GREY, "right");
  y -= 34;
  text(page, `Stundenzettel ${monthTitle(r.month)}`, M, y, 20, bold);
  y -= 22;
  const meta = [r.name, r.employeeNo ? `Pers.-Nr. ${r.employeeNo}` : null, r.locationName, r.weeklyMinutes != null ? `${hoursDe(r.weeklyMinutes)} h/Woche` : null]
    .filter(Boolean)
    .join("  ·  ");
  text(page, meta, M, y, 10, font, GREY);
  y -= 26;

  // Tabelle
  const cols = [
    { label: "Tag", x: M, align: "left" as const },
    { label: "Beginn", x: M + 82, align: "left" as const },
    { label: "Ende", x: M + 122, align: "left" as const },
    { label: "Pause", x: M + 190, align: "right" as const },
    { label: "Ist", x: M + 232, align: "right" as const },
    { label: "Soll", x: M + 272, align: "right" as const },
    { label: "+/-", x: M + 312, align: "right" as const },
    { label: "Bemerkung", x: M + 326, align: "left" as const },
  ];
  for (const c of cols) text(page, c.label, c.x, y, 8, bold, GREY, c.align);
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: 595.28 - M, y }, thickness: 0.8, color: BLACK });
  y -= 13;

  const rowH = 15.2;
  for (const d of r.days) {
    if (d.weekday >= 6 || d.note.includes("Feiertag") || (d.targetMinutes === 0 && !d.valuedMinutes)) {
      page.drawRectangle({ x: M, y: y - 4, width: 595.28 - 2 * M, height: rowH, color: SHADE });
    }
    const cells = [
      `${WD[d.weekday - 1]} ${dateDe(d.date).slice(0, 6)}`,
      d.firstIn ? formatTime(d.firstIn) : "",
      d.lastOut ? formatTime(d.lastOut) : d.firstIn ? "–" : "",
      d.breakMinutes ? hhmm(d.breakMinutes) : "",
      d.valuedMinutes || d.creditMinutes ? hhmm(d.valuedMinutes + d.creditMinutes) : "",
      d.targetMinutes ? hhmm(d.targetMinutes) : "",
      d.diffMinutes ? hhmm(d.diffMinutes) : "",
      d.note,
    ];
    cells.forEach((c, i) => {
      const col = cols[i];
      const color = i === 6 && d.diffMinutes < 0 ? RED : i === 7 && c.includes("fehlt") ? RED : BLACK;
      const maxNote = 595.28 - M - col.x;
      let s = c;
      while (i === 7 && s && font.widthOfTextAtSize(pdfSafe(s), 8.5) > maxNote) s = s.slice(0, -2) + "…";
      text(page, s, col.x, y, i === 7 ? 8.5 : 9, font, color, col.align);
    });
    y -= rowH;
  }
  page.drawLine({ start: { x: M, y: y + 9 }, end: { x: 595.28 - M, y: y + 9 }, thickness: 0.8, color: BLACK });

  // Summen
  y -= 14;
  const t = r.totals;
  const sums: [string, string][] = [
    ["Gearbeitet (bewertet)", `${hhmm(t.valued)} h`],
    ["Gutschrift Urlaub/Krankheit u. a.", `${hhmm(t.credit)} h`],
    ["Soll", `${hhmm(t.target)} h`],
    ["Saldo dieser Monat", `${hhmm(t.diff)} h`],
    ["Stundenkonto zum Monatsende", `${hhmm(t.balanceEnd)} h`],
  ];
  const sums2: [string, string][] = [
    ["Urlaub", `${String(t.vacationDays).replace(".", ",")} Tage`],
    ["Krankheit", `${String(t.sickDays).replace(".", ",")} Tage`],
    ["Nachtarbeit", `${hhmm(t.night)} h`],
    ["Sonntagsarbeit", `${hhmm(t.sunday)} h`],
    ["Feiertagsarbeit", `${hhmm(t.holiday)} h`],
  ];
  sums.forEach(([l, v], i) => {
    text(page, l, M, y - i * 14, 9.5, i >= 3 ? bold : font);
    text(page, v, M + 250, y - i * 14, 9.5, i >= 3 ? bold : font, i >= 3 && v.startsWith("-") ? RED : BLACK, "right");
  });
  sums2.forEach(([l, v], i) => {
    text(page, l, M + 300, y - i * 14, 9.5, font, GREY);
    text(page, v, 595.28 - M, y - i * 14, 9.5, font, BLACK, "right");
  });
  y -= 5 * 14 + 12;
  if (t.incompleteDays > 0) {
    text(page, `Achtung: ${t.incompleteDays} Tag(e) ohne Ausstempeln – bitte vor dem Abschluss korrigieren.`, M, y, 9, bold, RED);
    y -= 16;
  }

  // Bestätigung / Unterschrift
  y = Math.min(y, 120);
  const fmt = (iso: string) => new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
  const sig = (x: number, label: string, done?: string | null) => {
    if (done) {
      text(page, done, x, y, 9, bold);
    } else {
      page.drawLine({ start: { x, y: y - 2 }, end: { x: x + 220, y: y - 2 }, thickness: 0.6, color: LINE });
    }
    text(page, label, x, y - 14, 8, font, GREY);
  };
  sig(M, "Mitarbeiter:in", r.closing?.confirmedAt ? `Digital bestätigt am ${fmt(r.closing.confirmedAt)}` : null);
  sig(595.28 - M - 220, "Arbeitgeber", r.closing?.lockedAt ? `Abgeschlossen am ${fmt(r.closing.lockedAt)}` : null);

  const at = (opts.generatedAt ?? new Date()).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
  text(page, `Erstellt mit Zeitgeist am ${at} · Zeiten in Europe/Berlin · Aufzeichnung nach § 16 Abs. 2 ArbZG / § 17 MiLoG`, M, 28, 7, font, GREY);
  return pdf.save();
}
