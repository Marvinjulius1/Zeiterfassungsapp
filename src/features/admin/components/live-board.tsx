"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Avatar } from "@/design-system/components/avatar";
import { Card } from "@/design-system/components/card";
import { RollingNumber } from "@/design-system/components/rolling-number";
import { spring } from "@/design-system/motion";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/time/berlin";
import { formatHours } from "@/lib/time/format";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { summarizeDay, type DayEvent } from "@/features/stamping/day-state";

export interface LivePerson {
  id: string;
  name: string;
  locationName: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  absence: string | null;
}

type Group = "in" | "break" | "expected" | "missing" | "absent" | "done";

const GROUPS: { id: Group; label: string; dot: string }[] = [
  { id: "in", label: "Da", dot: "bg-ok" },
  { id: "break", label: "Pause", dot: "bg-pause" },
  { id: "expected", label: "Erwartet", dot: "bg-fg-3" },
  { id: "missing", label: "Ohne Buchung", dot: "bg-alert" },
  { id: "absent", label: "Abwesend", dot: "bg-fg-3" },
  { id: "done", label: "Feierabend", dot: "bg-fg-3" },
];

export function LiveBoard({
  orgId,
  people,
  initialEvents,
}: {
  orgId: string;
  people: LivePerson[];
  initialEvents: Record<string, DayEvent[]>;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [connected, setConnected] = useState(false);
  const now = useNow();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_events", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = payload.new as { id: string; membership_id: string; kind: DayEvent["kind"]; occurred_at: string; voided_at: string | null };
          if (!row?.membership_id) return;
          setEvents((all) => {
            const list = (all[row.membership_id] ?? []).filter((e) => e.id !== row.id);
            return { ...all, [row.membership_id]: row.voided_at ? list : [...list, { id: row.id, kind: row.kind, occurredAt: row.occurred_at }] };
          });
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  const grouped = useMemo(() => {
    const out: Record<Group, { person: LivePerson; detail: string }[]> = { in: [], break: [], expected: [], missing: [], absent: [], done: [] };
    for (const p of people) {
      const ev = events[p.id] ?? [];
      const s = summarizeDay(ev, now);
      if (s.state === "in") out.in.push({ person: p, detail: `seit ${formatTime(s.blockStart!)} · ${formatHours(Math.floor(s.netSeconds / 60))}` });
      else if (s.state === "break") out.break.push({ person: p, detail: `seit ${formatTime(s.breakStart!)}` });
      else if (p.absence) out.absent.push({ person: p, detail: p.absence });
      else if (s.lastOut) out.done.push({ person: p, detail: `${formatHours(Math.floor(s.netSeconds / 60))} · bis ${formatTime(s.lastOut)}` });
      else if (p.shiftStart) {
        const started = now.getTime() > new Date(p.shiftStart).getTime() + 5 * 60000;
        const ended = p.shiftEnd !== null && now.getTime() > new Date(p.shiftEnd).getTime();
        if (ended) out.missing.push({ person: p, detail: `Schicht ${formatTime(p.shiftStart)}–${formatTime(p.shiftEnd!)} · nicht gestempelt` });
        else out.expected.push({ person: p, detail: started ? `Schicht seit ${formatTime(p.shiftStart)} · noch nicht da` : `Schicht ab ${formatTime(p.shiftStart)}` });
      }
    }
    return out;
  }, [people, events, now]);

  return (
    <Card className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold">Wer ist gerade da?</h2>
          <p className="mt-0.5 text-sm text-fg-2">Aktualisiert sich in Echtzeit</p>
        </div>
        <span className={cn("flex items-center gap-2 text-sm font-medium", connected ? "text-ok" : "text-fg-3")} aria-live="polite">
          <span className="relative flex h-2 w-2" aria-hidden>
            {connected && <span className="absolute inset-0 rounded-full bg-ok" style={{ animation: "zg-pulse-dot 1.8s ease-out infinite" }} />}
            <span className={cn("relative h-2 w-2 rounded-full", connected ? "bg-ok" : "bg-fg-3")} />
          </span>
          {connected ? "Live" : "Verbinde …"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {GROUPS.map((g) => (
          <div key={g.id} className="rounded-[18px] bg-surface-2 p-4">
            <p className="flex items-center gap-2 text-sm text-fg-2">
              <span className={cn("h-2 w-2 rounded-full", g.dot)} aria-hidden /> {g.label}
            </p>
            <p className="mt-1 text-3xl font-semibold">
              <RollingNumber value={String(grouped[g.id].length)} aria-label={`${grouped[g.id].length} ${g.label}`} />
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {GROUPS.filter((g) => grouped[g.id].length > 0).map((g) => (
          <section key={g.id} aria-label={g.label}>
            <h3 className="mb-2 text-sm font-semibold text-fg-3">{g.label}</h3>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false} mode="popLayout">
                {grouped[g.id].map(({ person, detail }) => (
                  <motion.li
                    key={person.id}
                    layout
                    layoutId={`live-${person.id}`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={spring.gentle}
                    className="flex items-center gap-3 rounded-[18px] border border-line p-3"
                  >
                    <span className="relative">
                      <Avatar name={person.name} size={36} />
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface", g.dot)} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{person.name}</span>
                      <span className="tabular block truncate text-sm text-fg-2">{detail}</span>
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}
