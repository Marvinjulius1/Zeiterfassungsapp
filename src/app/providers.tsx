"use client";

import { MotionConfig } from "motion/react";
import { OfflineBanner } from "@/components/offline-banner";
import { Toaster } from "@/design-system/components/toaster";
import { ServiceWorkerRegistration } from "@/lib/pwa/service-worker-registration";

/** Globale Client-Provider. reducedMotion="user" respektiert prefers-reduced-motion. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <OfflineBanner />
      <ServiceWorkerRegistration />
      <Toaster />
    </MotionConfig>
  );
}
