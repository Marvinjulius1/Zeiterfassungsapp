"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enqueue, isNetworkError, readQueue, removeFromQueue, type QueuedStamp } from "@/lib/offline/stamp-queue";
import { haptic } from "@/lib/haptics";
import { allowedActions, summarizeDay, type DayEvent, type EventKind } from "./day-state";

export interface StampResult {
  ok: boolean;
  offline?: boolean;
  error?: string;
  event?: DayEvent;
}

/**
 * Stempel-Logik für die Mitarbeiter-App:
 * optimistisches Update → Server (stamp RPC) → bei Netzwerkfehler Offline-Puffer.
 */
export function useStamping(membershipId: string, initialEvents: DayEvent[], now: Date) {
  const [events, setEvents] = useState<DayEvent[]>(initialEvents);
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const flushing = useRef(false);

  const summary = useMemo(() => summarizeDay(events, now), [events, now]);

  const refreshPending = useCallback(async () => {
    const q = (await readQueue()).filter((x) => x.membershipId === membershipId);
    setPendingCount(q.length);
    return q;
  }, [membershipId]);

  /** Gepufferte Buchungen in Reihenfolge an den Server senden. */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const q = (await refreshPending()).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      const supabase = createClient();
      for (const item of q) {
        const { data, error } = await supabase.rpc("stamp", {
          p_membership_id: item.membershipId,
          p_event_id: item.id,
          p_kind: item.kind,
          p_source: item.source,
          p_offline: true,
          p_occurred_at: item.occurredAt,
        });
        if (error && isNetworkError(error)) break; // später erneut
        await removeFromQueue(item.id);
        if (error) {
          setEvents((ev) => ev.filter((e) => e.id !== item.id));
          window.dispatchEvent(new CustomEvent("zg:stamp-rejected", { detail: error.message }));
        } else if (data) {
          setEvents((ev) => ev.map((e) => (e.id === item.id ? { ...e, occurredAt: data.occurred_at, pending: false } : e)));
        }
      }
    } finally {
      flushing.current = false;
      await refreshPending();
    }
  }, [refreshPending]);

  // Beim Start: Puffer einlesen, anzeigen und synchronisieren
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const q = await refreshPending();
      if (cancelled || q.length === 0) return;
      setEvents((ev) => {
        const known = new Set(ev.map((e) => e.id));
        return [...ev, ...q.filter((x) => !known.has(x.id)).map((x) => ({ id: x.id, kind: x.kind, occurredAt: x.occurredAt, pending: true }))];
      });
      void flush();
    })();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [flush, refreshPending]);

  const stamp = useCallback(
    async (kind: EventKind): Promise<StampResult> => {
      if (!allowedActions(summary.state).includes(kind)) {
        return { ok: false, error: "Diese Aktion ist gerade nicht möglich." };
      }
      const optimistic: DayEvent = { id: crypto.randomUUID(), kind, occurredAt: new Date().toISOString(), pending: true };
      setEvents((ev) => [...ev, optimistic]);
      setBusy(true);

      const goOffline = async (): Promise<StampResult> => {
        const item: QueuedStamp = {
          id: optimistic.id,
          membershipId,
          kind,
          occurredAt: optimistic.occurredAt,
          source: "app",
          queuedAt: new Date().toISOString(),
        };
        await enqueue(item);
        await refreshPending();
        return { ok: true, offline: true, event: optimistic };
      };

      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) return await goOffline();
        const { data, error } = await createClient().rpc("stamp", {
          p_membership_id: membershipId,
          p_event_id: optimistic.id,
          p_kind: kind,
          p_source: "app",
        });
        if (error) {
          if (isNetworkError(error)) return await goOffline();
          setEvents((ev) => ev.filter((e) => e.id !== optimistic.id));
          haptic("error");
          return { ok: false, error: error.message };
        }
        const confirmed: DayEvent = { id: data.id, kind: data.kind, occurredAt: data.occurred_at };
        setEvents((ev) => ev.map((e) => (e.id === optimistic.id ? confirmed : e)));
        return { ok: true, event: confirmed };
      } finally {
        setBusy(false);
      }
    },
    [membershipId, refreshPending, summary.state],
  );

  return { events, summary, stamp, busy, pendingCount, flush };
}
