"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, CloudOff, Coffee, LogIn, LogOut, Play } from "lucide-react";
import { BigNumber } from "@/design-system/components/big-number";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { HoldButton } from "@/design-system/components/hold-button";
import { ProgressRing } from "@/design-system/components/progress-ring";
import { StatusPill, type WorkStatus } from "@/design-system/components/status-pill";
import { toast } from "@/design-system/components/toaster";
import { spring } from "@/design-system/motion";
import { haptic } from "@/lib/haptics";
import { berlinDateKey, formatTime, relativeDayLabel } from "@/lib/time/berlin";
import { formatClock, formatHours, formatMinutesShort } from "@/lib/time/format";
import { useNow } from "@/lib/use-now";
import type { DayEvent, EventKind } from "../day-state";
import { buildHints } from "../hints";
import type { NextShift } from "../queries";
import { useStamping } from "../use-stamping";
import { HintList } from "./hint-card";
import { Timeline } from "./timeline";
import { AppStampMethods } from "@/features/terminal/app-methods";

export interface TodayViewProps {
  membershipId: string;
  workDate: string;
  initialEvents: DayEvent[];
  targetMinutes: number;
  isMinor: boolean;
  requireGeofence?: boolean;
  geoConsent?: boolean;
  weekMinutesBefore: number;
  nextShift: NextShift | null;
}

const SUCCESS: Record<EventKind, string> = {
  check_in: "Eingecheckt",
  break_start: "Pause gestartet",
  break_end: "Pause beendet – weiter geht's",
  check_out: "Ausgecheckt. Schönen Feierabend!",
};

export function TodayView(props: TodayViewProps) {
  const router = useRouter();
  const now = useNow();
  const { events, summary, stamp, busy, pendingCount } = useStamping(props.membershipId, props.initialEvents, now, {
    geofence: props.requireGeofence && props.geoConsent,
  });

  useEffect(() => {
    const onRejected = (e: Event) =>
      toast.error("Eine Offline-Buchung wurde abgelehnt", { description: (e as CustomEvent<string>).detail });
    window.addEventListener("zg:stamp-rejected", onRejected);
    return () => window.removeEventListener("zg:stamp-rejected", onRejected);
  }, []);

  async function act(kind: EventKind) {
    const res = await stamp(kind);
    if (!res.ok) {
      if (kind === "check_in" && props.requireGeofence && !props.geoConsent) {
        toast.warning("Standort-Einwilligung nötig", {
          description: "Deine Firma erlaubt das Einchecken per App nur vor Ort. Erlaube die Standortprüfung im Profil – oder nutze das Terminal.",
          action: { label: "Zum Profil", onClick: () => router.push("/app/profil") },
        });
      } else if (res.needsLocation) {
        toast.warning("Standort nicht verfügbar", { description: "Bitte erlaube den Standortzugriff im Browser – oder nutze das Terminal." });
      } else if (res.blocked) toast.warning("Gerade nicht möglich", { description: res.error });
      else toast.error(res.error ?? "Das hat nicht geklappt.");
      return;
    }
    for (const w of res.warnings ?? []) {
      toast.warning(w.message, { duration: 8000 });
    }
    if (kind !== "check_in" && kind !== "check_out") haptic("medium");
    const time = res.event ? formatTime(res.event.occurredAt) : "";
    if (res.offline) toast("Offline gespeichert", { description: `${SUCCESS[kind]} um ${time}. Wird synchronisiert, sobald du wieder online bist.` });
    else toast.success(kind === "check_out" ? SUCCESS[kind] : `${SUCCESS[kind]} um ${time}`);
  }

  const hints = useMemo(
    () =>
      buildHints({
        summary,
        now,
        isMinor: props.isMinor,
        targetMinutes: props.targetMinutes,
        weekMinutesBefore: props.weekMinutesBefore,
      }),
    [summary, now, props.isMinor, props.targetMinutes, props.weekMinutesBefore],
  );

  const netMin = Math.floor(summary.netSeconds / 60);
  const status: WorkStatus = summary.state === "in" ? "checked_in" : summary.state === "break" ? "on_break" : "checked_out";
  const statusLabel =
    summary.state === "in" && summary.blockStart
      ? `Eingecheckt seit ${formatTime(summary.blockStart)}`
      : summary.state === "break" && summary.breakStart
        ? `Pause seit ${formatTime(summary.breakStart)}`
        : summary.lastOut
          ? `Ausgecheckt um ${formatTime(summary.lastOut)}`
          : "Nicht eingecheckt";

  const breakLive = summary.breakStart ? Math.floor((now.getTime() - summary.breakStart.getTime()) / 1000) : 0;
  const remaining = props.targetMinutes - netMin;
  const caption =
    props.targetMinutes === 0
      ? "Heute kein Soll – jede Minute ist Plus."
      : remaining > 0
        ? `von ${formatHours(props.targetMinutes)} Soll · noch ${formatHours(remaining)}`
        : `${formatHours(-remaining, { sign: true })} über deinem Soll`;
  const isOtherDay = props.workDate !== berlinDateKey(now);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={status} label={statusLabel} />
        {pendingCount > 0 && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[13px] font-semibold text-fg-2">
            <CloudOff className="h-3.5 w-3.5" aria-hidden />
            {pendingCount === 1 ? "1 Buchung wartet" : `${pendingCount} Buchungen warten`}
          </span>
        )}
      </div>

      {/* Hero: die Live-Uhr */}
      <section aria-label="Arbeitszeit heute">
        <BigNumber
          label={isOtherDay ? `Arbeitstag ${relativeDayLabel(props.workDate)}` : "Heute gearbeitet"}
          value={formatClock(summary.netSeconds)}
          caption={caption}
          ariaLabel={`Heute gearbeitet: ${formatHours(netMin)}`}
        />
        <AnimatePresence>
          {summary.state === "break" && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.gentle}
              className="mt-3 flex items-center gap-2 text-lg font-semibold text-pause"
            >
              <Coffee className="h-5 w-5" aria-hidden />
              Pause <span className="tabular">{formatClock(breakLive)}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      {/* Ring + Haupt-Aktion */}
      <section className="flex flex-col items-center gap-6" aria-label="Stempeln">
        <ProgressRing
          size={292}
          stroke={7}
          value={props.targetMinutes > 0 ? netMin / props.targetMinutes : 0}
          tone={summary.state === "break" ? "pause" : summary.state === "in" ? "ok" : "fg"}
          label={`Tagesfortschritt: ${props.targetMinutes > 0 ? Math.round((netMin / props.targetMinutes) * 100) : 0} Prozent`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={summary.state}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={spring.snappy}
            >
              {summary.state === "out" && (
                <HoldButton
                  size={204}
                  hint={null}
                  label="Einchecken"
                  tone="ok"
                  icon={<LogIn className="h-7 w-7" aria-hidden />}
                  disabled={busy}
                  onComplete={() => act("check_in")}
                />
              )}
              {summary.state === "in" && (
                <HoldButton
                  size={204}
                  hint={null}
                  label="Auschecken"
                  tone="fg"
                  icon={<LogOut className="h-7 w-7" aria-hidden />}
                  disabled={busy}
                  onComplete={() => act("check_out")}
                />
              )}
              {summary.state === "break" && (
                <HoldButton
                  size={204}
                  hint={null}
                  duration={600}
                  label="Weiter"
                  tone="pause"
                  icon={<Play className="h-7 w-7" aria-hidden />}
                  disabled={busy}
                  onComplete={() => act("break_end")}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </ProgressRing>

        <p className="-mt-2 text-sm text-fg-2" aria-hidden>
          {summary.state === "break" ? "Gedrückt halten, um die Pause zu beenden" : "Gedrückt halten"}
        </p>

        <div className="flex w-full gap-3">
          {summary.state === "in" && (
            <Button variant="secondary" size="lg" block disabled={busy} onClick={() => act("break_start")}>
              <Coffee className="h-5 w-5" aria-hidden /> Pause starten
            </Button>
          )}
          {summary.state === "break" && (
            <Button variant="secondary" size="lg" block disabled={busy} onClick={() => act("check_out")}>
              <LogOut className="h-5 w-5" aria-hidden /> Auschecken
            </Button>
          )}
        </div>
      </section>

      <AppStampMethods />

      {hints.length > 0 && <HintList hints={hints} />}

      {events.length > 0 && (
        <Card className="py-2">
          <Timeline events={events} />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-sm text-fg-2">Diese Woche</p>
          <p className="tabular mt-1 text-xl font-semibold">{formatHours(props.weekMinutesBefore + netMin)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-fg-2">Pausen heute</p>
          <p className="tabular mt-1 text-xl font-semibold">{formatMinutesShort(summary.breakSeconds / 60)}</p>
        </Card>
      </div>

      {props.nextShift && <NextShiftCard shift={props.nextShift} />}
    </div>
  );
}

function NextShiftCard({ shift }: { shift: NextShift }) {
  const day = relativeDayLabel(berlinDateKey(new Date(shift.startsAt)));
  return (
    <Card className="flex items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden>
        <CalendarClock className="h-5 w-5 text-fg-2" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg-2">Nächste Schicht</p>
        <p className="truncate text-[15px] font-semibold">
          {day}, {formatTime(shift.startsAt)} – {formatTime(shift.endsAt)}
        </p>
      </div>
      {shift.locationName && <span className="text-sm text-fg-2">{shift.locationName}</span>}
    </Card>
  );
}
