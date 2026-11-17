"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Nfc } from "lucide-react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader } from "@/design-system/components/card";
import { toast } from "@/design-system/components/toaster";
import { haptic } from "@/lib/haptics";
import { assignRfid } from "./actions";

/** RFID-Chip zuweisen – mit einem USB-Leser einfach in das Feld scannen. */
export function RfidCard({ membershipId, hasChip, canEdit }: { membershipId: string; hasChip: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [pending, start] = useTransition();
  const run = (value: string | null, msg: string) =>
    start(async () => {
      const res = await assignRfid(membershipId, value);
      if (!res.ok) return void toast.error(res.error);
      haptic("success");
      toast.success(msg);
      setUid("");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader
        title="RFID-Chip"
        subtitle="Zum Stempeln am Terminal. Gespeichert wird nur ein Hash der Chip-Nummer."
        action={hasChip ? <Badge tone="ok">zugewiesen</Badge> : <Badge>kein Chip</Badge>}
      />
      {canEdit && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(uid, "Chip zugewiesen");
          }}
        >
          <div className="relative min-w-48 flex-1">
            <Nfc className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" aria-hidden />
            <input
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="Chip an den Leser halten oder Nummer eingeben"
              aria-label="Chip-Nummer"
              className="h-11 w-full rounded-full border border-line bg-surface-2 pl-11 pr-4 text-sm text-fg outline-none focus:border-line-strong"
            />
          </div>
          <Button type="submit" size="md" loading={pending} disabled={uid.trim().length < 6}>
            {hasChip ? "Ersetzen" : "Zuweisen"}
          </Button>
          {hasChip && (
            <Button type="button" variant="ghost" onClick={() => run(null, "Chip entfernt")} disabled={pending}>
              Entfernen
            </Button>
          )}
        </form>
      )}
    </Card>
  );
}
