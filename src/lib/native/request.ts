/**
 * Erkennt Anfragen aus der nativen Zeitgeist-App (Capacitor hängt „ZeitgeistApp“ an den User-Agent,
 * siehe capacitor.config.ts). Server-tauglich, ohne Capacitor-Import.
 *
 * Bedien-Regel, keine Sicherheitsgrenze: Die Rechte prüft weiterhin die Datenbank (RLS).
 */
export const NATIVE_UA_MARKER = "ZeitgeistApp";

export function isNativeUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && userAgent.includes(NATIVE_UA_MARKER);
}

/** Bereiche, die es nur im Browser gibt (Verwaltung, Firma anlegen) */
export const BROWSER_ONLY = ["/admin", "/onboarding"];

export const isBrowserOnlyPath = (path: string) => BROWSER_ONLY.some((p) => path === p || path.startsWith(`${p}/`));

/** Wohin nach dem Login in der App: immer Zeiterfassung, nie Verwaltung */
export function nativeHomeFor(hasMembership: boolean): "/app" | "/nur-im-browser" {
  return hasMembership ? "/app" : "/nur-im-browser";
}
