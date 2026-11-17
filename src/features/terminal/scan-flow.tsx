"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { AlertTriangle, Check, Coffee, LogOut, Play } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { buttonVariants } from "@/design-system/components/button-variants";
import { LoadingDots } from "@/design-system/components/button";
import { haptic } from "@/lib/haptics";
import { formatTime } from "@/lib/time/berlin";
import { greeting } from "@/lib/greeting";
import type { EventKind } from "@/compliance";

const DONE: Record<EventKind, string> = {
  check_in: "Eingecheckt",
  break_start: "Pause gestartet",
  break_end: "Willkommen zurück",
  check_out: "Ausgecheckt",
};

type Phase = { t: "choose" } | { t: "busy" } | { t: "done"; kind: EventKind; at: string; warnings: string[] } | { t: "error"; message: string };

/** Ablauf nach dem Scannen des Terminal-QR: automatisch einchecken oder Aktion wählen */
export function ScanFlow({ ticket, firstName, locationName, state }: { ticket: string; firstName: string; locationName: string; state: "out" | "in" | "break" }) {
  const [phase, setPhase] = useState<Phase>(state === "out" ? { t: "busy" } : { t: "choose" });
  const started = useRef(false);

  async function stamp(kind: EventKind | null) {
    setPhase({ t: "busy" });
    try {
      const res = await fetch("/api/scan/stamp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticket, kind, eventId: crypto.randomUUID() }),
      }).then((r) => r.json());
      if (!res.ok) {
        haptic("error");
        setPhase({ t: "error", message: res.error });
        return;
      }
      haptic("success");
      setPhase({ t: "done", kind: res.kind, at: res.occurredAt, warnings: res.warnings ?? [] });
    } catch {
      setPhase({ t: "error", message: "Keine Verbindung. Bitte erneut scannen." });
    }
  }

  // Wer ausgecheckt ist, wird ohne weiteren Tipp eingecheckt
  useEffect(() => {
    if (state === "out" && !started.current) {
      started.current = true;
      void stamp(null);
    }
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {phase.t === "busy" && <LoadingDots className="text-fg-2" />}

      {phase.t === "done" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
          <motion.span
            className={`flex h-28 w-28 items-center justify-center rounded-full ${phase.kind === "break_start" ? "bg-pause" : "bg-ok"}`}
            initial={{ scale: 0.3, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
          >
            <Check className="h-14 w-14 text-bg" strokeWidth={3} aria-hidden />
          </motion.span>
          <h1 className="mt-8 text-[32px] font-semibold leading-tight tracking-[-0.03em]">
            {phase.kind === "check_in" ? `${greeting()}, ${firstName}` : phase.kind === "check_out" ? `Schönen Feierabend, ${firstName}` : `${DONE[phase.kind]}, ${firstName}`}
          </h1>
          <p className="mt-2 text-lg text-fg-2" role="status">
            {DONE[phase.kind]} um {formatTime(phase.at)} · {locationName}
          </p>
          {phase.warnings.map((w) => (
            <p key={w} className="mt-4 flex items-start gap-2 rounded-[18px] bg-pause-soft px-4 py-3 text-left text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pause" aria-hidden /> {w}
            </p>
          ))}
          <Link href="/app" className={`${buttonVariants({ variant: "secondary", size: "lg" })} mt-10`}>Zur App</Link>
        </motion.div>
      )}

      {phase.t === "choose" && (
        <div className="w-full">
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em]">Hallo {firstName}!</h1>
          <p className="mt-2 text-fg-2">{state === "break" ? "Du bist gerade in der Pause." : `Du bist eingecheckt · ${locationName}`}</p>
          <div className="mt-10 space-y-3">
            {state === "break" ? (
              <Button size="xl" block onClick={() => stamp("break_end")}>
                <Play className="h-6 w-6" aria-hidden /> Pause beenden
              </Button>
            ) : (
              <Button size="xl" block variant="secondary" onClick={() => stamp("break_start")}>
                <Coffee className="h-6 w-6" aria-hidden /> Pause starten
              </Button>
            )}
            <Button size="xl" block variant={state === "break" ? "secondary" : "primary"} onClick={() => stamp("check_out")}>
              <LogOut className="h-6 w-6" aria-hidden /> Auschecken
            </Button>
          </div>
        </div>
      )}

      {phase.t === "error" && (
        <div>
          <AlertTriangle className="mx-auto h-10 w-10 text-pause" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold">Gerade nicht möglich</h1>
          <p className="mt-2 text-fg-2" role="alert">{phase.message}</p>
          <Link href="/app" className={`${buttonVariants({ size: "lg" })} mt-8`}>Zur App</Link>
        </div>
      )}
    </div>
  );
}
