/**
 * Kryptografie für Terminal-Erfassung – Web Crypto, läuft identisch im Browser
 * (Terminal erzeugt QR-Codes auch offline) und auf dem Server (Prüfung).
 *
 * Terminal-QR:  T1.<terminalId>.<fenster>.<signatur>   (wechselt alle 30 s)
 * Eigener QR:   P1.<membershipId>.<fenster>.<signatur> (wechselt alle 30 s)
 * Ticket:       <base64url(json)>.<signatur>           (kurzlebige Bestätigung)
 */

export const WINDOW_SECONDS = 30;
/** Akzeptierte Abweichung in Fenstern (±1 = ±30 s → max. 60–90 s Gültigkeit) */
export const WINDOW_TOLERANCE = 1;

const enc = new TextEncoder();

export function windowOf(ms: number): number {
  return Math.floor(ms / 1000 / WINDOW_SECONDS);
}

/** Sekunden bis zum nächsten Codewechsel */
export function secondsLeft(ms: number): number {
  return WINDOW_SECONDS - Math.floor((ms / 1000) % WINDOW_SECONDS);
}

function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

const keyCache = new Map<string, Promise<CryptoKey>>();
function importKey(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    keyCache.set(secret, k);
  }
  return k;
}

export async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const sig = await crypto.subtle.sign("HMAC", await importKey(secret), enc.encode(message));
  return new Uint8Array(sig);
}

async function sign16(secret: string, message: string): Promise<string> {
  return toB64url((await hmac(secret, message)).slice(0, 12)); // 96 Bit genügen bei 60 s Gültigkeit
}

/** Vergleich in konstanter Zeit */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Rotierende Codes
// ---------------------------------------------------------------------------
export type CodeKind = "T1" | "P1";

export async function makeCode(kind: CodeKind, id: string, secret: string, nowMs: number): Promise<string> {
  const w = windowOf(nowMs);
  return `${kind}.${id}.${w}.${await sign16(secret, `${kind}.${id}.${w}`)}`;
}

export interface ParsedCode {
  kind: CodeKind;
  id: string;
  window: number;
  signature: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseCode(raw: string): ParsedCode | null {
  const code = extractCode(raw);
  if (!code) return null;
  const [kind, id, w, signature] = code.split(".");
  if ((kind !== "T1" && kind !== "P1") || !UUID.test(id) || !/^\d{1,12}$/.test(w) || !signature) return null;
  return { kind, id, window: Number(w), signature };
}

/** Code aus einer gescannten URL (…/scan?c=…) oder dem reinen Text holen */
export function extractCode(raw: string): string | null {
  const t = raw.trim();
  if (/^(T1|P1)\./.test(t)) return t;
  try {
    const c = new URL(t).searchParams.get("c");
    return c && /^(T1|P1)\./.test(c) ? c : null;
  } catch {
    return null;
  }
}

export type VerifyResult = { ok: true; id: string; window: number } | { ok: false; reason: "malformed" | "expired" | "signature" };

export async function verifyCode(raw: string, expected: CodeKind, secretFor: (id: string) => Promise<string | null>, nowMs: number): Promise<VerifyResult> {
  const p = parseCode(raw);
  if (!p || p.kind !== expected) return { ok: false, reason: "malformed" };
  if (Math.abs(p.window - windowOf(nowMs)) > WINDOW_TOLERANCE) return { ok: false, reason: "expired" };
  const secret = await secretFor(p.id);
  if (!secret) return { ok: false, reason: "signature" };
  const expectedSig = await sign16(secret, `${p.kind}.${p.id}.${p.window}`);
  return safeEqual(expectedSig, p.signature) ? { ok: true, id: p.id, window: p.window } : { ok: false, reason: "signature" };
}

// ---------------------------------------------------------------------------
// PIN & RFID: deterministischer HMAC je Firma (Lookup möglich, Klartext nie gespeichert)
// ---------------------------------------------------------------------------
export async function credentialHash(pepper: string, orgId: string, kind: "pin" | "rfid", value: string): Promise<string> {
  const normalized = kind === "rfid" ? value.trim().toUpperCase().replace(/[^0-9A-F]/g, "") : value.trim();
  const bytes = await hmac(pepper, `${kind}:${orgId}:${normalized}`);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin) && !/^(\d)\1+$/.test(pin) && !["1234", "12345", "123456", "4321", "654321"].includes(pin);
}

// ---------------------------------------------------------------------------
// Tickets: kurzlebige, signierte Bestätigung „diese Person darf jetzt stempeln"
// ---------------------------------------------------------------------------
export async function signTicket<T extends object>(secret: string, payload: T, ttlSeconds: number, nowMs: number): Promise<string> {
  const body = toB64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(nowMs / 1000) + ttlSeconds })));
  return `${body}.${toB64url(await hmac(secret, body))}`;
}

export async function verifyTicket<T extends object>(secret: string, ticket: string, nowMs: number): Promise<(T & { exp: number }) | null> {
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(toB64url(await hmac(secret, body)), sig)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(body))) as T & { exp: number };
    return data.exp >= Math.floor(nowMs / 1000) ? data : null;
  } catch {
    return null;
  }
}

/** Zufälliger Hex-String (z. B. Geräte-Token) */
export function randomHex(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}
