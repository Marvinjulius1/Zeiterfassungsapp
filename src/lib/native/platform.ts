import { Capacitor } from "@capacitor/core";

/** Läuft die Seite in der nativen Zeitgeist-App (iOS/Android) statt im Browser? */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function nativePlatform(): "ios" | "android" | "web" {
  return typeof window === "undefined" ? "web" : (Capacitor.getPlatform() as "ios" | "android" | "web");
}
