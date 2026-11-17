"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/cn";

/** Große Zifferntastatur fürs Terminal (6-stellige PIN, auch per Hardware-Tastatur) */
export function PinPad({ onSubmit, onCancel, length = 6 }: { onSubmit: (pin: string) => void; onCancel: () => void; length?: number }) {
  const [pin, setPin] = useState("");

  // Keine Nebenwirkungen in State-Updatern (React ruft sie im Dev-Modus doppelt auf)
  const press = (d: string) => {
    if (pin.length >= length) return;
    const next = pin + d;
    setPin(next);
    if (next.length === length) setTimeout(() => onSubmit(next), 120);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") onCancel();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const key = "flex h-20 items-center justify-center rounded-[24px] bg-surface-2 text-3xl font-semibold transition-transform active:scale-95";
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-8 flex justify-center gap-3" aria-live="polite" aria-label={`${pin.length} von ${length} Ziffern`}>
        {Array.from({ length }, (_, i) => (
          <motion.span
            key={i}
            animate={{ scale: i < pin.length ? 1 : 0.7 }}
            className={cn("h-4 w-4 rounded-full", i < pin.length ? "bg-fg" : "bg-surface-3")}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className={key} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={cn(key, "text-base text-fg-2")} onClick={onCancel}>
          Abbrechen
        </button>
        <button type="button" className={key} onClick={() => press("0")}>
          0
        </button>
        <button type="button" className={key} aria-label="Löschen" onClick={() => setPin((p) => p.slice(0, -1))}>
          <Delete className="h-7 w-7" aria-hidden />
        </button>
      </div>
    </div>
  );
}
