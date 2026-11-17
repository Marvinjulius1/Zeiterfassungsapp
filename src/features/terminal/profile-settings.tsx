"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MapPin } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader } from "@/design-system/components/card";
import { Sheet } from "@/design-system/components/sheet";
import { toast } from "@/design-system/components/toaster";
import { Toggle } from "@/design-system/components/toggle";
import { haptic } from "@/lib/haptics";
import { generateMyPin, setGeoConsent } from "./actions";

export function StampingSettings({ hasPin, geoConsent }: { hasPin: boolean; geoConsent: boolean }) {
  const router = useRouter();
  const [pin, setPin] = useState<string | null>(null);
  const [consent, setConsent] = useState(geoConsent);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader title="Stempeln am Terminal" />
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-fg-2" aria-hidden />
            <div>
              <p className="text-[15px] font-medium">Terminal-PIN</p>
              <p className="text-sm text-fg-2">{hasPin ? "Eingerichtet. Eine neue PIN ersetzt die alte." : "Noch keine PIN – für das Stempeln per Zifferntastatur."}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await generateMyPin();
                if (!res.ok || !res.data) return void toast.error(res.ok ? "Fehler" : res.error);
                haptic("success");
                setPin(res.data.pin);
                router.refresh();
              })
            }
          >
            {hasPin ? "Neue PIN" : "PIN erzeugen"}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-fg-2" aria-hidden />
            <div>
              <p className="text-[15px] font-medium">Standortprüfung beim Einchecken</p>
              <p className="text-sm text-fg-2">
                Nur im Moment des Eincheckens per App, nie im Hintergrund. Nötig, wenn deine Firma „nur vor Ort“ verlangt. Jederzeit widerrufbar.
              </p>
            </div>
          </div>
          <Toggle
            checked={consent}
            label="Standortprüfung erlauben"
            onCheckedChange={(v) => {
              setConsent(v);
              start(async () => {
                const res = await setGeoConsent(v);
                if (!res.ok) {
                  setConsent(!v);
                  toast.error(res.error);
                  return;
                }
                toast.success(v ? "Einwilligung erteilt" : "Einwilligung widerrufen");
                router.refresh();
              });
            }}
          />
        </div>
      </div>

      <Sheet open={!!pin} onOpenChange={(v) => !v && setPin(null)} title="Deine neue PIN" description="Merk sie dir gut – sie wird nur jetzt angezeigt.">
        <div className="space-y-6 text-center">
          <p className="tabular text-6xl font-semibold tracking-[0.3em]" aria-label={`PIN ${pin?.split("").join(" ")}`}>{pin}</p>
          <p className="text-sm text-fg-2">Am Terminal auf „PIN eingeben“ tippen und die 6 Ziffern eingeben. Gib deine PIN niemandem weiter.</p>
          <Button size="lg" block onClick={() => setPin(null)}>Verstanden</Button>
        </div>
      </Sheet>
    </Card>
  );
}
