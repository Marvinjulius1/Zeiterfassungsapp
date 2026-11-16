"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Segmented } from "@/design-system/components/segmented";
import { cn } from "@/lib/cn";
import { periodLabel, rangeFor, stepDate, type View } from "../periods";

export function PeriodNav({ view, date, today }: { view: View; date: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const go = (v: View, d: string) => start(() => router.push(`${pathname}?view=${v}&date=${d}`, { scroll: false }));
  const nextDate = stepDate(view, date, 1);
  const canForward = rangeFor(view, nextDate).from <= today;

  return (
    <div className={cn("space-y-4 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <Segmented
        className="w-full"
        label="Ansicht"
        value={view}
        onChange={(v) => go(v, date)}
        options={[
          { value: "day", label: "Tag" },
          { value: "week", label: "Woche" },
          { value: "month", label: "Monat" },
        ]}
      />
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="Zurück" onClick={() => go(view, stepDate(view, date, -1))}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <button
          type="button"
          onClick={() => go(view, today)}
          className="text-[15px] font-semibold text-fg"
          aria-label={`${periodLabel(view, date)} – zu heute springen`}
        >
          {periodLabel(view, date)}
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Weiter"
          disabled={!canForward}
          onClick={() => go(view, nextDate)}
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
