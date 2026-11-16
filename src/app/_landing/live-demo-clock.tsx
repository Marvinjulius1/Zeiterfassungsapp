"use client";

import { useEffect, useState } from "react";
import { BigNumber } from "@/design-system/components/big-number";
import { StatusPill } from "@/design-system/components/status-pill";
import { formatClock } from "@/lib/time/format";

const START = 6 * 3600 + 42 * 60 + 18;

/** Kleine Vorschau der Live-Uhr auf der Startseite. */
export function LiveDemoClock() {
  const [seconds, setSeconds] = useState(START);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mt-20 flex flex-col gap-5 rounded-[28px] border border-line bg-surface p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
      <BigNumber value={formatClock(seconds)} label="Heute gearbeitet" size="lg" ariaLabel="Beispiel: Live-Arbeitszeit" />
      <StatusPill status="checked_in" label="Eingecheckt seit 07:58" />
    </div>
  );
}
