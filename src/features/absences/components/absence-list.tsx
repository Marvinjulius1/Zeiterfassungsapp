"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { toast } from "@/design-system/components/toaster";
import { formatDayShort, berlinDateKey } from "@/lib/time/berlin";
import { STATUS_LABEL } from "@/features/timesheet/labels";
import { cancelAbsence } from "../actions";
import type { MyAbsence } from "../queries";

export function AbsenceList({ items }: { items: MyAbsence[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = berlinDateKey();
  if (items.length === 0) return <p className="pb-4 text-sm text-fg-2">Noch keine Abwesenheiten eingetragen.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => {
        const s = STATUS_LABEL[a.status] ?? { label: a.status, tone: "neutral" as const };
        const cancellable = a.status === "pending" || (a.status === "approved" && a.start > today && a.type !== "sick");
        return (
          <li key={a.id} className="flex items-center gap-3 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[15px] font-medium">
                {a.label}
                {a.hasAttachment && <Paperclip className="h-3.5 w-3.5 text-fg-3" aria-label="mit Anhang" />}
              </p>
              <p className="text-sm text-fg-2">
                {formatDayShort(a.start)}
                {a.end !== a.start && ` – ${formatDayShort(a.end)}`} ·{" "}
                {a.days === 0 ? "kein Arbeitstag" : `${a.days.toLocaleString("de-DE")} ${a.days === 1 ? "Tag" : "Tage"}`}
              </p>
              {a.reviewNote && <p className="mt-0.5 text-sm text-fg-3">„{a.reviewNote}“</p>}
            </div>
            {cancellable && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await cancelAbsence(a.id);
                    if (!res.ok) return void toast.error(res.error ?? "Fehlgeschlagen");
                    toast.success("Zurückgezogen");
                    router.refresh();
                  })
                }
              >
                Zurückziehen
              </Button>
            )}
            <Badge tone={s.tone}>{s.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
