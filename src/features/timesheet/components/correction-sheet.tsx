"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { PencilLine } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";
import { Sheet } from "@/design-system/components/sheet";
import { toast } from "@/design-system/components/toaster";
import { haptic } from "@/lib/haptics";
import { createClient } from "@/lib/supabase/client";
import { berlinDateKey, formatDayLong, TZ } from "@/lib/time/berlin";
import { cn } from "@/lib/cn";
import { CORRECTION_KIND_LABEL } from "../labels";

type Kind = "missing_check_in" | "missing_check_out" | "wrong_time" | "missing_break";
const KINDS: Kind[] = ["missing_check_out", "missing_check_in", "missing_break", "wrong_time"];
const DEFAULT_TIMES: Record<Kind, [string, string]> = {
  missing_check_in: ["08:00", ""],
  missing_check_out: ["17:00", ""],
  missing_break: ["12:00", "12:30"],
  wrong_time: ["08:00", "16:30"],
};

/** „yyyy-MM-dd" + „HH:mm" (Berlin) → ISO */
function toIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new TZDate(y, m - 1, d, h, min, TZ).toISOString();
}

export function CorrectionSheet({
  membershipId,
  orgId,
  date: initialDate,
  trigger,
  allowDatePick = false,
}: {
  membershipId: string;
  orgId: string;
  date?: string;
  trigger?: React.ReactNode;
  allowDatePick?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initialDate ?? berlinDateKey());
  const [kind, setKind] = useState<Kind>("missing_check_out");
  const [time, setTime] = useState("17:00");
  const [timeTo, setTimeTo] = useState("12:30");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const twoTimes = kind === "missing_break" || kind === "wrong_time";
  const valid = reason.trim().length >= 3 && date <= berlinDateKey() && (!twoTimes || timeTo > time);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const proposed =
      kind === "missing_check_in"
        ? [{ kind: "check_in", occurred_at: toIso(date, time) }]
        : kind === "missing_check_out"
          ? [{ kind: "check_out", occurred_at: toIso(date, time) }]
          : kind === "missing_break"
            ? [
                { kind: "break_start", occurred_at: toIso(date, time) },
                { kind: "break_end", occurred_at: toIso(date, timeTo) },
              ]
            : [
                { kind: "check_in", occurred_at: toIso(date, time) },
                { kind: "check_out", occurred_at: toIso(date, timeTo) },
              ];
    const { error } = await createClient().from("correction_requests").insert({
      membership_id: membershipId,
      org_id: orgId, // wird serverseitig zusätzlich aus der Mitgliedschaft erzwungen
      work_date: date,
      kind,
      proposed,
      reason: reason.trim(),
    });
    setBusy(false);
    if (error) {
      haptic("error");
      toast.error("Antrag konnte nicht gesendet werden.", { description: error.message });
      return;
    }
    haptic("success");
    toast.success("Antrag gesendet", { description: "Du bekommst Bescheid, sobald er bearbeitet ist." });
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Korrektur beantragen"
      description={allowDatePick ? "Etwas vergessen? Kein Problem." : formatDayLong(date)}
      trigger={
        trigger ?? (
          <Button variant="secondary" size="lg" block>
            <PencilLine className="h-5 w-5" aria-hidden /> Korrektur beantragen
          </Button>
        )
      }
    >
      <form onSubmit={submit} className="space-y-6">
        {allowDatePick && (
          <Input type="date" label="Tag" value={date} max={berlinDateKey()} onChange={(e) => setDate(e.target.value)} />
        )}
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-fg-2">Was ist passiert?</legend>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  haptic("tick");
                  setKind(k);
                  setTime(DEFAULT_TIMES[k][0]);
                  if (DEFAULT_TIMES[k][1]) setTimeTo(DEFAULT_TIMES[k][1]);
                }}
                className={cn(
                  "h-12 rounded-[16px] px-3 text-sm font-semibold transition-[background-color,color,transform] active:scale-[0.97]",
                  kind === k ? "bg-inverse text-inverse-fg" : "bg-surface-2 text-fg-2",
                )}
              >
                {CORRECTION_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={cn("grid gap-3", twoTimes && "grid-cols-2")}>
          <Input
            type="time"
            label={kind === "missing_check_in" ? "Eingecheckt um" : kind === "missing_check_out" ? "Ausgecheckt um" : twoTimes && kind === "missing_break" ? "Pause von" : "Beginn"}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
          {twoTimes && (
            <Input
              type="time"
              label={kind === "missing_break" ? "bis" : "Ende"}
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              error={timeTo <= time ? "Muss nach dem Beginn liegen" : undefined}
              required
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="reason" className="text-sm font-medium text-fg-2">
            Begründung
          </label>
          <textarea
            id="reason"
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="z. B. Handy-Akku war leer"
            className="w-full resize-none rounded-[18px] border border-line bg-surface-2 p-4 text-base text-fg outline-none placeholder:text-fg-3 focus:border-line-strong"
          />
        </div>

        <Button type="submit" size="lg" block loading={busy} disabled={!valid}>
          Antrag senden
        </Button>
        <p className="text-center text-sm text-fg-3">Deine Führungskraft prüft und bestätigt die Änderung.</p>
      </form>
    </Sheet>
  );
}
