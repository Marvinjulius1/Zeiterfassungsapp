import { TZDate } from "@date-fns/tz";
import { addDays, endOfMonth, format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";

export const TZ = "Europe/Berlin";

/** Datum als „yyyy-MM-dd" in Berliner Zeit. */
export function berlinDateKey(d: Date = new Date()): string {
  return format(new TZDate(d, TZ), "yyyy-MM-dd");
}

/** „07:58" in Berliner Zeit. */
export function formatTime(d: Date | string): string {
  return format(new TZDate(new Date(d), TZ), "HH:mm");
}

/** Lokales Kalenderdatum aus „yyyy-MM-dd" (mittags, um DST-Kanten zu meiden). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function dateKeyFromParts(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function shiftDays(key: string, days: number): string {
  return dateKeyFromParts(addDays(parseDateKey(key), days));
}

export interface DateRange {
  from: string; // inklusive
  to: string; // inklusive
}

export function isoWeekRange(key: string): DateRange {
  const from = mondayOf(key);
  return { from, to: shiftDays(from, 6) };
}

/** Montag der ISO-Woche zu einem Datum. */
export function mondayOf(key: string): string {
  const d = parseDateKey(key);
  const iso = (d.getUTCDay() + 6) % 7; // 0 = Montag
  return shiftDays(key, -iso);
}

export function monthRange(key: string): DateRange {
  const d = parseDateKey(key);
  const from = startOfMonth(d);
  const to = endOfMonth(d);
  return {
    from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`,
    to: `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")}`,
  };
}

export function daysInRange(r: DateRange): string[] {
  const out: string[] = [];
  for (let k = r.from; k <= r.to; k = shiftDays(k, 1)) out.push(k);
  return out;
}

/** ISO-Wochentag 1 = Montag … 7 = Sonntag */
export function isoWeekday(key: string): number {
  return ((parseDateKey(key).getUTCDay() + 6) % 7) + 1;
}

const fmt = (key: string, pattern: string) => format(parseDateKey(key), pattern, { locale: de });

export const formatDayShort = (key: string) => fmt(key, "EEEEEE, dd.MM."); // „Mo, 10.11."
export const formatDayLong = (key: string) => fmt(key, "EEEE, d. MMMM"); // „Montag, 10. November"
export const formatWeekdayShort = (key: string) => fmt(key, "EEEEEE"); // „Mo"
export const formatMonth = (key: string) => fmt(key, "MMMM yyyy");

/** „Heute", „Morgen" oder „Mi, 19.11." */
export function relativeDayLabel(key: string, today = berlinDateKey()): string {
  if (key === today) return "Heute";
  if (key === shiftDays(today, 1)) return "Morgen";
  if (key === shiftDays(today, -1)) return "Gestern";
  return formatDayShort(key);
}
