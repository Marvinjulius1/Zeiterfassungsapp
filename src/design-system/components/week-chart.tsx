"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { formatHours } from "@/lib/time/format";
import { spring } from "../motion";

export interface WeekChartDay {
  label: string; // „Mo"
  minutes: number;
  targetMinutes: number;
  isToday?: boolean;
}

/**
 * Minimalistisches Wochen-Balkendiagramm mit Soll-Markierung.
 * Balken wachsen beim Laden gestaffelt von unten.
 */
export function WeekChart({
  days,
  height = 160,
  className,
}: {
  days: WeekChartDay[];
  height?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(60, ...days.map((d) => Math.max(d.minutes, d.targetMinutes))) * 1.1;
  const summary = days.map((d) => `${d.label}: ${formatHours(d.minutes)}`).join(", ");

  return (
    <figure className={cn("w-full", className)} aria-label={`Wochenübersicht – ${summary}`}>
      <div className="flex items-end gap-2.5 sm:gap-3.5" style={{ height }} aria-hidden>
        {days.map((d, i) => {
          const h = (d.minutes / max) * height;
          const target = (d.targetMinutes / max) * height;
          const over = d.targetMinutes > 0 && d.minutes > d.targetMinutes;
          return (
            <div key={d.label} className="relative flex h-full flex-1 items-end">
              {d.targetMinutes > 0 && (
                <span
                  className="absolute inset-x-0 border-t border-dashed border-line-strong"
                  style={{ bottom: target }}
                />
              )}
              <motion.span
                className={cn(
                  "w-full rounded-[10px]",
                  d.isToday ? "bg-fg" : over ? "bg-fg-2" : "bg-surface-3",
                )}
                style={{ originY: 1, height: Math.max(h, d.minutes > 0 ? 6 : 3) }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ ...spring.smooth, delay: reduce ? 0 : i * 0.05 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2.5 sm:gap-3.5" aria-hidden>
        {days.map((d) => (
          <span
            key={d.label}
            className={cn("flex-1 text-center text-xs font-medium", d.isToday ? "text-fg" : "text-fg-3")}
          >
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
