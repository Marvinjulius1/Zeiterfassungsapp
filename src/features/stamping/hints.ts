import { breakStatus } from "@/compliance/breaks";
import { formatHours, formatMinutesShort } from "@/lib/time/format";
import type { DaySummary } from "./day-state";

export type HintTone = "neutral" | "ok" | "pause" | "alert";

export interface Hint {
  id: string;
  tone: HintTone;
  title: string;
  body?: string;
}

export interface HintInput {
  summary: DaySummary;
  now: Date;
  isMinor: boolean;
  targetMinutes: number;
  weekMinutesBefore: number;
}

/** Tägliche Höchstarbeitszeit: Erwachsene 8 h (bis 10 h mit Ausgleich), Jugendliche 8 h. */
const DAILY_SOFT = 8 * 60;
const DAILY_HARD_ADULT = 10 * 60;
const WEEKLY_MINOR = 40 * 60;
const WEEKLY_HINT_ADULT = 44 * 60;

/**
 * Freundliche, kurze Hinweise für den Heute-Screen – sortiert nach Dringlichkeit.
 */
export function buildHints({ summary, now, isMinor, targetMinutes, weekMinutesBefore }: HintInput): Hint[] {
  const hints: Hint[] = [];
  const netMin = Math.floor(summary.netSeconds / 60);
  const working = summary.state !== "out";

  if (working) {
    const b = breakStatus({
      netSeconds: summary.netSeconds,
      breakBlocks: summary.breakBlocks,
      currentBreakSeconds: summary.breakStart ? Math.max(0, (now.getTime() - summary.breakStart.getTime()) / 1000) : 0,
      secondsSinceLastBreak: summary.secondsSinceLastBreak,
      isMinor,
    });
    if (b.kind === "overdue") {
      hints.push({
        id: "break-overdue",
        tone: "alert",
        title: b.reason === "continuous" ? "Zeit für eine Pause." : `Dir fehlen ${formatMinutesShort(b.missingMinutes)} Pause`,
        body:
          b.reason === "continuous"
            ? `Du arbeitest schon über ${isMinor ? "4,5" : "6"} Stunden am Stück. Gönn dir mindestens 15 Minuten.`
            : "Das Arbeitszeitgesetz schreibt das vor – und dein Kopf freut sich auch.",
      });
    } else if (b.kind === "due_soon") {
      hints.push({
        id: "break-due",
        tone: "pause",
        title: `Gesetzliche Pause fällig in ${formatMinutesShort(b.inMinutes)}`.replace(/\.?$/, "."),
        body: `Plane mindestens ${formatMinutesShort(b.needMinutes)} ein${b.needMinutes > 15 ? " (gern auch in 15-Minuten-Blöcken)" : ""}.`,
      });
    }
  }

  const hardLimit = isMinor ? DAILY_SOFT : DAILY_HARD_ADULT;
  if (netMin >= hardLimit) {
    hints.push({
      id: "daily-max",
      tone: "alert",
      title: `Tageshöchstgrenze von ${hardLimit / 60} Stunden erreicht.`,
      body: working ? "Bitte jetzt auschecken." : undefined,
    });
  } else if (!isMinor && working && netMin >= DAILY_SOFT) {
    hints.push({
      id: "daily-soft",
      tone: "pause",
      title: "Über 8 Stunden heute.",
      body: `Bis 10 h ist erlaubt, wenn du es in den nächsten Monaten ausgleichst. Noch ${formatHours(DAILY_HARD_ADULT - netMin)} bis zur Grenze.`,
    });
  }

  const weekMin = weekMinutesBefore + netMin;
  if (isMinor && weekMin >= WEEKLY_MINOR - 60) {
    hints.push({
      id: "week-minor",
      tone: weekMin >= WEEKLY_MINOR ? "alert" : "pause",
      title: `Diese Woche ${formatHours(weekMin)}.`,
      body: "Für dich gilt eine Grenze von 40 Stunden pro Woche.",
    });
  } else if (!isMinor && weekMin >= WEEKLY_HINT_ADULT) {
    hints.push({
      id: "week",
      tone: "neutral",
      title: `Du hast diese Woche schon ${Math.floor(weekMin / 60)} h.`,
      body: "Denk an deine Ruhezeit – mindestens 11 Stunden bis zum nächsten Einsatz.",
    });
  }

  // Abend-Zusammenfassung
  if (!working && netMin > 0 && summary.lastOut) {
    const b = breakStatus({
      netSeconds: summary.netSeconds,
      breakBlocks: summary.breakBlocks,
      currentBreakSeconds: 0,
      secondsSinceLastBreak: 0,
      isMinor,
    });
    const breaksOk = b.kind !== "overdue";
    const diff = netMin - targetMinutes;
    hints.unshift({
      id: "summary",
      tone: breaksOk ? "ok" : "alert",
      title: `${formatHours(netMin)} gearbeitet · ${breaksOk ? "Pausen eingehalten ✓" : "Pause zu kurz"}`,
      body:
        targetMinutes > 0
          ? diff === 0
            ? "Punktlandung auf deinem Soll."
            : `${formatHours(diff, { sign: true })} gegenüber deinem Soll.`
          : undefined,
    });
  }

  const order: Record<HintTone, number> = { alert: 0, pause: 1, ok: 2, neutral: 3 };
  return hints.sort((a, b) => (a.id === "summary" ? -1 : b.id === "summary" ? 1 : order[a.tone] - order[b.tone]));
}
