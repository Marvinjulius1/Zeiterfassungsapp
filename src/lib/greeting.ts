import { TZDate } from "@date-fns/tz";

export const TZ = "Europe/Berlin";

/** „Guten Morgen" / „Hallo" / „Guten Abend" nach Berliner Uhrzeit. */
export function greeting(now: Date = new Date()): string {
  const h = new TZDate(now, TZ).getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Hallo";
  return "Guten Abend";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
