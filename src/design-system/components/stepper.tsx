"use client";

import { Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { RollingNumber } from "./rolling-number";
import { tap } from "../motion";

/**
 * Inline-Zahlenwähler für Klartext-Regeln:
 * „Frühestens [− 15 +] Minuten vor Schichtbeginn einchecken".
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  className?: string;
}) {
  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, v));
    if (next !== value) {
      haptic("tick");
      onChange(next);
    }
  };
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-full text-fg-2 hover:bg-surface-3 hover:text-fg disabled:opacity-30";
  return (
    <span
      role="group"
      aria-label={label}
      className={cn("inline-flex h-10 items-center gap-1 rounded-full bg-surface-2 px-1 align-middle", className)}
    >
      <motion.button type="button" whileTap={tap} className={btn} onClick={() => set(value - step)} disabled={value <= min} aria-label={`${label} verringern`}>
        <Minus className="h-4 w-4" aria-hidden />
      </motion.button>
      <span className="min-w-[2.5ch] text-center text-base font-semibold text-fg" aria-live="polite">
        <RollingNumber value={String(value)} />
      </span>
      <motion.button type="button" whileTap={tap} className={btn} onClick={() => set(value + step)} disabled={value >= max} aria-label={`${label} erhöhen`}>
        <Plus className="h-4 w-4" aria-hidden />
      </motion.button>
    </span>
  );
}
