"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativeApp, nativePlatform } from "./platform";

/** Startseiten, bei denen „Zurück“ (Android) die App in den Hintergrund schickt statt zu navigieren */
const ROOTS = new Set(["/app", "/admin", "/login", "/terminal", "/start"]);

/**
 * Verbindet die Web-Oberfläche mit der nativen App:
 * Statusleiste passend zum Design, Android-Zurück-Taste, frische Daten nach dem Wechsel
 * aus dem Hintergrund, Startbildschirm ausblenden. Im Browser passiert nichts.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.dataset.native = nativePlatform();

    // Statusleiste: helle Schrift im dunklen Design, dunkle im hellen
    const syncStatusBar = () => {
      const light = document.documentElement.getAttribute("data-theme") === "light";
      StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => undefined);
    };
    syncStatusBar();
    const themeObserver = new MutationObserver(syncStatusBar);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    SplashScreen.hide().catch(() => undefined);

    const listeners = [
      // Android-Zurück-Taste
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack && !ROOTS.has(window.location.pathname)) window.history.back();
        else App.minimizeApp().catch(() => App.exitApp());
      }),
      // Zurück aus dem Hintergrund: Daten auffrischen (z. B. Status, Glocke, Schichten)
      App.addListener("resume", () => router.refresh()),
    ];

    return () => {
      themeObserver.disconnect();
      listeners.forEach((l) => l.then((h) => h.remove()).catch(() => undefined));
    };
  }, [router]);

  return null;
}
