"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { Button } from "./button";

export interface DateRange {
  start: string | null;
  end: string | null;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Zeitraum-Kalender: erster Tipp = Beginn, zweiter Tipp = Ende.
 * `describe` liefert je Tag optional einen Hinweis (z. B. Feiertag) und ob er „frei" ist.
 */
export function RangeCalendar({
  value,
  onChange,
  minDate,
  describe,
  initialMonth,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  minDate?: string;
  describe?: (date: string) => { off?: boolean; label?: string } | undefined;
  initialMonth?: string;
}) {
  const init = initialMonth ?? value.start ?? minDate ?? new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState({ y: Number(init.slice(0, 4)), m: Number(init.slice(5, 7)) - 1 });

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(ym.y, ym.m, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => key(ym.y, ym.m, i + 1))] as (string | null)[];
  }, [ym]);

  const pick = (d: string) => {
    haptic("tick");
    if (!value.start || value.end || d < value.start) onChange({ start: d, end: null });
    else onChange({ start: value.start, end: d });
  };
  const step = (dir: -1 | 1) => setYm(({ y, m }) => ({ y: m + dir < 0 ? y - 1 : m + dir > 11 ? y + 1 : y, m: (m + dir + 12) % 12 }));

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Vorheriger Monat" onClick={() => step(-1)}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <p className="text-[15px] font-semibold" aria-live="polite">{MONTHS[ym.m]} {ym.y}</p>
        <Button variant="ghost" size="icon" aria-label="Nächster Monat" onClick={() => step(1)}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={`${MONTHS[ym.m]} ${ym.y}`}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-2 text-xs font-semibold text-fg-3" role="columnheader">{w}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const info = describe?.(d);
          const disabled = !!minDate && d < minDate;
          const end = value.end ?? value.start;
          const inRange = !!value.start && !!end && d >= value.start && d <= end;
          const isEdge = d === value.start || d === value.end;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              disabled={disabled}
              aria-selected={inRange}
              aria-label={`${Number(d.slice(8))}. ${MONTHS[ym.m]}${info?.label ? ` – ${info.label}` : ""}`}
              title={info?.label}
              onClick={() => pick(d)}
              className={cn(
                "relative mx-auto flex h-11 w-full items-center justify-center text-[15px] tabular transition-colors disabled:opacity-25",
                inRange && !isEdge && "bg-surface-3",
                d === value.start && "rounded-l-full",
                d === end && "rounded-r-full",
                info?.off && !inRange && "text-fg-3",
              )}
            >
              {isEdge && (
                <motion.span
                  layoutId={d === value.start ? "range-start" : "range-end"}
                  className="absolute inset-0.5 rounded-full bg-inverse"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={cn("relative", isEdge && "font-semibold text-inverse-fg")}>{Number(d.slice(8))}</span>
              {info?.label && <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", isEdge ? "bg-inverse-fg" : "bg-pause")} aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
