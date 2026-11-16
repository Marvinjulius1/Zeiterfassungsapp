import type { RuleSettings } from "./rules/schema";
import { addDaysKey, dateKeyOf, localTime } from "./time";

/**
 * Wann muss ein offener Arbeitsblock automatisch beendet werden?
 * Gibt den Zeitpunkt des automatischen Check-outs zurück – oder null.
 */
export function autoCheckoutAt(checkInAt: Date, now: Date, rules: RuleSettings["autoCheckout"]): Date | null {
  if (!rules.enabled) return null;
  let deadline = new Date(checkInAt.getTime() + rules.afterHours * 3600000);
  if (rules.atMidnight) {
    const midnight = localTime(addDaysKey(dateKeyOf(checkInAt), 1), 0);
    if (midnight < deadline) deadline = midnight;
  }
  return now >= deadline ? deadline : null;
}
