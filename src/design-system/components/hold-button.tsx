"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { spring } from "../motion";

type Tone = "ok" | "pause" | "alert" | "fg";
const toneVar: Record<Tone, string> = {
  ok: "var(--zg-ok)",
  pause: "var(--zg-pause)",
  alert: "var(--zg-alert)",
  fg: "var(--zg-fg)",
};

export interface HoldButtonProps {
  /** Text im Button, z. B. „Einchecken" */
  label: string;
  /** Hinweis darunter, z. B. „Gedrückt halten" */
  hint?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  /** Haltedauer in ms */
  duration?: number;
  size?: number;
  disabled?: boolean;
  onComplete: () => void | Promise<void>;
  className?: string;
}

/**
 * „Hold to check in": gedrückt halten → Ring füllt sich → Haptik → Erfolgs-Animation.
 * Funktioniert mit Maus, Touch und Tastatur (Leertaste/Enter halten).
 */
export function HoldButton({
  label,
  hint = "Gedrückt halten",
  icon,
  tone = "ok",
  duration = 900,
  size = 184,
  disabled,
  onComplete,
  className,
}: HoldButtonProps) {
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const ringScale = useTransform(progress, [0, 1], [1, 0.94]);
  // Bei 0 % keinen „Punkt" der runden Linienkappe zeigen
  const ringOpacity = useTransform(progress, [0, 0.01], [0, 1]);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const holding = useRef(false);
  const lastTick = useRef(0);
  const [done, setDone] = useState(false);

  const stroke = 6;
  const r = (size - stroke) / 2;

  const finish = useCallback(async () => {
    holding.current = false;
    haptic("success");
    setDone(true);
    try {
      await onComplete();
    } finally {
      window.setTimeout(() => {
        setDone(false);
        progress.set(0);
      }, 1300);
    }
  }, [onComplete, progress]);

  const start = useCallback(() => {
    if (disabled || done || holding.current) return;
    holding.current = true;
    haptic("light");
    controls.current?.stop();
    controls.current = animate(progress, 1, {
      duration: (duration / 1000) * (1 - progress.get()),
      ease: "linear",
      onUpdate: (v) => {
        // kleine Haptik-Ticks während des Haltens
        if (v - lastTick.current > 0.25) {
          lastTick.current = v;
          haptic("tick");
        }
      },
      onComplete: () => {
        lastTick.current = 0;
        if (holding.current) void finish();
      },
    });
  }, [disabled, done, duration, finish, progress]);

  const cancel = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    lastTick.current = 0;
    controls.current?.stop();
    controls.current = animate(progress, 0, reduce ? { duration: 0 } : spring.gentle);
  }, [progress, reduce]);

  useEffect(() => () => controls.current?.stop(), []);

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <motion.button
        type="button"
        disabled={disabled}
        aria-label={`${label} – ${hint}`}
        aria-describedby={undefined}
        className="relative flex touch-none select-none items-center justify-center rounded-full outline-none disabled:opacity-40"
        style={{ width: size, height: size, scale: ringScale }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") cancel();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Fläche */}
        <span className="absolute inset-[14px] rounded-full bg-surface-2" />
        {/* Ring */}
        <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--zg-ring-track)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={toneVar[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{ pathLength: progress, opacity: ringOpacity }}
          />
        </svg>

        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <motion.span
              key="done"
              className="relative flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: toneVar[tone] }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={spring.snappy}
            >
              <Check className="h-8 w-8 text-bg" strokeWidth={3} aria-hidden />
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              className="relative flex flex-col items-center gap-1.5 text-fg"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={spring.snappy}
            >
              {icon}
              <span className="text-lg font-semibold">{label}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <span className="text-sm text-fg-2" aria-live="polite">
        {done ? "Erledigt" : hint}
      </span>
    </div>
  );
}
