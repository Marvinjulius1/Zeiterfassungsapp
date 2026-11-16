/** Verhindert Open Redirects: nur interne Pfade erlaubt. */
export function safeNext(next: string | null | undefined, fallback = "/start"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
