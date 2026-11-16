"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "@/design-system/components/toaster";

/** Globale Client-Provider. reducedMotion="user" respektiert prefers-reduced-motion. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster />
    </MotionConfig>
  );
}
