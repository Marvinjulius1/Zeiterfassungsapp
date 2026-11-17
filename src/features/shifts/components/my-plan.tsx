"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Hand, X } from "lucide-react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Sheet } from "@/design-system/components/sheet";
import { toast } from "@/design-system/components/toaster";
import { haptic } from "@/lib/haptics";
import { formatTime, relativeDayLabel } from "@/lib/time/berlin";
import { claimShift, requestSwap, respondSwap } from "../actions";
import type { MyPlan as Data, MyShift } from "../my-plan";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        haptic("error");
        return void toast.error(res.error ?? "Fehlgeschlagen");
      }
      haptic("success");
      toast.success(msg);
      router.refresh();
    });
  return { pending, run };
}

const when = (s: { date: string; startsAt: string; endsAt: string }) => `${relativeDayLabel(s.date)}, ${formatTime(s.startsAt)}–${formatTime(s.endsAt)}`;

export function MyPlanView({ data }: { data: Data }) {
  const { pending, run } = useRun();
  const [swapFor, setSwapFor] = useState<MyShift | null>(null);

  return (
    <div className="space-y-6">
      {data.incoming.length > 0 && (
        <Card className="space-y-3">
          <CardHeader title="Tauschanfragen an dich" />
          {data.incoming.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-[18px] bg-surface-2 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{r.fromName} fragt, ob du übernimmst</p>
                <p className="text-sm text-fg-2">{when(r)}{r.location && ` · ${r.location}`}</p>
              </div>
              <Button variant="secondary" size="icon" aria-label="Ablehnen" disabled={pending} onClick={() => run(() => respondSwap(r.id, false), "Abgelehnt")}>
                <X className="h-5 w-5" aria-hidden />
              </Button>
              <Button size="icon" aria-label="Zustimmen" disabled={pending} onClick={() => run(() => respondSwap(r.id, true), "Zugestimmt – jetzt entscheidet die Leitung")}>
                <Check className="h-5 w-5" aria-hidden />
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Card className="pb-2">
        <CardHeader title="Meine Schichten" subtitle="Die nächsten 4 Wochen" />
        {data.shifts.length === 0 ? (
          <EmptyState title="Keine Schichten geplant." description="Sobald dein Plan veröffentlicht ist, siehst du ihn hier." className="py-6" />
        ) : (
          <ul className="divide-y divide-line">
            {data.shifts.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="tabular text-[15px] font-semibold">{when(s)}</p>
                  <p className="text-sm text-fg-2">{[s.location, s.position, s.breakMinutes ? `${s.breakMinutes} Min. Pause` : null].filter(Boolean).join(" · ")}</p>
                </div>
                {s.swap ? (
                  <Badge tone="pause">{s.swap.accepted ? `${s.swap.targetName.split(" ")[0]} hat zugestimmt` : `Tausch an ${s.swap.targetName.split(" ")[0]} angefragt`}</Badge>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setSwapFor(s)}>
                    <ArrowLeftRight className="h-4 w-4" aria-hidden /> Tauschen
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="pb-2">
        <CardHeader title="Schichtbörse" subtitle="Offene Schichten – wer zuerst fragt, hat gute Chancen" />
        {data.open.length === 0 ? (
          <p className="pb-4 text-sm text-fg-2">Gerade ist keine Schicht frei.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.open.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="tabular text-[15px] font-semibold">{when(s)}</p>
                  <p className="text-sm text-fg-2">{[s.location, s.position].filter(Boolean).join(" · ")}</p>
                </div>
                {s.claimed === "pending" ? (
                  <Badge tone="pause">Angefragt</Badge>
                ) : s.claimed === "rejected" ? (
                  <Badge>Vergeben</Badge>
                ) : (
                  <Button size="sm" disabled={pending} onClick={() => run(() => claimShift(s.id), "Angefragt – die Leitung entscheidet")}>
                    <Hand className="h-4 w-4" aria-hidden /> Übernehmen
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {swapFor && (
        <Sheet open onOpenChange={(v) => !v && setSwapFor(null)} title="Schicht tauschen" description={when(swapFor)}>
          <p className="mb-3 text-sm text-fg-2">Wen möchtest du fragen? Die Person muss zustimmen, danach entscheidet die Leitung.</p>
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
            {[...data.colleagues]
              .sort((a, b) => Number(b.locationId === data.myLocationId) - Number(a.locationId === data.myLocationId))
              .map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={pending}
                    className="flex w-full items-center justify-between py-3.5 text-left text-[15px] font-medium active:scale-[0.99]"
                    onClick={() => {
                      run(() => requestSwap(swapFor.id, c.id), `Anfrage an ${c.name.split(" ")[0]} gesendet`);
                      setSwapFor(null);
                    }}
                  >
                    {c.name}
                    {c.locationId === data.myLocationId && <Badge>gleicher Standort</Badge>}
                  </button>
                </li>
              ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}
