/**
 * Formatierung von Zeitdauern. Alle Funktionen sind rein und getestet.
 */

/** Sekunden → „6:42:18" (Stunden ohne führende Null). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${pad(m)}:${pad(sec)}`;
}

/** Minuten → „7:52 h" bzw. „−1:15 h" für Salden. */
export function formatHours(minutes: number, opts: { sign?: boolean } = {}): string {
  const neg = minutes < 0;
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = neg ? "−" : opts.sign && abs > 0 ? "+" : "";
  return `${sign}${h}:${pad(m)} h`;
}

/** Minuten → „7,5 h" (dezimal, deutsch). */
export function formatDecimalHours(minutes: number, digits = 1): string {
  return `${(minutes / 60).toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} h`;
}

/** Minuten → „12 Min." bzw. „1 Std. 5 Min." */
export function formatMinutesShort(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} Std.` : `${h} Std. ${rest} Min.`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
