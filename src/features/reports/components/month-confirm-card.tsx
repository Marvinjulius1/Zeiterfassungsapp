"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, FileText, Lock } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { buttonVariants } from "@/design-system/components/button-variants";
import { DownloadLink } from "@/components/download-link";
import { Card } from "@/design-system/components/card";
import { toast } from "@/design-system/components/toaster";
import { haptic } from "@/lib/haptics";
import { confirmMonth } from "../actions";

/** Monatsabschluss aus Sicht der Mitarbeitenden: bestätigen + Stundenzettel als PDF */
export function MonthConfirmCard({
  month,
  label,
  isPast,
  confirmedAt,
  lockedAt,
  incompleteDays,
}: {
  month: string; // yyyy-MM-01
  label: string;
  isPast: boolean;
  confirmedAt: string | null;
  lockedAt: string | null;
  incompleteDays: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(!!confirmedAt);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "long" });

  const status = lockedAt
    ? `Abgeschlossen am ${fmt(lockedAt)}`
    : done
      ? confirmedAt ? `Von dir bestätigt am ${fmt(confirmedAt)}` : "Von dir bestätigt"
      : isPast
        ? "Bitte prüfe deine Zeiten und bestätige den Monat."
        : "Bestätigen geht, sobald der Monat vorbei ist.";

  return (
    <Card className="space-y-4" data-testid="month-confirm">
      <div className="flex items-start gap-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={lockedAt ? "lock" : done ? "done" : "open"}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${lockedAt ? "bg-fg text-bg" : done ? "bg-ok text-bg" : "bg-surface-2 text-fg-2"}`}
            aria-hidden
          >
            {lockedAt ? <Lock className="h-5 w-5" /> : <Check className="h-5 w-5" strokeWidth={done ? 3 : 2} />}
          </motion.span>
        </AnimatePresence>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Monatsabschluss {label}</p>
          <p className="mt-0.5 text-sm text-fg-2" role="status">{status}</p>
          {!done && !lockedAt && isPast && incompleteDays > 0 && (
            <p className="mt-1 text-sm text-pause">An {incompleteDays} Tag(en) fehlt das Ausstempeln – bitte zuerst eine Korrektur stellen.</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {isPast && !done && !lockedAt && (
          <Button
            loading={pending}
            disabled={incompleteDays > 0}
            onClick={() =>
              start(async () => {
                const res = await confirmMonth(month);
                if (!res.ok) return void toast.error(res.error);
                haptic("success");
                setDone(true);
                toast.success(`${label} bestätigt`, { description: "Danke! Die Verwaltung sieht deine Bestätigung." });
                router.refresh();
              })
            }
          >
            <Check className="h-4 w-4" aria-hidden /> Monat bestätigen
          </Button>
        )}
        <DownloadLink className={buttonVariants({ variant: "secondary" })} href={`/api/reports/timesheet?monat=${month.slice(0, 7)}`}>
          <FileText className="h-4 w-4" aria-hidden /> Stundenzettel (PDF)
        </DownloadLink>
      </div>
    </Card>
  );
}
