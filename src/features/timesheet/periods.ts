import {
  berlinDateKey, daysInRange, formatDayLong, formatMonth, isoWeekRange, monthRange, parseDateKey, shiftDays, type DateRange,
} from "@/lib/time/berlin";

export type View = "day" | "week" | "month";
export const VIEWS: readonly View[] = ["day", "week", "month"];

export function parseView(v: unknown): View {
  return v === "day" || v === "month" ? v : "week";
}

export function parseDate(v: unknown): string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parseDateKey(v).getTime())
    ? v
    : berlinDateKey();
}

export function rangeFor(view: View, date: string): DateRange {
  if (view === "day") return { from: date, to: date };
  if (view === "week") return isoWeekRange(date);
  return monthRange(date);
}

/** Datum für „zurück"/„vor" je Ansicht */
export function stepDate(view: View, date: string, dir: -1 | 1): string {
  if (view === "day") return shiftDays(date, dir);
  if (view === "week") return shiftDays(date, 7 * dir);
  const d = parseDateKey(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1, 12));
  return target.toISOString().slice(0, 10);
}

/** ISO-Kalenderwoche */
export function isoWeekNumber(key: string): number {
  const d = parseDateKey(key);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // Donnerstag der Woche
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function periodLabel(view: View, date: string): string {
  if (view === "day") return formatDayLong(date);
  if (view === "month") return formatMonth(date);
  const r = isoWeekRange(date);
  const [, fm, fd] = r.from.split("-");
  const [, tm, td] = r.to.split("-");
  return `KW ${isoWeekNumber(date)} · ${Number(fd)}.${fm === tm ? "" : `${Number(fm)}.`}–${Number(td)}.${Number(tm)}.`;
}

export { daysInRange };
