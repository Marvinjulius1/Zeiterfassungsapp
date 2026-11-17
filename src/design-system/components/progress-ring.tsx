"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "../motion";

type Tone = "fg" | "ok" | "pause" | "alert";
const toneVar: Record<Tone, string> = {
  fg: "var(--zg-fg)",
  ok: "var(--zg-ok)",
  pause: "var(--zg-pause)",
  alert: "var(--zg-alert)",
};

/**
 * Fortschrittsring (Soll vs. Ist). value = 0..1, Werte > 1 zeigen eine
 * zweite, dünnere Runde für Mehrarbeit.
 */
export function ProgressRing({
  value,
  size = 240,
  stroke = 10,
  tone = "fg",
  overTone = "pause",
  label,
  className,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  overTone?: Tone;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const main = Math.min(Math.max(value, 0), 1);
  const over = Math.min(Math.max(value - 1, 0), 1);
  const t = reduce ? { duration: 0 } : spring.smooth;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Fortschritt als eigenes Element: Inhalte (z. B. der Check-in-Button) dürfen nicht im progressbar stecken */}
      <div
        className="absolute inset-0"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-label={label}
      >
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--zg-ring-track)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={toneVar[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: main, opacity: main === 0 ? 0 : 1 }}
            transition={t}
          />
          {over > 0 && (
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={toneVar[overTone]}
              strokeWidth={stroke * 0.5}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: over }}
              transition={t}
            />
          )}
        </svg>
      </div>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}
