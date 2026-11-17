"use client";

import { AnimatePresence, motion } from "motion/react";
import { WifiOff } from "lucide-react";
import { useOffline } from "next/offline";

/** Dezente Pille oben, solange keine Verbindung besteht. Next wiederholt Navigationen und Aktionen automatisch. */
export function OfflineBanner() {
  const offline = useOffline();
  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[60] flex justify-center px-4"
        >
          <span className="flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-medium shadow-[0_8px_30px_rgb(0_0_0/0.35)]">
            <WifiOff className="h-4 w-4 text-pause" aria-hidden />
            Offline – Änderungen werden gesendet, sobald du wieder Netz hast
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
