/** Ziel-URL je Benachrichtigungsart (Push-Klick und Glocke) */
export function linkFor(kind: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  const date = typeof p.work_date === "string" ? p.work_date : null;
  if (kind.startsWith("correction_") || kind === "auto_checkout") return date ? `/app/zeiten?view=day&date=${date}` : "/app/zeiten";
  if (kind.startsWith("absence_")) return "/app/antraege";
  if (kind.startsWith("shift")) return "/app/plan";
  if (kind === "test") return "/app/profil";
  return "/start";
}
