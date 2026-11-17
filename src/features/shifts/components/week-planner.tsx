"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Plus, Send, Trash2 } from "lucide-react";
import { addDaysKey } from "@/compliance";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Segmented } from "@/design-system/components/segmented";
import { Sheet } from "@/design-system/components/sheet";
import { Stepper } from "@/design-system/components/stepper";
import { toast } from "@/design-system/components/toaster";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { berlinDateKey, formatDayLong, formatTime, formatWeekdayShort } from "@/lib/time/berlin";
import { formatHours } from "@/lib/time/format";
import { periodLabel } from "@/features/timesheet/periods";
import { copyPreviousWeek, deleteShift, moveShift, publishWeek, saveShift } from "../actions";
import type { PlanShift, WeekPlan } from "../queries";

const OPEN = "__open__";

type Editing = { shift: PlanShift | null; membershipId: string | null; date: string };

export function WeekPlanner({ plan }: { plan: WeekPlan }) {
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = berlinDateKey();

  const go = (monday: string, loc = plan.locationId) =>
    router.push(`${pathname}?woche=${monday}${loc ? `&standort=${loc}` : ""}`, { scroll: false });

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: { count: number } }>, msg: (n?: number) => string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Fehlgeschlagen");
      haptic("success");
      toast.success(msg(res.data?.count));
      router.refresh();
    });

  const rows: { id: string; name: string; sub?: string; minor?: boolean; planned?: number; target?: number }[] = [
    { id: OPEN, name: "Offene Schichten", sub: "Schichtbörse" },
    ...plan.people.map((p) => ({ id: p.id, name: p.name, minor: p.isMinor, planned: p.plannedMinutes, target: p.weeklyTargetMinutes })),
  ];

  const conflictsTotal = plan.shifts.filter((s) => s.conflicts.some((c) => c.severity === "violation")).length;

  return (
    <div className="space-y-5">
      {/* Werkzeugleiste */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Vorherige Woche" onClick={() => go(addDaysKey(plan.monday, -7))}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Button>
          <button type="button" className="px-2 text-[15px] font-semibold" onClick={() => go(addDaysKey(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7)))}>
            {periodLabel("week", plan.monday)}
          </button>
          <Button variant="ghost" size="icon" aria-label="Nächste Woche" onClick={() => go(addDaysKey(plan.monday, 7))}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
        {plan.locations.length > 1 && (
          <Segmented
            label="Standort"
            value={plan.locationId ?? "all"}
            onChange={(v) => go(plan.monday, v === "all" ? null : v)}
            options={[{ value: "all", label: "Alle" }, ...plan.locations.map((l) => ({ value: l.id, label: l.name }))]}
          />
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => copyPreviousWeek(plan.monday, plan.locationId), (n) => (n ? `${n} Schichten aus der Vorwoche übernommen` : "Nichts zu kopieren"))}>
            <Copy className="h-4 w-4" aria-hidden /> Vorwoche kopieren
          </Button>
          <Button size="sm" disabled={pending || plan.drafts === 0} onClick={() => run(() => publishWeek(plan.monday, plan.locationId), (n) => `${n} Schichten veröffentlicht – Team ist benachrichtigt`)}>
            <Send className="h-4 w-4" aria-hidden /> {plan.drafts > 0 ? `${plan.drafts} Entwürfe veröffentlichen` : "Alles veröffentlicht"}
          </Button>
        </div>
      </div>

      {conflictsTotal > 0 && (
        <p className="flex items-center gap-2 rounded-[18px] bg-alert-soft px-4 py-3 text-sm" role="status">
          <AlertTriangle className="h-4 w-4 text-alert" aria-hidden /> {conflictsTotal} Schicht{conflictsTotal === 1 ? "" : "en"} mit Konflikten (Arbeitszeitgesetz, Abwesenheit oder Überschneidung) – rot markiert.
        </p>
      )}

      {/* Raster */}
      <div className={cn("overflow-x-auto rounded-[24px] border border-line bg-surface transition-opacity", pending && "opacity-60")}>
        <div className="grid min-w-[980px] grid-cols-[220px_repeat(7,minmax(0,1fr))]" role="grid" aria-label="Schichtplan">
          <div className="border-b border-line p-3" />
          {plan.days.map((d) => (
            <div key={d.date} role="columnheader" className={cn("border-b border-l border-line p-3", d.date === today && "bg-surface-2")}>
              <p className="text-sm font-semibold">{formatWeekdayShort(d.date)} {Number(d.date.slice(8))}.</p>
              {d.holiday && <p className="truncate text-xs text-pause" title={d.holiday}>{d.holiday}</p>}
            </div>
          ))}

          {rows.map((r) => (
            <Row key={r.id}>
              <div role="rowheader" className="flex items-center gap-3 border-b border-line p-3">
                {r.id === OPEN ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-line-strong text-fg-3">
                    <Plus className="h-4 w-4" aria-hidden />
                  </span>
                ) : (
                  <Avatar name={r.name} size={32} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {r.name} {r.minor && <Badge tone="pause" className="ml-1 h-5 px-1.5">U18</Badge>}
                  </p>
                  <p className={cn("tabular text-xs", r.planned !== undefined && r.target && r.planned > r.target ? "text-pause" : "text-fg-3")}>
                    {r.sub ?? `${formatHours(r.planned ?? 0)} / ${formatHours(r.target ?? 0)}`}
                  </p>
                </div>
              </div>
              {plan.days.map((d) => {
                const memberId = r.id === OPEN ? null : r.id;
                const cellKey = `${r.id}|${d.date}`;
                const shifts = plan.shifts.filter((s) => (s.membershipId ?? OPEN) === r.id && s.date === d.date);
                const absence = memberId ? plan.absences.find((a) => a.membershipId === memberId && a.start <= d.date && a.end >= d.date) : undefined;
                return (
                  <div
                    key={cellKey}
                    role="gridcell"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(cellKey);
                    }}
                    onDragLeave={() => setDragOver((k) => (k === cellKey ? null : k))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(null);
                      const id = e.dataTransfer.getData("text/shift");
                      if (id) run(() => moveShift(id, memberId, d.date), () => "Schicht verschoben");
                    }}
                    className={cn(
                      "group relative min-h-[72px] space-y-1.5 border-b border-l border-line p-1.5 transition-colors",
                      d.holiday && "bg-pause-soft/40",
                      dragOver === cellKey && "bg-surface-3",
                    )}
                  >
                    {absence && (
                      <p className={cn("truncate rounded-[10px] px-2 py-1 text-xs font-medium", absence.status === "approved" ? "bg-surface-3 text-fg-2" : "border border-dashed border-line-strong text-fg-3")}>
                        {absence.label}{absence.status === "pending" && " (beantragt)"}
                      </p>
                    )}
                    {shifts.map((s) => (
                      <ShiftChip key={s.id} shift={s} onOpen={() => setEditing({ shift: s, membershipId: s.membershipId, date: s.date })} />
                    ))}
                    <button
                      type="button"
                      aria-label={`Schicht für ${r.name} am ${formatDayLong(d.date)} anlegen`}
                      onClick={() => setEditing({ shift: null, membershipId: memberId, date: d.date })}
                      className="flex h-7 w-full items-center justify-center rounded-[10px] text-fg-3 opacity-0 transition-opacity hover:bg-surface-2 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                );
              })}
            </Row>
          ))}
        </div>
      </div>
      <p className="text-sm text-fg-3">
        Ziehen zum Verschieben · Klick zum Bearbeiten · <span className="inline-block h-3 w-6 rounded border border-dashed border-line-strong align-middle" /> Entwurf (für das Team noch unsichtbar)
      </p>

      {editing && (
        <ShiftEditor
          key={editing.shift?.id ?? `${editing.membershipId}-${editing.date}`}
          editing={editing}
          plan={plan}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div role="row" className="contents">{children}</div>;
}

function ShiftChip({ shift, onOpen }: { shift: PlanShift; onOpen: () => void }) {
  const bad = shift.conflicts.filter((c) => c.severity !== "info");
  const severe = bad.some((c) => c.severity === "violation");
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/shift", shift.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      title={shift.conflicts.map((c) => `• ${c.message}`).join("\n") || undefined}
      aria-label={`Schicht ${formatTime(shift.startsAt)} bis ${formatTime(shift.endsAt)}${shift.status === "draft" ? ", Entwurf" : ""}${bad.length ? `, ${bad.length} Konflikt${bad.length === 1 ? "" : "e"}` : ""}`}
      className={cn(
        "block w-full cursor-grab rounded-[12px] border px-2 py-1.5 text-left transition-transform active:scale-[0.98] active:cursor-grabbing",
        shift.status === "draft" ? "border-dashed border-line-strong bg-surface" : "border-transparent bg-surface-3",
        severe && "border-alert bg-alert-soft",
        !severe && bad.length > 0 && "border-pause",
      )}
    >
      <span className="tabular flex items-center gap-1 text-xs font-semibold">
        {(severe || bad.length > 0) && <AlertTriangle className={cn("h-3 w-3 shrink-0", severe ? "text-alert" : "text-pause")} aria-hidden />}
        {formatTime(shift.startsAt)}–{formatTime(shift.endsAt)}
      </span>
      {shift.position && <span className="block truncate text-[11px] text-fg-2">{shift.position}</span>}
    </button>
  );
}

function ShiftEditor({ editing, plan, onClose, onDone }: { editing: Editing; plan: WeekPlan; onClose: () => void; onDone: () => void }) {
  const s = editing.shift;
  const [membershipId, setMembershipId] = useState<string>(editing.membershipId ?? OPEN);
  const [date, setDate] = useState(editing.date);
  const [from, setFrom] = useState(s ? formatTime(s.startsAt) : plan.templates[1]?.start ?? "08:00");
  const [to, setTo] = useState(s ? formatTime(s.endsAt) : plan.templates[1]?.end ?? "16:30");
  const [breakMin, setBreakMin] = useState(s?.breakMinutes ?? plan.templates[1]?.breakMinutes ?? 30);
  const [position, setPosition] = useState(s?.position ?? "");
  const [pending, start] = useTransition();
  const field = "h-12 w-full rounded-[16px] border border-line bg-surface-2 px-3 text-[15px] text-fg";
  const locationId = s?.locationId ?? plan.locationId ?? plan.people.find((p) => p.id === membershipId)?.locationId ?? plan.locations[0]?.id;

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={s ? "Schicht bearbeiten" : "Neue Schicht"} description={formatDayLong(date)}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!locationId) return void toast.error("Bitte zuerst einen Standort anlegen.");
          start(async () => {
            const res = await saveShift({ id: s?.id, locationId, membershipId: membershipId === OPEN ? null : membershipId, date, from, to, breakMinutes: breakMin, position });
            if (!res.ok) return void toast.error(res.error);
            haptic("success");
            toast.success(s ? "Schicht gespeichert" : "Schicht angelegt (Entwurf)");
            onDone();
          });
        }}
      >
        {plan.templates.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Vorlagen">
            {plan.templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  haptic("tick");
                  setFrom(t.start);
                  setTo(t.end);
                  setBreakMin(t.breakMinutes);
                }}
                className={cn("h-9 rounded-full px-3.5 text-sm font-semibold", from === t.start && to === t.end ? "bg-inverse text-inverse-fg" : "bg-surface-2 text-fg-2 hover:text-fg")}
              >
                {t.name} <span className="tabular font-normal opacity-70">{t.start}–{t.end}</span>
              </button>
            ))}
          </div>
        )}
        <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
          Person
          <select className={field} value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
            <option value={OPEN}>Offen (Schichtbörse)</option>
            {plan.people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
            Tag
            <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
            Von
            <input type="time" className={cn(field, "tabular")} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
            Bis
            <input type="time" className={cn(field, "tabular")} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {to <= from && <p className="text-sm text-fg-2">Endet am Folgetag (Nachtschicht).</p>}
        <p className="text-[16px] leading-[2.6]">
          Pause <Stepper label="Pause in Minuten" value={breakMin} step={15} max={120} onChange={setBreakMin} /> Minuten
        </p>
        <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
          Position (optional)
          <input className={field} value={position} onChange={(e) => setPosition(e.target.value)} placeholder="z. B. Kasse, Lager" />
        </label>

        {s && s.conflicts.length > 0 && (
          <ul className="space-y-2">
            {s.conflicts.map((c) => (
              <li key={c.message} className={cn("rounded-[16px] px-4 py-3 text-sm", c.severity === "violation" ? "bg-alert-soft" : c.severity === "warning" ? "bg-pause-soft" : "bg-surface-2")}>
                {c.message} {c.law && <span className="text-fg-3">· {c.law}</span>}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          {s && (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              aria-label={s.status === "draft" ? "Schicht löschen" : "Schicht absagen"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteShift(s.id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(s.status === "draft" ? "Gelöscht" : "Abgesagt");
                  onDone();
                })
              }
            >
              <Trash2 className="h-5 w-5" aria-hidden />
            </Button>
          )}
          <Button type="submit" size="lg" block loading={pending}>
            {s ? "Speichern" : "Anlegen"}
          </Button>
        </div>
        {s?.status === "published" && <p className="text-center text-xs text-fg-3">Bereits veröffentlicht – Änderungen sieht das Team sofort.</p>}
      </form>
    </Sheet>
  );
}
