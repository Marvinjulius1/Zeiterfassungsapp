"use client";

import { useEffect } from "react";

const DEV = process.env.NODE_ENV !== "production";

/** Service Worker holen oder registrieren. Im Dev-Modus ohne Caching (nur Push). */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  const url = DEV && process.env.NEXT_PUBLIC_SW_DEV !== "1" ? "/sw.js?nocache=1" : "/sw.js";
  return navigator.serviceWorker.register(url, { scope: "/", updateViaCache: "none" });
}

/**
 * Registriert /sw.js in Produktion automatisch (Offline-Start + Push).
 * Im Dev-Modus erst, wenn jemand Push aktiviert (oder mit NEXT_PUBLIC_SW_DEV=1).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (DEV && process.env.NEXT_PUBLIC_SW_DEV !== "1") return;
    ensureServiceWorker().catch((e) => console.warn("Service Worker:", e));
  }, []);
  return null;
}

/** Löscht offline gespeicherte Seiten (z. B. nach dem Abmelden auf geteilten Geräten). */
export function clearOfflinePages() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "logout" });
}
