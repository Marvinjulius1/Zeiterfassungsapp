import "server-only";
import ExcelJS from "exceljs";
import { formatTime } from "@/lib/time/berlin";
import type { MonthReport } from "./month-report";
import { monthTitle } from "./pdf";

const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const h = (min: number) => Math.round((min / 60) * 100) / 100;

/** Excel-Arbeitsmappe: Übersicht je Person + alle Tage (Stunden als echte Zahlen) */
export async function renderXlsx(reports: MonthReport[], orgName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Zeitgeist";
  wb.created = new Date();
  const title = reports[0] ? monthTitle(reports[0].month) : "";

  const sum = wb.addWorksheet("Übersicht", { views: [{ state: "frozen", ySplit: 1 }] });
  sum.columns = [
    { header: "Pers.-Nr.", key: "no", width: 11 },
    { header: "Name", key: "name", width: 24 },
    { header: "Standort", key: "loc", width: 14 },
    { header: "Ist (h)", key: "valued", width: 10 },
    { header: "Gutschrift (h)", key: "credit", width: 13 },
    { header: "Soll (h)", key: "target", width: 10 },
    { header: "Saldo Monat (h)", key: "diff", width: 15 },
    { header: "Stundenkonto (h)", key: "balance", width: 16 },
    { header: "Urlaub (Tage)", key: "vac", width: 13 },
    { header: "Krank (Tage)", key: "sick", width: 12 },
    { header: "Nacht (h)", key: "night", width: 10 },
    { header: "Sonntag (h)", key: "sunday", width: 11 },
    { header: "Feiertag (h)", key: "holiday", width: 11 },
    { header: "Status", key: "status", width: 14 },
  ];
  for (const r of reports) {
    const t = r.totals;
    sum.addRow({
      no: r.employeeNo ?? "", name: r.name, loc: r.locationName ?? "",
      valued: h(t.valued), credit: h(t.credit), target: h(t.target), diff: h(t.diff), balance: h(t.balanceEnd),
      vac: t.vacationDays, sick: t.sickDays, night: h(t.night), sunday: h(t.sunday), holiday: h(t.holiday),
      status: r.closing?.lockedAt ? "abgeschlossen" : r.closing?.confirmedAt ? "bestätigt" : "offen",
    });
  }

  const days = wb.addWorksheet("Tage", { views: [{ state: "frozen", ySplit: 1 }] });
  days.columns = [
    { header: "Pers.-Nr.", key: "no", width: 11 },
    { header: "Name", key: "name", width: 24 },
    { header: "Datum", key: "date", width: 12 },
    { header: "Tag", key: "wd", width: 5 },
    { header: "Beginn", key: "from", width: 8 },
    { header: "Ende", key: "to", width: 8 },
    { header: "Pause (h)", key: "break", width: 10 },
    { header: "Ist (h)", key: "valued", width: 9 },
    { header: "Gutschrift (h)", key: "credit", width: 13 },
    { header: "Soll (h)", key: "target", width: 9 },
    { header: "Saldo (h)", key: "diff", width: 9 },
    { header: "Nacht (h)", key: "night", width: 10 },
    { header: "Sonntag (h)", key: "sunday", width: 11 },
    { header: "Feiertag (h)", key: "holiday", width: 11 },
    { header: "Bemerkung", key: "note", width: 30 },
  ];
  for (const r of reports) {
    for (const d of r.days) {
      if (!d.targetMinutes && !d.valuedMinutes && !d.creditMinutes && !d.note) continue;
      days.addRow({
        no: r.employeeNo ?? "", name: r.name, date: new Date(`${d.date}T12:00:00Z`), wd: WD[d.weekday - 1],
        from: d.firstIn ? formatTime(d.firstIn) : "", to: d.lastOut ? formatTime(d.lastOut) : "",
        break: h(d.breakMinutes), valued: h(d.valuedMinutes), credit: h(d.creditMinutes), target: h(d.targetMinutes), diff: h(d.diffMinutes),
        night: h(d.night), sunday: h(d.sunday), holiday: h(d.holiday), note: d.note,
      });
    }
  }
  days.getColumn("date").numFmt = "dd.mm.yyyy";
  for (const ws of [sum, days]) {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F4" } };
    ws.columns.forEach((c) => {
      if (/\(h\)|\(Tage\)/.test(String(c.header))) c.numFmt = "0.00";
    });
  }
  wb.title = `${orgName} – Zeiten ${title}`;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
