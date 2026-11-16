import { TZDate } from "@date-fns/tz";

export const TZ = "Europe/Berlin";

/** „yyyy-MM-dd" (Berlin) → Date für eine lokale Uhrzeit an diesem Tag */
export function localTime(dateKey: string, hh: number, mm = 0): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, TZ).getTime());
}

export function dateKeyOf(d: Date): string {
  const t = new TZDate(d, TZ);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}

/** ISO-Wochentag 1 = Mo … 7 = So */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return ((new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() + 6) % 7) + 1;
}

export function mondayOfKey(key: string): string {
  return addDaysKey(key, -(weekdayOf(key) - 1));
}

export function daysBetweenKeys(a: string, b: string): number {
  const pa = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const pb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((pb - pa) / 86400000);
}
