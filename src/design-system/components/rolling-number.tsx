"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "../motion";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Zahl mit rollenden Ziffern (wie ein Depotwert).
 * Jede Ziffer ist eine vertikale Spalte 0–9, die per Spring an ihre Position rollt.
 * Ziffern werden von rechts verankert, damit z. B. „9:59" → „10:00" sauber rollt.
 */
export function RollingNumber({
  value,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  className?: string;
  "aria-label"?: string;
}) {
  const reduce = useReducedMotion();
  const chars = value.split("");

  return (
    <span className={cn("tabular inline-flex leading-none", className)} aria-label={ariaLabel ?? value} role="text">
      {chars.map((ch, i) => {
        const key = chars.length - i; // von rechts verankert
        if (!/\d/.test(ch)) {
          return (
            <span key={`s${key}`} aria-hidden className="inline-block">
              {ch}
            </span>
          );
        }
        const d = Number(ch);
        return (
          <span
            key={`d${key}`}
            aria-hidden
            className="relative inline-block h-[1em] overflow-hidden"
            style={{ width: "0.62em" }}
          >
            <motion.span
              className="absolute left-0 top-0 flex flex-col items-center"
              style={{ width: "0.62em" }}
              initial={false}
              animate={{ y: `${-d}em` }}
              transition={reduce ? { duration: 0 } : spring.snappy}
            >
              {DIGITS.map((n) => (
                <span key={n} className="block h-[1em] leading-none">
                  {n}
                </span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}
