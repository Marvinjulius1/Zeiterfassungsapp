import type { Transition } from "motion/react";

/** Zentrale Spring-Presets – überall dieselbe „Physik". */
export const spring = {
  /** Taps, Toggles, kleine Elemente */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 },
  /** Karten, Sheets, Seitenübergänge */
  gentle: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  /** Ringe, Charts, Zahlen */
  smooth: { type: "spring", stiffness: 120, damping: 22, mass: 1 },
} as const satisfies Record<string, Transition>;

/** Standard-Tap: leichtes Eindrücken auf 0.97 */
export const tap = { scale: 0.97 } as const;

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: spring.gentle,
} as const;

export const stagger = (step = 0.05) => ({
  animate: { transition: { staggerChildren: step } },
});
