"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STAMP_METHODS } from "@/compliance";
import { isOrgAdmin } from "@/lib/auth/roles";
import { requireAdminArea, requireMember } from "@/lib/auth/session";
import { STATE_CODES } from "@/lib/germany";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { credentialHash, sha256Hex } from "./crypto";
import { kioskPinHash, pepper } from "./server";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

async function requireOrgAdmin() {
  const viewer = await requireAdminArea();
  if (!isOrgAdmin(viewer.active.role)) throw new Error("Nur Owner und Admins.");
  return viewer;
}

/** 6-stellige Zufallszahl (gleichverteilt) */
function randomDigits(n = 6): string {
  const max = 10 ** n;
  const limit = Math.floor(0xffffffff / max) * max;
  let x: number;
  do x = crypto.getRandomValues(new Uint32Array(1))[0];
  while (x >= limit);
  return String(x % max).padStart(n, "0");
}

// ---------------------------------------------------------------------------
// Standorte
// ---------------------------------------------------------------------------
const locationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Bitte einen Namen angeben").max(120),
  address: z.string().trim().max(240).optional(),
  state: z.enum(STATE_CODES),
  geofence: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), radiusM: z.number().int().min(25).max(5000) })
    .nullable(),
});

export async function saveLocation(input: z.input<typeof locationSchema>): Promise<Result> {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  let viewer;
  try {
    viewer = await requireOrgAdmin();
  } catch (e) {
    return fail((e as Error).message);
  }
  const v = parsed.data;
  const row = {
    name: v.name,
    address: v.address || null,
    state: v.state,
    geofence_lat: v.geofence?.lat ?? null,
    geofence_lng: v.geofence?.lng ?? null,
    geofence_radius_m: v.geofence?.radiusM ?? null,
  };
  const supabase = await createClient();
  const { error } = v.id
    ? await supabase.from("locations").update(row).eq("id", v.id).eq("org_id", viewer.active.orgId)
    : await supabase.from("locations").insert({ ...row, org_id: viewer.active.orgId });
  if (error) return fail("Speichern fehlgeschlagen.");
  revalidatePath("/admin/standorte");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Terminals
// ---------------------------------------------------------------------------
async function issuePairingCode(terminalId: string) {
  const code = randomDigits(6);
  const { error } = await createAdminClient()
    .from("terminal_secrets")
    .update({ pairing_code_hash: await sha256Hex(code), pairing_expires_at: new Date(Date.now() + 15 * 60000).toISOString() })
    .eq("terminal_id", terminalId);
  if (error) throw error;
  return code;
}

const terminalSchema = z.object({
  locationId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  kioskPin: z.string().regex(/^\d{6}$/, "Die Kiosk-PIN muss 6 Ziffern haben."),
  methods: z.array(z.enum(STAMP_METHODS)).min(1),
});

export async function createTerminal(input: z.input<typeof terminalSchema>): Promise<Result<{ terminalId: string; code: string }>> {
  const parsed = terminalSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  let viewer;
  try {
    viewer = await requireOrgAdmin();
  } catch (e) {
    return fail((e as Error).message);
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data: t, error } = await supabase
    .from("terminals")
    .insert({
      org_id: viewer.active.orgId,
      location_id: v.locationId,
      name: v.name,
      allowed_methods: v.methods.filter((m) => m !== "app"),
    })
    .select("id")
    .single();
  if (error || !t) return fail("Terminal konnte nicht angelegt werden.");
  const admin = createAdminClient();
  const { error: sErr } = await admin.from("terminal_secrets").insert({ terminal_id: t.id, kiosk_pin_hash: await kioskPinHash(t.id, v.kioskPin) });
  if (sErr) return fail("Terminal-Schlüssel konnten nicht erzeugt werden.");
  const code = await issuePairingCode(t.id);
  revalidatePath("/admin/standorte");
  return { ok: true, data: { terminalId: t.id, code } };
}

async function ownTerminal(terminalId: string, orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("terminals").select("id").eq("id", terminalId).eq("org_id", orgId).maybeSingle();
  return !!data;
}

export async function newPairingCode(terminalId: string): Promise<Result<{ code: string }>> {
  try {
    const viewer = await requireOrgAdmin();
    if (!(await ownTerminal(terminalId, viewer.active.orgId))) return fail("Terminal nicht gefunden.");
    return { ok: true, data: { code: await issuePairingCode(terminalId) } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function revokeTerminal(terminalId: string): Promise<Result> {
  try {
    const viewer = await requireOrgAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("terminals")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", terminalId)
      .eq("org_id", viewer.active.orgId);
    if (error) return fail("Entkoppeln fehlgeschlagen.");
    await createAdminClient().from("terminal_secrets").update({ device_token_hash: null, pairing_code_hash: null }).eq("terminal_id", terminalId);
    revalidatePath("/admin/standorte");
    return { ok: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// RFID-Chip (Admin) und Terminal-PIN (Mitarbeiter)
// ---------------------------------------------------------------------------
export async function assignRfid(membershipId: string, uid: string | null): Promise<Result> {
  try {
    const viewer = await requireOrgAdmin();
    const supabase = await createClient();
    const { data: m } = await supabase.from("memberships").select("id").eq("id", membershipId).eq("org_id", viewer.active.orgId).maybeSingle();
    if (!m) return fail("Person nicht gefunden.");
    const clean = uid?.trim().toUpperCase().replace(/[^0-9A-F]/g, "") ?? "";
    if (uid && clean.length < 6) return fail("Die Chip-Nummer ist zu kurz.");
    const hash = uid ? await credentialHash(pepper(), viewer.active.orgId, "rfid", clean) : null;
    const { error } = await createAdminClient().from("member_credentials").update({ rfid_uid_hash: hash, updated_at: new Date().toISOString() }).eq("membership_id", membershipId);
    if (error) return fail(error.code === "23505" ? "Dieser Chip ist schon einer anderen Person zugeordnet." : "Speichern fehlgeschlagen.");
    revalidatePath(`/admin/mitarbeiter/${membershipId}`);
    return { ok: true };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Neue Terminal-PIN für mich. Bewusst vom System erzeugt und eindeutig:
 * Bei selbst gewählten PINs würde „schon vergeben" verraten, welche PIN ein Kollege hat.
 */
export async function generateMyPin(): Promise<Result<{ pin: string }>> {
  const viewer = await requireMember();
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 8; attempt++) {
    const pin = randomDigits(6);
    if (/^(\d)\1+$/.test(pin)) continue;
    const hash = await credentialHash(pepper(), viewer.active.orgId, "pin", pin);
    const { error } = await admin.from("member_credentials").update({ pin_hash: hash, updated_at: new Date().toISOString() }).eq("membership_id", viewer.active.id);
    if (!error) return { ok: true, data: { pin } };
    if (error.code !== "23505") return fail("PIN konnte nicht erzeugt werden.");
  }
  return fail("PIN konnte nicht erzeugt werden. Bitte erneut versuchen.");
}

export async function hasPin(): Promise<boolean> {
  const viewer = await requireMember();
  const { data } = await createAdminClient().from("member_credentials").select("pin_hash").eq("membership_id", viewer.active.id).single();
  return !!data?.pin_hash;
}

// ---------------------------------------------------------------------------
// Standort-Einwilligung (DSGVO)
// ---------------------------------------------------------------------------
const GEO_CONSENT_VERSION = "2026-11";

export async function setGeoConsent(granted: boolean): Promise<Result> {
  const viewer = await requireMember();
  const supabase = await createClient();
  if (granted) {
    const { error } = await supabase
      .from("geo_consents")
      .insert({ org_id: viewer.active.orgId, membership_id: viewer.active.id, text_version: GEO_CONSENT_VERSION });
    if (error) return fail("Speichern fehlgeschlagen.");
  } else {
    const { error } = await supabase
      .from("geo_consents")
      .update({ revoked_at: new Date().toISOString() })
      .eq("membership_id", viewer.active.id)
      .is("revoked_at", null);
    if (error) return fail("Speichern fehlgeschlagen.");
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}
