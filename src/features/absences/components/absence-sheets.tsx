"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, HeartPulse, Palmtree } from "lucide-react";
import { absenceWorkdays, weekdayOf } from "@/compliance";
import { Button } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";
import { RangeCalendar, type DateRange } from "@/design-system/components/range-calendar";
import { Sheet } from "@/design-system/components/sheet";
import { toast } from "@/design-system/components/toaster";
import { Toggle } from "@/design-system/components/toggle";
import { haptic } from "@/lib/haptics";
import { createClient } from "@/lib/supabase/client";
import { berlinDateKey, formatDayShort } from "@/lib/time/berlin";
import { requestAbsence } from "../actions";
import type { AbsenceContext } from "../queries";

type Ctx = Pick<AbsenceContext, "dailyTargets" | "schoolDays" | "holidays" | "balance" | "orgId" | "membershipId">;

function useWorkday(ctx: Ctx) {
  return useMemo(
    () => (d: string) => !ctx.holidays[d] && Number(ctx.dailyTargets[String(weekdayOf(d))] ?? 0) > 0 && !ctx.schoolDays.includes(weekdayOf(d)),
    [ctx],
  );
}

// ---------------------------------------------------------------------------
export function VacationSheet({ ctx }: { ctx: Ctx }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [halfStart, setHalfStart] = useState(false);
  const [halfEnd, setHalfEnd] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const isWorkday = useWorkday(ctx);
  const today = berlinDateKey();

  const end = range.end ?? range.start;
  const days = range.start && end ? absenceWorkdays({ start: range.start, end, halfDayStart: halfStart, halfDayEnd: halfEnd }, isWorkday) : 0;
  const after = ctx.balance.remainingAfterPending - days;

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Urlaub beantragen"
      description={`Noch ${ctx.balance.remainingAfterPending.toLocaleString("de-DE")} Tage verfügbar`}
      trigger={
        <Button size="lg" block>
          <Palmtree className="h-5 w-5" aria-hidden /> Urlaub
        </Button>
      }
    >
      <div className="space-y-5">
        <RangeCalendar
          value={range}
          onChange={setRange}
          minDate={today}
          describe={(d) => ({ off: !isWorkday(d), label: ctx.holidays[d] })}
        />
        {range.start && (
          <div className="space-y-3 rounded-[20px] bg-surface-2 p-4">
            <p className="text-[15px]">
              <strong>{formatDayShort(range.start)}</strong>
              {end !== range.start && <> – <strong>{formatDayShort(end!)}</strong></>}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-2">Erster Tag nur halb</span>
              <Toggle checked={halfStart} onCheckedChange={setHalfStart} label="Erster Tag nur halb" />
            </div>
            {end !== range.start && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg-2">Letzter Tag nur halb</span>
                <Toggle checked={halfEnd} onCheckedChange={setHalfEnd} label="Letzter Tag nur halb" />
              </div>
            )}
            <p className="text-[15px]" aria-live="polite">
              <strong className="tabular">{days.toLocaleString("de-DE")}</strong> Urlaubstag{days === 1 ? "" : "e"} · danach{" "}
              <strong className={after < 0 ? "text-alert" : ""}>{after.toLocaleString("de-DE")}</strong> übrig
            </p>
            {after < 0 && <p className="text-sm text-alert">Mehr als dein Resturlaub – deine Führungskraft entscheidet.</p>}
          </div>
        )}
        <Input label="Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Familienurlaub" />
        <Button
          size="lg"
          block
          loading={pending}
          disabled={!range.start || days === 0}
          onClick={() =>
            start(async () => {
              const res = await requestAbsence({ type: "vacation", start: range.start!, end: end!, halfStart, halfEnd, note });
              if (!res.ok) {
                haptic("error");
                toast.error(res.error);
                return;
              }
              haptic("success");
              toast.success("Urlaub beantragt 🌴", { description: "Du bekommst Bescheid, sobald er genehmigt ist." });
              setOpen(false);
              setRange({ start: null, end: null });
              router.refresh();
            })
          }
        >
          {days > 0 ? `${days.toLocaleString("de-DE")} Tag${days === 1 ? "" : "e"} beantragen` : "Zeitraum wählen"}
        </Button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
export function SickSheet({ ctx }: { ctx: Ctx }) {
  const router = useRouter();
  const today = berlinDateKey();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [child, setChild] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const isWorkday = useWorkday(ctx);
  const days = to >= from ? absenceWorkdays({ start: from, end: to }, isWorkday) : 0;
  const calendarDays = to >= from ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 0;

  async function submit() {
    let attachmentPath: string | undefined;
    if (file) {
      if (file.size > 20 * 1024 * 1024) return void toast.error("Das Foto ist größer als 20 MB.");
      attachmentPath = `${ctx.orgId}/${ctx.membershipId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_").slice(-60)}`;
      const { error } = await createClient().storage.from("documents").upload(attachmentPath, file, { contentType: file.type });
      if (error) return void toast.error("AU-Upload fehlgeschlagen", { description: error.message });
    }
    const res = await requestAbsence({ type: child ? "child_sick" : "sick", start: from, end: to, attachmentPath });
    if (!res.ok) {
      haptic("error");
      return void toast.error(res.error);
    }
    haptic("success");
    toast.success("Gute Besserung! 🤒", { description: "Deine Krankmeldung ist eingetragen." });
    setOpen(false);
    setFile(null);
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Krank melden"
      description="Gute Besserung! Die Meldung gilt sofort."
      trigger={
        <Button size="lg" variant="secondary" block>
          <HeartPulse className="h-5 w-5" aria-hidden /> Krank
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Von" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Bis (voraussichtlich)" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-medium">Kind krank</p>
            <p className="text-sm text-fg-2">Betreuung eines kranken Kindes (§ 45 SGB V)</p>
          </div>
          <Toggle checked={child} onCheckedChange={setChild} label="Kind krank" />
        </div>
        <div className="space-y-2">
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="sr-only"
            aria-label="Arbeitsunfähigkeitsbescheinigung"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="secondary" block onClick={() => input.current?.click()}>
            <Camera className="h-5 w-5" aria-hidden /> {file ? `✓ ${file.name}` : "AU fotografieren (optional)"}
          </Button>
          <p className="text-sm text-fg-3">
            {calendarDays > 3
              ? "Ab dem 4. Kalendertag brauchst du eine AU (§ 5 EFZG). Bei der eAU reicht der Hinweis – deine Firma ruft sie bei der Krankenkasse ab."
              : "Eine AU brauchst du meist erst ab dem 4. Tag – außer deine Firma verlangt sie früher."}
          </p>
        </div>
        <Button size="lg" block loading={pending} disabled={days === 0 && calendarDays === 0} onClick={() => start(submit)}>
          Krankmeldung senden
        </Button>
      </div>
    </Sheet>
  );
}
