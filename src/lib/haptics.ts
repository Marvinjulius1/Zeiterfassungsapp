import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNativeApp } from "@/lib/native/platform";

/**
 * Haptisches Feedback.
 * - Native App (iOS/Android): echte Taptic-Engine über Capacitor.
 * - Browser: Vibration API (iOS Safari kann das nicht – dort bleibt es beim visuellen Feedback).
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

function nativeHaptic(pattern: HapticPattern) {
  const run = () => {
    switch (pattern) {
      case "tick":
        return Haptics.selectionChanged();
      case "light":
        return Haptics.impact({ style: ImpactStyle.Light });
      case "medium":
        return Haptics.impact({ style: ImpactStyle.Medium });
      case "success":
        return Haptics.notification({ type: NotificationType.Success });
      case "warning":
        return Haptics.notification({ type: NotificationType.Warning });
      case "error":
        return Haptics.notification({ type: NotificationType.Error });
    }
  };
  run()?.catch(() => undefined);
}

export function haptic(pattern: HapticPattern = "tick"): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && pattern === "tick") return;
  if (isNativeApp()) return nativeHaptic(pattern);
  if (typeof navigator.vibrate !== "function") return;
  // Browser erlauben Vibration erst nach einer Nutzerinteraktion (sonst Konsolen-Warnung)
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    const p = patterns[pattern];
    navigator.vibrate(typeof p === "number" ? p : [...p]);
  } catch {
    /* manche Browser werfen ohne Nutzer-Geste – ignorieren */
  }
}
