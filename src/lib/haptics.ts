/**
 * Haptisches Feedback über die Vibration API.
 * Hinweis: iOS Safari unterstützt die API nicht – dort passiert einfach nichts,
 * die UI liefert immer zusätzlich visuelles Feedback.
 */
const patterns = {
  tick: 8,
  light: 12,
  medium: 20,
  success: [14, 60, 22],
  warning: [30, 50, 30],
  error: [40, 40, 40, 40, 60],
} as const satisfies Record<string, number | readonly number[]>;

export type HapticPattern = keyof typeof patterns;

export function haptic(pattern: HapticPattern = "tick"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  // Browser erlauben Vibration erst nach einer Nutzerinteraktion (sonst Konsolen-Warnung)
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && pattern === "tick") return;
  try {
    const p = patterns[pattern];
    navigator.vibrate(typeof p === "number" ? p : [...p]);
  } catch {
    /* manche Browser werfen ohne Nutzer-Geste – ignorieren */
  }
}
