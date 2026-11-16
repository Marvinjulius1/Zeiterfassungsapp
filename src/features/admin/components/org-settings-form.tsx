"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader } from "@/design-system/components/card";
import { Input } from "@/design-system/components/input";
import { Stepper } from "@/design-system/components/stepper";
import { toast } from "@/design-system/components/toaster";
import { Toggle } from "@/design-system/components/toggle";
import { GERMAN_STATES, type GermanState } from "@/lib/germany";
import { haptic } from "@/lib/haptics";
import { updateOrganization } from "../actions";

export function OrgSettingsForm({
  initial,
  canEdit,
}: {
  initial: { name: string; defaultState: GermanState; retentionMonths: number; hasWorksCouncil: boolean };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Firma" />
        <fieldset disabled={!canEdit} className="space-y-5">
          <Input label="Firmenname" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
            Bundesland (Standard für neue Standorte und Feiertage)
            <select
              className="h-14 rounded-[18px] border border-line bg-surface-2 px-4 text-base text-fg"
              value={v.defaultState}
              onChange={(e) => setV({ ...v, defaultState: e.target.value as GermanState })}
            >
              {GERMAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </label>
        </fieldset>
      </Card>

      <Card>
        <CardHeader title="Aufbewahrung" subtitle="§ 16 Abs. 2 ArbZG verlangt mindestens 2 Jahre. Für Lohnunterlagen gelten steuerlich oft 6–10 Jahre." />
        <p className="text-[16px] leading-[2.6]">
          Zeitaufzeichnungen werden{" "}
          <Stepper
            label="Monate Aufbewahrung"
            value={v.retentionMonths}
            min={24}
            max={240}
            step={6}
            onChange={(n) => canEdit && setV({ ...v, retentionMonths: n })}
          />{" "}
          Monate aufbewahrt ({(v.retentionMonths / 12).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Jahre).
        </p>
        <p className="mt-2 text-sm text-fg-3">Das Audit-Log bleibt dauerhaft erhalten; personenbezogene Daten darin werden nach Ablauf pseudonymisiert.</p>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold">Es gibt einen Betriebsrat</h3>
            <p className="mt-1 text-sm text-fg-2">
              Dann sind Beginn und Ende der Arbeitszeit, Pausen sowie die Einführung technischer Zeiterfassung nach § 87 Abs. 1 Nr. 2
              und Nr. 6 BetrVG mitbestimmungspflichtig. Schließt am besten eine Betriebsvereinbarung ab, bevor Regeln aktiv werden.
            </p>
          </div>
          <Toggle checked={v.hasWorksCouncil} onCheckedChange={(b) => canEdit && setV({ ...v, hasWorksCouncil: b })} label="Betriebsrat vorhanden" />
        </div>
      </Card>

      {canEdit && dirty && (
        <div className="flex gap-2">
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await updateOrganization(v);
                if (!res.ok) {
                  haptic("error");
                  toast.error(res.error);
                  return;
                }
                haptic("success");
                toast.success("Gespeichert");
                router.refresh();
              })
            }
          >
            Änderungen speichern
          </Button>
          <Button variant="ghost" onClick={() => setV(initial)}>Verwerfen</Button>
        </div>
      )}
    </div>
  );
}
