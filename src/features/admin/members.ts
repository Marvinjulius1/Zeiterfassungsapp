import "server-only";
import { createClient } from "@/lib/supabase/server";
import { berlinDateKey, isoWeekRange } from "@/lib/time/berlin";

export * from "./members-shared";
import type { ContractType, MemberRow, Option } from "./members-shared";

export async function getMemberOptions(orgId: string): Promise<{ locations: Option[]; teams: Option[] }> {
  const supabase = await createClient();
  const [l, t] = await Promise.all([
    supabase.from("locations").select("id, name").eq("org_id", orgId).is("archived_at", null).order("name"),
    supabase.from("teams").select("id, name").eq("org_id", orgId).order("name"),
  ]);
  return { locations: l.data ?? [], teams: t.data ?? [] };
}

export async function getMembers(orgId: string): Promise<MemberRow[]> {
  const supabase = await createClient();
  const today = berlinDateKey();
  const { data } = await supabase
    .from("memberships")
    .select(
      "id, display_name, email, role, status, location_id, team_id, employee_no, locations(name), teams!memberships_team_id_fkey(name), employment_contracts(type, weekly_minutes, valid_from, valid_to)",
    )
    .eq("org_id", orgId)
    .order("display_name");
  return (data ?? []).map((m) => {
    const c = (m.employment_contracts ?? []).find((x) => x.valid_from <= today && (!x.valid_to || x.valid_to >= today));
    return {
      id: m.id,
      name: m.display_name,
      email: m.email,
      role: m.role,
      status: m.status,
      locationId: m.location_id,
      locationName: m.locations?.name ?? null,
      teamId: m.team_id,
      teamName: m.teams?.name ?? null,
      contractType: (c?.type as ContractType) ?? null,
      weeklyMinutes: c?.weekly_minutes ?? null,
      employeeNo: m.employee_no,
    };
  });
}

export interface MemberDetail extends MemberRow {
  birthDate: string | null;
  maternity: boolean;
  userId: string | null;
  contract: {
    validFrom: string;
    type: ContractType;
    weeklyMinutes: number;
    dailyTargets: Record<string, number>;
    vacationDays: number;
    schoolDays: number[];
    trustBased: boolean;
  } | null;
  contractHistory: { validFrom: string; validTo: string | null; type: ContractType; weeklyMinutes: number }[];
  weekMinutes: number;
  balanceMinutes: number;
  violations: { id: string; workDate: string; severity: "info" | "warning" | "violation"; message: string; law: string | null }[];
  documents: { id: string; title: string; category: string; createdAt: string; sizeBytes: number | null }[];
  history: { id: number; createdAt: string; action: string; entity: string; reason: string | null; changes: string }[];
}

export async function getMemberDetail(orgId: string, id: string): Promise<MemberDetail | null> {
  const supabase = await createClient();
  const today = berlinDateKey();
  const week = isoWeekRange(today);
  const { data: m } = await supabase
    .from("memberships")
    .select("id, user_id, display_name, email, role, status, location_id, team_id, employee_no, birth_date, maternity_protection, locations(name), teams!memberships_team_id_fkey(name)")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!m) return null;

  const [contracts, weekDays, balance, adjustments, violations, documents, history] = await Promise.all([
    supabase.from("employment_contracts").select("valid_from, valid_to, type, weekly_minutes, daily_targets, vacation_days_per_year, school_days, trust_based_hours").eq("membership_id", id).order("valid_from", { ascending: false }),
    supabase.from("work_days").select("net_minutes").eq("membership_id", id).gte("work_date", week.from).lte("work_date", week.to),
    supabase.from("work_days").select("valued_minutes, target_minutes").eq("membership_id", id).lt("work_date", today).neq("status", "open"),
    supabase.from("time_account_adjustments").select("minutes").eq("membership_id", id),
    supabase.from("compliance_violations").select("id, work_date, severity, message, law").eq("membership_id", id).in("severity", ["violation", "warning"]).is("acknowledged_at", null).order("work_date", { ascending: false }).limit(8),
    supabase.from("documents").select("id, title, category, created_at, size_bytes").eq("membership_id", id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("audit_log").select("id, created_at, action, entity, reason, old_value, new_value").eq("org_id", orgId).eq("entity_id", id).order("id", { ascending: false }).limit(15),
  ]);

  const current = (contracts.data ?? []).find((c) => c.valid_from <= today && (!c.valid_to || c.valid_to >= today)) ?? contracts.data?.[0];
  return {
    id: m.id,
    userId: m.user_id,
    name: m.display_name,
    email: m.email,
    role: m.role,
    status: m.status,
    locationId: m.location_id,
    locationName: m.locations?.name ?? null,
    teamId: m.team_id,
    teamName: m.teams?.name ?? null,
    employeeNo: m.employee_no,
    birthDate: m.birth_date,
    maternity: m.maternity_protection,
    contractType: (current?.type as ContractType) ?? null,
    weeklyMinutes: current?.weekly_minutes ?? null,
    contract: current
      ? {
          validFrom: current.valid_from,
          type: current.type as ContractType,
          weeklyMinutes: current.weekly_minutes,
          dailyTargets: current.daily_targets as Record<string, number>,
          vacationDays: Number(current.vacation_days_per_year),
          schoolDays: current.school_days,
          trustBased: current.trust_based_hours,
        }
      : null,
    contractHistory: (contracts.data ?? []).map((c) => ({ validFrom: c.valid_from, validTo: c.valid_to, type: c.type as ContractType, weeklyMinutes: c.weekly_minutes })),
    weekMinutes: (weekDays.data ?? []).reduce((s, d) => s + d.net_minutes, 0),
    balanceMinutes:
      (balance.data ?? []).reduce((s, w) => s + w.valued_minutes - w.target_minutes, 0) + (adjustments.data ?? []).reduce((s, a) => s + a.minutes, 0),
    violations: (violations.data ?? []).map((v) => ({ id: v.id, workDate: v.work_date, severity: v.severity, message: v.message, law: v.law })),
    documents: (documents.data ?? []).map((d) => ({ id: d.id, title: d.title, category: d.category, createdAt: d.created_at, sizeBytes: d.size_bytes })),
    history: (history.data ?? []).map((h) => ({
      id: h.id,
      createdAt: h.created_at,
      action: h.action,
      entity: h.entity,
      reason: h.reason,
      changes: describeChange(h.old_value, h.new_value),
    })),
  };
}

const FIELD: Record<string, string> = {
  display_name: "Name", role: "Rolle", status: "Status", location_id: "Standort", team_id: "Team",
  employee_no: "Personalnummer", birth_date: "Geburtsdatum", maternity_protection: "Mutterschutz", user_id: "Konto",
};

/** Kompakte Beschreibung einer Änderung: „Rolle: employee → team_lead" */
export function describeChange(oldV: unknown, newV: unknown): string {
  const o = (oldV ?? {}) as Record<string, unknown>;
  const n = (newV ?? {}) as Record<string, unknown>;
  if (!oldV) return "angelegt";
  return Object.keys(n)
    .filter((k) => !["updated_at", "archived_at"].includes(k))
    .map((k) => `${FIELD[k] ?? k}: ${fmt(o[k])} → ${fmt(n[k])}`)
    .join(" · ");
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "boolean") return v ? "ja" : "nein";
  if (typeof v === "string" && /^[0-9a-f-]{36}$/.test(v)) return "…" + v.slice(-4);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
