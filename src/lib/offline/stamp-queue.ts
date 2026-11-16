import { createStore, get, set } from "idb-keyval";
import type { EventKind } from "@/features/stamping/day-state";

/**
 * Offline-Puffer für Stempelungen (IndexedDB).
 * Jede Buchung trägt eine Client-UUID → der Server legt sie genau einmal an,
 * auch wenn der Sync mehrfach versucht wird.
 */
export interface QueuedStamp {
  id: string;
  membershipId: string;
  kind: EventKind;
  occurredAt: string;
  source: "app";
  queuedAt: string;
}

const KEY = "stamp-queue";
let store: ReturnType<typeof createStore> | null = null;
const db = () => (store ??= createStore("zeitgeist", "offline"));

export async function readQueue(): Promise<QueuedStamp[]> {
  if (typeof indexedDB === "undefined") return [];
  return (await get<QueuedStamp[]>(KEY, db())) ?? [];
}

export async function enqueue(item: QueuedStamp): Promise<void> {
  const q = await readQueue();
  if (!q.some((x) => x.id === item.id)) q.push(item);
  await set(KEY, q, db());
}

export async function removeFromQueue(id: string): Promise<void> {
  const q = await readQueue();
  await set(KEY, q.filter((x) => x.id !== id), db());
}

/** Fehler, bei denen sich ein späterer Versuch lohnt (Netzwerk statt Geschäftsregel). */
export function isNetworkError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request failed") || m.includes("load failed") || err.code === "";
}
