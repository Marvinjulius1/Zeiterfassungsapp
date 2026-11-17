"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StampResponse } from "@/app/api/stamp/route";
import { enqueue, isNetworkError, readQueue, removeFromQueue, type QueuedStamp } from "@/lib/offline/stamp-queue";
import { haptic } from "@/lib/haptics";
import { allowedActions, summarizeDay, type DayEvent, type EventKind } from "./day-state";

export interface StampResult {
  ok: boolean;
  offline?: boolean;
  blocked?: boolean;
  needsLocation?: boolean;
  error?: string;
  event?: DayEvent;
  warnings?: { code: string; message: string; severity: string }[];
}

/** Ruft /api/stamp auf. Wirft nur bei Netzwerkfehlern (→ Offline-Puffer). */
async function postStamp(body: {
  membershipId: string;
  eventId: string;
  kind: EventKind;
  offline?: boolean;
  occurredAt?: string;
  geo?: { lat: number; lng: number; accuracy?: number };
}): Promise<StampResponse> {
  const res = await fetch("/api/stamp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status >= 500) throw new TypeError("Server nicht erreichbar"); // später erneut versuchen
  return (await res.json()) as StampResponse;
}

/**
 * Stempel-Logik für die Mitarbeiter-App:
 * optimistisches Update → Server (stamp RPC) → bei Netzwerkfehler Offline-Puffer.
 */
/** Standort einmalig für den Check-in abfragen (kein Tracking). */
function currentPosition(): Promise<{ lat: number; lng: number; accuracy: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

export function useStamping(membershipId: string, initialEvents: DayEvent[], now: Date, opts: { geofence?: boolean } = {}) {
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
      for (const item of q) {
        let res: StampResponse;
        try {
          res = await postStamp({
            membershipId: item.membershipId,
            eventId: item.id,
            kind: item.kind,
            offline: true,
            occurredAt: item.occurredAt,
          });
        } catch {
          break; // weiterhin offline – später erneut
        }
        await removeFromQueue(item.id);
        if (!res.ok) {
          const msg = res.error;
          setEvents((ev) => ev.filter((e) => e.id !== item.id));
          window.dispatchEvent(new CustomEvent("zg:stamp-rejected", { detail: msg }));
        } else {
          const ev2 = res.event;
          setEvents((ev) => ev.map((e) => (e.id === item.id ? { ...e, occurredAt: ev2.occurredAt, pending: false } : e)));
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
        let res: StampResponse;
        try {
          const geo = opts.geofence && kind === "check_in" ? await currentPosition() : undefined;
          res = await postStamp({ membershipId, eventId: optimistic.id, kind, geo });
        } catch (e) {
          if (isNetworkError({ message: String(e), code: "" })) return await goOffline();
          throw e;
        }
        if (!res.ok) {
          setEvents((ev) => ev.filter((e) => e.id !== optimistic.id));
          haptic(res.blocked ? "warning" : "error");
          return { ok: false, error: res.error, blocked: res.blocked, needsLocation: res.needsLocation };
        }
        const confirmed: DayEvent = { id: res.event.id, kind: res.event.kind as EventKind, occurredAt: res.event.occurredAt };
        setEvents((ev) => ev.map((e) => (e.id === optimistic.id ? confirmed : e)));
        return { ok: true, event: confirmed, warnings: res.warnings };
      } finally {
        setBusy(false);
      }
    },
    [membershipId, refreshPending, summary.state, opts.geofence],
  );

  return { events, summary, stamp, busy, pendingCount, flush };
}
