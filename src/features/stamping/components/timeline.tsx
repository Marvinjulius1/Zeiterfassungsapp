import { Coffee, LogIn, LogOut, CloudOff } from "lucide-react";
import { formatMinutesShort } from "@/lib/time/format";
import { formatTime } from "@/lib/time/berlin";
import { cn } from "@/lib/cn";
import type { DayEvent } from "../day-state";

type Row =
  | { type: "in" | "out"; at: string; pending?: boolean; id: string }
  | { type: "break"; from: string; to: string | null; pending?: boolean; id: string };

/** Buchungen zu lesbaren Zeilen zusammenfassen (Pausen als Spanne). */
export function toRows(events: readonly DayEvent[]): Row[] {
  const rows: Row[] = [];
  let openBreak: Extract<Row, { type: "break" }> | null = null;
  for (const e of [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    if (e.kind === "check_in") rows.push({ type: "in", at: e.occurredAt, pending: e.pending, id: e.id });
    if (e.kind === "break_start") {
      openBreak = { type: "break", from: e.occurredAt, to: null, pending: e.pending, id: e.id };
      rows.push(openBreak);
    }
    if (e.kind === "break_end" && openBreak) {
      openBreak.to = e.occurredAt;
      openBreak.pending ||= e.pending;
      openBreak = null;
    }
    if (e.kind === "check_out") {
      if (openBreak) {
        openBreak.to = e.occurredAt;
        openBreak = null;
      }
      rows.push({ type: "out", at: e.occurredAt, pending: e.pending, id: e.id });
    }
  }
  return rows;
}

export function Timeline({ events, className }: { events: readonly DayEvent[]; className?: string }) {
  const rows = toRows(events);
  if (rows.length === 0) return null;
  return (
    <ol className={cn("relative space-y-0", className)} aria-label="Buchungen">
      {rows.map((r, i) => {
        const Icon = r.type === "in" ? LogIn : r.type === "out" ? LogOut : Coffee;
        const label =
          r.type === "in" ? "Eingecheckt" : r.type === "out" ? "Ausgecheckt" : (r as Extract<Row, { type: "break" }>).to ? "Pause" : "Pause läuft";
        const time =
          r.type === "break"
            ? `${formatTime(r.from)}${r.to ? ` – ${formatTime(r.to)}` : ""}`
            : formatTime(r.at);
        const dur =
          r.type === "break" && r.to
            ? formatMinutesShort((new Date(r.to).getTime() - new Date(r.from).getTime()) / 60000)
            : null;
        return (
          <li key={r.id} className="relative flex items-center gap-4 py-3">
            {i < rows.length - 1 && <span className="absolute left-[17px] top-[44px] h-[calc(100%-32px)] w-px bg-line" aria-hidden />}
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                r.type === "break" ? "bg-pause-soft text-pause" : r.type === "in" ? "bg-ok-soft text-ok" : "bg-surface-2 text-fg-2",
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[15px] font-medium">
              {label}
              {dur && <span className="ml-2 text-sm font-normal text-fg-2">{dur}</span>}
            </span>
            {r.pending && (
              <span className="flex items-center gap-1 text-xs text-fg-3" title="Wartet auf Verbindung">
                <CloudOff className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">wartet auf Verbindung</span>
              </span>
            )}
            <span className="tabular text-[15px] text-fg-2">{time}</span>
          </li>
        );
      })}
    </ol>
  );
}
