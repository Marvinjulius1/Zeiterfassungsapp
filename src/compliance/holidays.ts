import { addDaysKey } from "./time";

/**
 * Gesetzliche Feiertage je Bundesland (landesweit geltende).
 * Nur regional geltende Feiertage (z. B. Mariä Himmelfahrt in Teilen Bayerns,
 * Fronleichnam in Teilen Sachsens/Thüringens, Augsburger Friedensfest) sind
 * nicht enthalten – sie können später je Standort ergänzt werden.
 */

export type State =
  | "BW" | "BY" | "BE" | "BB" | "HB" | "HH" | "HE" | "MV"
  | "NI" | "NW" | "RP" | "SL" | "SN" | "ST" | "SH" | "TH";

export interface Holiday {
  date: string; // yyyy-MM-dd
  name: string;
}

/** Ostersonntag nach der Gaußschen Osterformel (anonymer gregorianischer Algorithmus) */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Buß- und Bettag: Mittwoch vor dem 23. November */
function repentanceDay(year: number): string {
  const nov23 = new Date(Date.UTC(year, 10, 23, 12));
  const wd = nov23.getUTCDay(); // 0 = So … 3 = Mi
  const back = ((wd - 3 + 7) % 7) || 7;
  return addDaysKey(`${year}-11-23`, -back);
}

const ALL: readonly State[] = ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"];

export function holidaysFor(year: number, state: State): Holiday[] {
  const e = easterSunday(year);
  const fixed = (md: string) => `${year}-${md}`;
  const defs: { date: string; name: string; states: readonly State[] }[] = [
    { date: fixed("01-01"), name: "Neujahr", states: ALL },
    { date: fixed("01-06"), name: "Heilige Drei Könige", states: ["BW", "BY", "ST"] },
    { date: fixed("03-08"), name: "Internationaler Frauentag", states: ["BE", "MV"] },
    { date: addDaysKey(e, -2), name: "Karfreitag", states: ALL },
    { date: e, name: "Ostersonntag", states: ["BB"] },
    { date: addDaysKey(e, 1), name: "Ostermontag", states: ALL },
    { date: fixed("05-01"), name: "Tag der Arbeit", states: ALL },
    { date: addDaysKey(e, 39), name: "Christi Himmelfahrt", states: ALL },
    { date: addDaysKey(e, 49), name: "Pfingstsonntag", states: ["BB"] },
    { date: addDaysKey(e, 50), name: "Pfingstmontag", states: ALL },
    { date: addDaysKey(e, 60), name: "Fronleichnam", states: ["BW", "BY", "HE", "NW", "RP", "SL"] },
    { date: fixed("08-15"), name: "Mariä Himmelfahrt", states: ["SL"] },
    { date: fixed("09-20"), name: "Weltkindertag", states: ["TH"] },
    { date: fixed("10-03"), name: "Tag der Deutschen Einheit", states: ALL },
    { date: fixed("10-31"), name: "Reformationstag", states: ["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"] },
    { date: fixed("11-01"), name: "Allerheiligen", states: ["BW", "BY", "NW", "RP", "SL"] },
    { date: repentanceDay(year), name: "Buß- und Bettag", states: ["SN"] },
    { date: fixed("12-25"), name: "1. Weihnachtsfeiertag", states: ALL },
    { date: fixed("12-26"), name: "2. Weihnachtsfeiertag", states: ALL },
  ];
  return defs
    .filter((d) => d.states.includes(state))
    .map(({ date, name }) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Schnelle Nachschlage-Map für einen Zeitraum (über Jahresgrenzen hinweg). */
export function holidayMap(state: State, fromYear: number, toYear: number = fromYear): Map<string, string> {
  const map = new Map<string, string>();
  for (let y = fromYear; y <= toYear; y++) for (const h of holidaysFor(y, state)) map.set(h.date, h.name);
  return map;
}
