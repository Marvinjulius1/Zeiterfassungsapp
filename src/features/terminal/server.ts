import "server-only";
import { cookies } from "next/headers";
import { addDaysKey, dateKeyOf, type EventKind, type StampMethod } from "@/compliance";
import { checkStamp } from "@/features/compliance/check-stamp";
import { evaluateMemberRange } from "@/features/compliance/evaluate-member";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import { credentialHash, hmac, randomHex, sha256Hex, signTicket, verifyCode, verifyTicket } from "./crypto";

export const TERMINAL_COOKIE = "zg_terminal";
const TICKET_TTL = 180; // Sekunden
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 5;

// ---------------------------------------------------------------------------
// Geheimnisse
// ---------------------------------------------------------------------------
let warned = false;
/** Pepper für PIN/RFID-Hashes. In Produktion zwingend setzen und nie ändern. */
export function pepper(): string {
  const p = process.env.ZEITGEIST_PEPPER;
  if (p && p.length >= 32) return p;
  if (process.env.NODE_ENV === "production") throw new Error("ZEITGEIST_PEPPER (≥ 32 Zeichen) fehlt.");
  if (!warned) {
    console.warn("⚠️  ZEITGEIST_PEPPER nicht gesetzt – nutze unsicheren Entwicklungswert.");
    warned = true;
  }
  return "zeitgeist-dev-pepper-do-not-use-in-production";
}

async function ticketKey(): Promise<string> {
  const base = process.env.ZEITGEIST_PEPPER ?? process.env.SUPABASE_SECRET_KEY ?? "dev";
  return Array.from(await hmac(base, "zeitgeist-ticket-v1"), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Terminal-Gerät
// ---------------------------------------------------------------------------
export interface TerminalInfo {
  id: string;
  name: string;
  orgId: string;
  orgName: string;
  locationId: string;
  locationName: string;
  allowedMethods: string[];
}

/** Liest und prüft das Geräte-Cookie. */
export async function getTerminal(admin: AdminClient = createAdminClient()): Promise<TerminalInfo | null> {
  const raw = (await cookies()).get(TERMINAL_COOKIE)?.value;
  if (!raw) return null;
  const [terminalId, token] = raw.split(".");
  if (!terminalId || !token) return null;
  const { data } = await admin
    .from("terminal_secrets")
    .select("terminal_id, terminals!inner(id, name, org_id, location_id, revoked_at, allowed_methods, organizations(name), locations(name))")
    .eq("terminal_id", terminalId)
    .eq("device_token_hash", await sha256Hex(token))
    .is("terminals.revoked_at", null)
    .maybeSingle();
  const t = data?.terminals;
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    orgId: t.org_id,
    orgName: t.organizations?.name ?? "",
    locationId: t.location_id,
    locationName: t.locations?.name ?? "",
    allowedMethods: t.allowed_methods,
  };
}

export async function touchTerminal(admin: AdminClient, terminalId: string) {
  await admin.from("terminals").update({ last_seen_at: new Date().toISOString() }).eq("id", terminalId);
}

/** Kopplung: einmaliger 6-stelliger Code → Geräte-Token + Signaturschlüssel für QR-Codes. */
export async function pairTerminal(code: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("terminal_secrets")
    .select("terminal_id, signing_secret, pairing_expires_at, terminals!inner(revoked_at)")
    .eq("pairing_code_hash", await sha256Hex(code.trim()))
    .is("terminals.revoked_at", null)
    .maybeSingle();
  if (!data || !data.pairing_expires_at || new Date(data.pairing_expires_at) < new Date()) return null;
  const deviceToken = randomHex(32);
  const { error } = await admin
    .from("terminal_secrets")
    .update({
      device_token_hash: await sha256Hex(deviceToken),
      paired_at: new Date().toISOString(),
      pairing_code_hash: null,
      pairing_expires_at: null,
    })
    .eq("terminal_id", data.terminal_id);
  if (error) return null;
  await touchTerminal(admin, data.terminal_id);
  return { terminalId: data.terminal_id, deviceToken, signingSecret: data.signing_secret };
}

export async function verifyKioskPin(admin: AdminClient, terminalId: string, pin: string): Promise<boolean> {
  const { data } = await admin.from("terminal_secrets").select("kiosk_pin_hash").eq("terminal_id", terminalId).single();
  return !!data?.kiosk_pin_hash && data.kiosk_pin_hash === (await sha256Hex(`kiosk:${terminalId}:${pin}`));
}

export async function kioskPinHash(terminalId: string, pin: string) {
  return sha256Hex(`kiosk:${terminalId}:${pin}`);
}

// ---------------------------------------------------------------------------
// Identifikation
// ---------------------------------------------------------------------------
export type IdentifyMethod = Extract<StampMethod, "personal_qr" | "pin" | "rfid">;

export interface Identified {
  membershipId: string;
  name: string;
  firstName: string;
  state: "out" | "in" | "break";
}

async function isLocked(admin: AdminClient, terminalId: string): Promise<boolean> {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60000).toISOString();
  const { count } = await admin
    .from("terminal_auth_failures")
    .select("id", { count: "exact", head: true })
    .eq("terminal_id", terminalId)
    .gte("created_at", since);
  return (count ?? 0) >= MAX_FAILURES;
}

export type IdentifyResult = { ok: true; person: Identified } | { ok: false; error: string; locked?: boolean };

export async function identify(
  admin: AdminClient,
  terminal: TerminalInfo,
  method: IdentifyMethod,
  value: string,
  atMs: number = Date.now(),
): Promise<IdentifyResult> {
  if (!terminal.allowedMethods.includes(method)) return { ok: false, error: "Dieser Weg ist an diesem Terminal nicht aktiviert." };
  if (method !== "personal_qr" && (await isLocked(admin, terminal.id))) {
    return { ok: false, error: `Zu viele Fehlversuche. Bitte ${LOCKOUT_MINUTES} Minuten warten.`, locked: true };
  }

  let membershipId: string | null = null;
  if (method === "personal_qr") {
    const res = await verifyCode(
      value,
      "P1",
      async (id) => {
        const { data } = await admin.from("member_credentials").select("personal_qr_secret").eq("membership_id", id).eq("org_id", terminal.orgId).maybeSingle();
        return data?.personal_qr_secret ?? null;
      },
      atMs,
    );
    if (!res.ok) return { ok: false, error: res.reason === "expired" ? "Der Code ist abgelaufen. Bitte neu öffnen." : "Unbekannter Code." };
    membershipId = res.id;
  } else {
    const hash = await credentialHash(pepper(), terminal.orgId, method, value);
    const { data } = await admin
      .from("member_credentials")
      .select("membership_id")
      .eq("org_id", terminal.orgId)
      .eq(method === "pin" ? "pin_hash" : "rfid_uid_hash", hash)
      .maybeSingle();
    membershipId = data?.membership_id ?? null;
    if (!membershipId) {
      await admin.from("terminal_auth_failures").insert({ terminal_id: terminal.id, method });
      return { ok: false, error: method === "pin" ? "PIN nicht erkannt." : "Chip nicht erkannt." };
    }
  }

  const [{ data: m }, { data: state }] = await Promise.all([
    admin.from("memberships").select("id, display_name, status").eq("id", membershipId).eq("org_id", terminal.orgId).maybeSingle(),
    admin.rpc("member_stamp_state", { p_membership_id: membershipId }),
  ]);
  if (!m || m.status !== "active") return { ok: false, error: "Diese Person ist nicht aktiv." };
  return {
    ok: true,
    person: { membershipId: m.id, name: m.display_name, firstName: m.display_name.split(" ")[0], state: (state ?? "out") as Identified["state"] },
  };
}

// ---------------------------------------------------------------------------
// Tickets & Stempeln
// ---------------------------------------------------------------------------
export interface StampTicket {
  m: string; // membershipId
  t: string; // terminalId
  s: "terminal_qr" | IdentifyMethod;
}

export async function issueTicket(payload: StampTicket) {
  return signTicket(await ticketKey(), payload, TICKET_TTL, Date.now());
}

export async function readTicket(ticket: string) {
  return verifyTicket<StampTicket>(await ticketKey(), ticket, Date.now());
}

export type TerminalStampResult =
  | { ok: true; kind: EventKind; occurredAt: string; warnings: string[] }
  /** retryable: technischer Fehler (später erneut senden) – fachliche Ablehnungen sind endgültig */
  | { ok: false; error: string; blocked?: boolean; retryable?: boolean };

/** Stempelt nach erfolgreicher Identifikation – mit Regelprüfung bei Live-Buchungen. */
export async function stampViaTerminal(
  admin: AdminClient,
  opts: {
    terminalId: string;
    membershipId: string;
    source: StampTicket["s"];
    kind: EventKind | null; // null = automatisch
    eventId: string;
    offline?: boolean;
    occurredAt?: string;
  },
): Promise<TerminalStampResult> {
  const now = new Date();
  let warnings: string[] = [];
  if (!opts.offline) {
    let kind = opts.kind;
    if (!kind) {
      // Doppel-Scan-Schutz: automatische Aktion direkt nach einer Buchung wäre fast immer ein Versehen
      const { data: last } = await admin
        .from("time_events")
        .select("occurred_at")
        .eq("membership_id", opts.membershipId)
        .is("voided_at", null)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last && now.getTime() - new Date(last.occurred_at).getTime() < 60_000) {
        return { ok: false, error: "Du hast gerade eben schon gestempelt ✓" };
      }
      const { data: state } = await admin.rpc("member_stamp_state", { p_membership_id: opts.membershipId });
      kind = state === "out" ? "check_in" : state === "break" ? "break_end" : "check_out";
    }
    const decision = await checkStamp(admin, opts.membershipId, kind, opts.source, now);
    if (!decision.allowed) return { ok: false, error: decision.blockReason ?? "Nicht erlaubt", blocked: true };
    warnings = decision.warnings.map((w) => w.message);
  }

  const { data, error } = await admin.rpc("terminal_stamp", {
    p_terminal_id: opts.terminalId,
    p_membership_id: opts.membershipId,
    p_event_id: opts.eventId,
    p_kind: opts.kind ?? undefined,
    p_source: opts.source,
    p_offline: !!opts.offline,
    p_occurred_at: opts.occurredAt,
  });
  if (error || !data) {
    const business = error?.code === "P0001" || error?.code === "42501";
    return { ok: false, error: business ? error.message : "Stempeln fehlgeschlagen", retryable: !business };
  }

  try {
    const to = dateKeyOf(now) > data.work_date ? dateKeyOf(now) : data.work_date;
    // Beim Einchecken auch die Vortage bewerten (z. B. „Ausstempeln fehlt“ sofort sichtbar)
    await evaluateMemberRange(admin, opts.membershipId, data.kind === "check_in" ? addDaysKey(data.work_date, -2) : data.work_date, to, now);
  } catch (e) {
    console.error("Compliance-Bewertung fehlgeschlagen", e);
  }
  return { ok: true, kind: data.kind, occurredAt: data.occurred_at, warnings };
}

/** Terminal-QR (vom Handy gescannt) prüfen → zugehöriges Terminal */
export async function verifyTerminalCode(
  admin: AdminClient,
  code: string,
): Promise<{ ok: true; terminal: { id: string; orgId: string; locationName: string } } | { ok: false; reason: "expired" | "unknown" }> {
  const found = new Map<string, { id: string; orgId: string; locationName: string }>();
  const res = await verifyCode(
    code,
    "T1",
    async (id) => {
      const { data } = await admin
        .from("terminal_secrets")
        .select("signing_secret, terminals!inner(id, org_id, revoked_at, locations(name))")
        .eq("terminal_id", id)
        .is("terminals.revoked_at", null)
        .maybeSingle();
      if (!data) return null;
      found.set(id, { id: data.terminals.id, orgId: data.terminals.org_id, locationName: data.terminals.locations?.name ?? "" });
      return data.signing_secret;
    },
    Date.now(),
  );
  if (!res.ok) return { ok: false, reason: res.reason === "expired" ? "expired" : "unknown" };
  const terminal = found.get(res.id);
  return terminal ? { ok: true, terminal } : { ok: false, reason: "unknown" };
}
