import { createStore, get, set } from "idb-keyval";

/** Offline-Puffer des Terminals: rohe Identifikation + Zeitpunkt, geprüft wird beim Sync. */
export interface QueuedTerminalStamp {
  eventId: string;
  method: "personal_qr" | "pin" | "rfid";
  value: string;
  occurredAt: string;
}

const KEY = "terminal-queue";
let store: ReturnType<typeof createStore> | null = null;
const db = () => (store ??= createStore("zeitgeist-terminal", "offline"));

export async function readTerminalQueue(): Promise<QueuedTerminalStamp[]> {
  if (typeof indexedDB === "undefined") return [];
  return (await get<QueuedTerminalStamp[]>(KEY, db())) ?? [];
}

export async function pushTerminalQueue(item: QueuedTerminalStamp) {
  const q = await readTerminalQueue();
  q.push(item);
  await set(KEY, q, db());
}

export async function dropFromTerminalQueue(ids: string[]) {
  const q = await readTerminalQueue();
  await set(KEY, q.filter((x) => !ids.includes(x.eventId)), db());
}
