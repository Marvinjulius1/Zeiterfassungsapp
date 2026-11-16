"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Sheet } from "@/design-system/components/sheet";
import { Skeleton } from "@/design-system/components/skeleton";
import { toast } from "@/design-system/components/toaster";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { createClient } from "@/lib/supabase/client";
import { formatDayLong, formatTime, shiftDays, TZ } from "@/lib/time/berlin";
import { correctDay } from "../actions";

type Kind = "check_in" | "break_start" | "break_end" | "check_out";
const KIND_LABEL: Record<Kind, string> = { check_in: "Eingecheckt", break_start: "Pause ab", break_end: "Pause bis", check_out: "Ausgecheckt" };
const SOURCE_LABEL: Record<string, string> = {
  app: "App", terminal_qr: "Terminal", personal_qr: "Eigener QR", pin: "PIN", rfid: "RFID", nfc: "NFC", admin: "Korrektur", system_auto: "Automatisch",
};

interface Row {
  key: string;
  id?: string; // bestehende Buchung
  kind: Kind;
  time: string; // HH:mm
  nextDay: boolean;
  originalTime?: string;
  originalNextDay?: boolean;
  source?: string;
  removed: boolean;
}

function toIso(date: string, time: string, nextDay: boolean): string {
  const d = nextDay ? shiftDays(date, 1) : date;
  const [y, m, dd] = d.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new TZDate(y, m - 1, dd, h, mi, TZ).toISOString();
}

export function DayEditor({
  membershipId,
  name,
  date,
  open,
  onOpenChange,
}: {
  membershipId: string;
  name: string;
  date: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return; // Komponente wird pro Zeile neu gemountet (key) – kein Zurücksetzen nötig
    void createClient()
      .from("time_events")
      .select("id, kind, occurred_at, source")
      .eq("membership_id", membershipId)
      .eq("work_date", date)
      .is("voided_at", null)
      .order("occurred_at")
      .then(({ data }) =>
        setRows(
          (data ?? []).map((e) => {
            const t = formatTime(e.occurred_at);
            const nd = new Date(e.occurred_at).toISOString() >= toIso(date, "00:00", true);
            return { key: e.id, id: e.id, kind: e.kind, time: t, nextDay: nd, originalTime: t, originalNextDay: nd, source: e.source, removed: false };
          }),
        ),
      );
  }, [open, membershipId, date]);

  const changed = (r: Row) => !!r.id && !r.removed && (r.time !== r.originalTime || r.nextDay !== r.originalNextDay);
  const dirty = !!rows?.some((r) => r.removed || !r.id || changed(r));
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? rs);

  function save() {
    if (!rows) return;
    const voidIds = rows.filter((r) => r.id && (r.removed || changed(r))).map((r) => r.id!);
    const add = rows
      .filter((r) => !r.removed && (!r.id || changed(r)))
      .map((r) => ({ kind: r.kind, occurred_at: toIso(date, r.time, r.nextDay) }));
    start(async () => {
      const res = await correctDay({ membershipId, workDate: date, voidIds, add, reason });
      if (!res.ok) {
        haptic("error");
        toast.error(res.error);
        return;
      }
      haptic("success");
      toast.success("Zeiten korrigiert", { description: "Im Audit-Log mit Begründung protokolliert." });
      onOpenChange(false);
      router.refresh();
    });
  }

  const field = "h-11 rounded-[14px] border border-line bg-surface-2 px-3 text-[15px] text-fg outline-none focus:border-line-strong";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={name} description={formatDayLong(date)}>
      {!rows ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          {rows.length === 0 && <p className="text-sm text-fg-2">Keine Buchungen. Füge unten die fehlenden Zeiten hinzu.</p>}
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.key} className={cn("flex flex-wrap items-center gap-2", r.removed && "opacity-40")}>
                <select
                  className={cn(field, "w-36")}
                  value={r.kind}
                  disabled={!!r.id || r.removed}
                  onChange={(e) => update(r.key, { kind: e.target.value as Kind })}
                  aria-label="Art der Buchung"
                >
                  {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                    <option key={k} value={k}>{KIND_LABEL[k]}</option>
                  ))}
                </select>
                <input
                  type="time"
                  className={cn(field, "w-28 tabular", r.removed && "line-through")}
                  value={r.time}
                  disabled={r.removed}
                  onChange={(e) => update(r.key, { time: e.target.value })}
                  aria-label={`Uhrzeit ${KIND_LABEL[r.kind]}`}
                />
                <label className="flex items-center gap-1.5 text-xs text-fg-2">
                  <input type="checkbox" checked={r.nextDay} disabled={r.removed} onChange={(e) => update(r.key, { nextDay: e.target.checked })} />
                  +1 Tag
                </label>
                <span className="ml-auto text-xs text-fg-3">{r.id ? (changed(r) ? "geändert" : SOURCE_LABEL[r.source ?? ""] ?? r.source) : "neu"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={r.removed ? "Wiederherstellen" : "Buchung entfernen"}
                  onClick={() => (r.id ? update(r.key, { removed: !r.removed }) : setRows((rs) => rs?.filter((x) => x.key !== r.key) ?? rs))}
                >
                  {r.removed ? <Undo2 className="h-4 w-4" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const last = rows.filter((r) => !r.removed).at(-1);
              const nextKind: Kind = !last || last.kind === "check_out" ? "check_in" : last.kind === "break_start" ? "break_end" : "check_out";
              setRows([...rows, { key: crypto.randomUUID(), kind: nextKind, time: last?.time ?? "08:00", nextDay: false, removed: false }]);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Buchung hinzufügen
          </Button>

          <div className="flex flex-col gap-2">
            <label htmlFor="correction-reason" className="text-sm font-medium text-fg-2">
              Begründung (Pflicht – wird im Audit-Log gespeichert)
            </label>
            <textarea
              id="correction-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z. B. Mitarbeiter hat Ausstempeln vergessen, telefonisch bestätigt"
              className="w-full resize-none rounded-[18px] border border-line bg-surface-2 p-4 text-[15px] text-fg outline-none placeholder:text-fg-3 focus:border-line-strong"
            />
          </div>
          <Button size="lg" block loading={pending} disabled={!dirty || reason.trim().length < 3} onClick={save}>
            Korrektur speichern
          </Button>
          <p className="text-center text-xs text-fg-3">Alte Buchungen werden nicht gelöscht, sondern als ungültig markiert.</p>
        </div>
      )}
    </Sheet>
  );
}
