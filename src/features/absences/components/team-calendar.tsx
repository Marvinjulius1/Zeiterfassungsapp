"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Avatar } from "@/design-system/components/avatar";
import { Button } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";
import { Segmented } from "@/design-system/components/segmented";
import { Sheet } from "@/design-system/components/sheet";
import { toast } from "@/design-system/components/toaster";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { berlinDateKey, formatDayShort, formatMonth } from "@/lib/time/berlin";
import { createAbsenceForMember } from "../actions";
import type { TeamCalendar as Data } from "../team-calendar";

/** Farben je Abwesenheitsart – zurückhaltend, nur Status-Akzente */
const TONE: Record<string, string> = {
  vacation: "bg-fg/80 text-bg",
  sick: "bg-alert/80 text-white",
  child_sick: "bg-alert/50 text-fg",
  school: "bg-surface-3 text-fg",
  special: "bg-fg/50 text-bg",
  unpaid: "bg-surface-3 text-fg-2",
  comp_time: "bg-pause/70 text-black",
};
const LEGEND: [string, string][] = [
  ["vacation", "Urlaub"],
  ["sick", "Krank"],
  ["comp_time", "Überstundenabbau"],
  ["school", "Berufsschule"],
];
const TYPES = [
  { value: "sick", label: "Krank" },
  { value: "vacation", label: "Urlaub" },
  { value: "child_sick", label: "Kind krank" },
  { value: "special", label: "Sonderurlaub" },
  { value: "comp_time", label: "Überstundenabbau" },
  { value: "unpaid", label: "Unbezahlt" },
] as const;

function shiftMonth(month: string, dir: -1 | 1) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + dir;
  const d = new Date(Date.UTC(y, m, 1, 12));
  return d.toISOString().slice(0, 10);
}

export function TeamCalendarView({ data, canCreate }: { data: Data; canCreate: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const today = berlinDateKey();
  const [creating, setCreating] = useState<{ membershipId: string; name: string; date: string } | null>(null);
  const go = (month: string, loc = data.locationId) => router.push(`${pathname}?monat=${month}${loc ? `&standort=${loc}` : ""}`, { scroll: false });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Vorheriger Monat" onClick={() => go(shiftMonth(data.month, -1))}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Button>
          <span className="min-w-36 text-center text-[15px] font-semibold">{formatMonth(data.month)}</span>
          <Button variant="ghost" size="icon" aria-label="Nächster Monat" onClick={() => go(shiftMonth(data.month, 1))}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
        {data.locations.length > 1 && (
          <Segmented
            label="Standort"
            value={data.locationId ?? "all"}
            onChange={(v) => go(data.month, v === "all" ? null : v)}
            options={[{ value: "all", label: "Alle" }, ...data.locations.map((l) => ({ value: l.id, label: l.name }))]}
          />
        )}
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-fg-2">
          {LEGEND.map(([k, l]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn("h-3 w-3 rounded", TONE[k])} aria-hidden /> {l}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-dashed border-line-strong" aria-hidden /> beantragt
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-line bg-surface">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-44 border-b border-line bg-surface p-3 text-sm font-medium text-fg-3">Person</th>
              {data.days.map((d) => (
                <th
                  key={d.date}
                  title={d.holiday ?? undefined}
                  className={cn(
                    "border-b border-l border-line px-0 py-2 text-center text-[11px] font-medium",
                    d.weekday >= 6 || d.holiday ? "bg-surface-2 text-fg-3" : "text-fg-2",
                    d.date === today && "text-fg",
                  )}
                >
                  <span className="block">{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][d.weekday - 1]}</span>
                  <span className={cn("tabular", d.date === today && "rounded-full bg-inverse px-1.5 text-inverse-fg")}>{Number(d.date.slice(8))}</span>
                  {d.holiday && <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-pause" aria-label={d.holiday} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.people.map((p) => (
              <tr key={p.id} className="group">
                <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface p-2 pl-3 font-normal">
                  <span className="flex items-center gap-2">
                    <Avatar name={p.name} size={26} />
                    <span className="truncate text-sm font-medium">{p.name}</span>
                  </span>
                </th>
                {data.days.map((d) => {
                  const a = data.absences.find((x) => x.membershipId === p.id && x.start <= d.date && x.end >= d.date);
                  const weekend = d.weekday >= 6 || !!d.holiday;
                  return (
                    <td key={d.date} className={cn("h-10 border-b border-l border-line p-0.5", weekend && "bg-surface-2")}>
                      {a ? (
                        <span
                          title={`${a.label}${a.status === "pending" ? " (beantragt)" : ""}: ${formatDayShort(a.start)} – ${formatDayShort(a.end)}`}
                          className={cn(
                            "block h-full w-full",
                            a.start === d.date && "rounded-l-lg",
                            a.end === d.date && "rounded-r-lg",
                            a.status === "pending" ? "border border-dashed border-line-strong" : TONE[a.key] ?? "bg-surface-3",
                          )}
                        >
                          <span className="sr-only">{a.label}</span>
                        </span>
                      ) : canCreate ? (
                        <button
                          type="button"
                          aria-label={`Abwesenheit für ${p.name} am ${formatDayShort(d.date)} eintragen`}
                          onClick={() => setCreating({ membershipId: p.id, name: p.name, date: d.date })}
                          className="flex h-full w-full items-center justify-center rounded-lg text-fg-3 opacity-0 hover:bg-surface-3 focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Plus className="h-3 w-3" aria-hidden />
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && <CreateAbsenceSheet {...creating} onClose={() => setCreating(null)} />}
    </div>
  );
}

function CreateAbsenceSheet({ membershipId, name, date, onClose }: { membershipId: string; name: string; date: string; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("sick");
  const [start, setStart] = useState(date);
  const [end, setEnd] = useState(date);
  const [note, setNote] = useState("");
  const [pending, startT] = useTransition();
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title="Abwesenheit eintragen" description={name}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          startT(async () => {
            const res = await createAbsenceForMember({ membershipId, type, start, end, note });
            if (!res.ok) return void toast.error(res.error);
            haptic("success");
            toast.success("Eingetragen");
            onClose();
            router.refresh();
          });
        }}
      >
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Art">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={cn("h-10 rounded-full px-4 text-sm font-semibold", type === t.value ? "bg-inverse text-inverse-fg" : "bg-surface-2 text-fg-2")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Von" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="Bis" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Input label="Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. telefonisch krankgemeldet" />
        <Button type="submit" size="lg" block loading={pending}>Eintragen</Button>
        <p className="text-center text-xs text-fg-3">Wird direkt als genehmigt gespeichert und im Audit-Log protokolliert.</p>
      </form>
    </Sheet>
  );
}
