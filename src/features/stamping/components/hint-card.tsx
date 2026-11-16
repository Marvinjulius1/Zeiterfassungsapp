"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Coffee, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { spring } from "@/design-system/motion";
import type { Hint } from "../hints";

const style = {
  alert: { icon: AlertTriangle, box: "bg-alert-soft", icn: "text-alert" },
  pause: { icon: Coffee, box: "bg-pause-soft", icn: "text-pause" },
  ok: { icon: CheckCircle2, box: "bg-ok-soft", icn: "text-ok" },
  neutral: { icon: Info, box: "bg-surface-2", icn: "text-fg-2" },
} as const;

export function HintList({ hints }: { hints: Hint[] }) {
  return (
    <div className="space-y-3" aria-live="polite">
      <AnimatePresence initial={false}>
        {hints.map((h) => {
          const s = style[h.tone];
          const Icon = s.icon;
          return (
            <motion.div
              key={h.id}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={spring.gentle}
              role={h.tone === "alert" ? "alert" : undefined}
              className={cn("flex gap-3.5 rounded-[22px] p-4", s.box)}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.icn)} aria-hidden />
              <div>
                <p className="text-[15px] font-semibold text-fg">{h.title}</p>
                {h.body && <p className="mt-0.5 text-sm text-fg-2">{h.body}</p>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
