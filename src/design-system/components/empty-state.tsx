"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/** Animierte Mini-Illustration: Ziffernblatt mit sanft kreisendem Zeiger. */
function ClockIllustration() {
  const reduce = useReducedMotion();
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden className="text-fg">
      {[44, 34, 24].map((r, i) => (
        <motion.circle
          key={r}
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08 + i * 0.06}
          strokeWidth="1"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 160, damping: 18 }}
          style={{ originX: 0.5, originY: 0.5 }}
        />
      ))}
      {/* Gruppe mit unsichtbarem Vollkreis → Drehpunkt liegt exakt in der Mitte */}
      <motion.g
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        style={{ originX: 0.5, originY: 0.5 }}
      >
        <circle cx="48" cy="48" r="48" fill="transparent" />
        <line x1="48" y1="48" x2="48" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </motion.g>
      <line x1="48" y1="48" x2="60" y2="48" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="48" r="3" fill="currentColor" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
  illustration,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col items-center px-6 py-12 text-center", className)}
    >
      {illustration ?? <ClockIllustration />}
      <h3 className="mt-6 text-lg font-semibold text-fg">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-[15px] text-fg-2">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
