import {
  addDaysKey, averageViolations, dateKeyOf, evaluateDay, holidayMap, maternityDoubleWeekViolations, milogViolations,
  minorWeekViolations, replacementRestViolations, resolveRules, sundaysOffViolations, weekdayOf,
  type DayEvaluation, type DayRecord, type RuleSettings, type State, type TimeEvent, type Violation, type WorkerProfile,
} from "@/compliance";
import type { AdminClient } from "@/lib/supabase/admin";
import { isMinorOn } from "@/lib/people";

/** Wie weit zurück für den 6-Monats-Durchschnitt geladen wird */
const HISTORY_DAYS = 190;

interface Contract {
  valid_from: string;
  valid_to: string | null;
  type: WorkerProfile["contractType"];
  daily_targets: unknown;
  school_days: number[];
  trust_based_hours: boolean;
}

export interface MemberContext {
  membershipId: string;
  orgId: string;
  locationId: string | null;
  state: State;
  birthDate: string | null;
  maternity: boolean;
  contracts: Contract[];
  rules: RuleSettings;
}

/** Lädt alles, was die Regeln über eine Person wissen müssen. */
export async function loadMemberContext(admin: AdminClient, membershipId: string): Promise<MemberContext> {
  const { data: m, error } = await admin
    .from("memberships")
    .select("id, org_id, location_id, birth_date, maternity_protection, organizations(default_state), locations(state)")
    .eq("id", membershipId)
    .single();
  if (error || !m) throw new Error(`Mitgliedschaft ${membershipId} nicht gefunden`);

  const [contracts, rules] = await Promise.all([
    admin
      .from("employment_contracts")
      .select("valid_from, valid_to, type, daily_targets, school_days, trust_based_hours")
      .eq("membership_id", membershipId)
      .order("valid_from"),
    admin.from("rule_sets").select("scope, scope_id, settings").eq("org_id", m.org_id),
  ]);

  const layer = (scope: string, id: string | null) =>
    rules.data?.find((r) => r.scope === scope && r.scope_id === id)?.settings ?? {};

  return {
    membershipId,
    orgId: m.org_id,
    locationId: m.location_id,
    state: (m.locations?.state ?? m.organizations?.default_state ?? "NW") as State,
    birthDate: m.birth_date,
    maternity: m.maternity_protection,
    contracts: (contracts.data ?? []) as Contract[],
    rules: resolveRules(layer("org", m.org_id), layer("location", m.location_id), layer("membership", membershipId)),
  };
}

export function contractOn(ctx: MemberContext, date: string): Contract | null {
  return ctx.contracts.find((c) => c.valid_from <= date && (!c.valid_to || c.valid_to >= date)) ?? null;
}

export function profileOn(ctx: MemberContext, date: string): WorkerProfile {
  const c = contractOn(ctx, date);
  return {
    isMinor: isMinorOn(ctx.birthDate, date),
    maternityProtection: ctx.maternity,
    contractType: c?.type ?? "full_time",
    schoolDays: c?.school_days ?? [],
    trustBasedHours: (c?.trust_based_hours ?? false) || ctx.rules.trustBasedHours,
  };
}

export function targetOn(ctx: MemberContext, date: string, holidays: ReadonlyMap<string, string>): number {
  const c = contractOn(ctx, date);
  if (!c || holidays.has(date)) return 0;
  const wd = weekdayOf(date);
  if (c.school_days.includes(wd)) return 0;
  return Number((c.daily_targets as Record<string, number>)?.[String(wd)] ?? 0);
}

export interface EvaluationResult {
  days: Map<string, DayEvaluation>;
  violations: Map<string, Violation[]>;
}

/**
 * Bewertet alle Arbeitstage einer Person im Zeitraum [from, to] und speichert
 * Tageswerte und Verstöße. Idempotent – kann beliebig oft laufen.
 */
export async function evaluateMemberRange(
  admin: AdminClient,
  membershipId: string,
  from: string,
  to: string,
  now: Date = new Date(),
): Promise<EvaluationResult> {
  const ctx = await loadMemberContext(admin, membershipId);
  const today = dateKeyOf(now);
  const histFrom = addDaysKey(from, -HISTORY_DAYS);
  const holidays = holidayMap(ctx.state, Number(histFrom.slice(0, 4)), Number(to.slice(0, 4)) + 1);

  const [events, history, shifts, absences] = await Promise.all([
    admin
      .from("time_events")
      .select("kind, occurred_at, received_at, work_date, source")
      .eq("membership_id", membershipId)
      .is("voided_at", null)
      .gte("work_date", addDaysKey(from, -3))
      .lte("work_date", to)
      .order("occurred_at"),
    admin
      .from("work_days")
      .select("work_date, net_minutes, last_out")
      .eq("membership_id", membershipId)
      .gte("work_date", histFrom)
      .lte("work_date", to),
    admin
      .from("shifts")
      .select("starts_at, ends_at")
      .eq("membership_id", membershipId)
      .eq("status", "published")
      .gte("starts_at", new Date(new Date(`${from}T00:00:00Z`).getTime() - 86400000).toISOString())
      .lte("starts_at", new Date(new Date(`${to}T23:59:59Z`).getTime() + 86400000).toISOString()),
    admin
      .from("absences")
      .select("start_date, end_date")
      .eq("membership_id", membershipId)
      .eq("status", "approved")
      .lte("start_date", to)
      .gte("end_date", histFrom),
  ]);

  // Ereignisse je Arbeitstag
  const byDate = new Map<string, { events: TimeEvent[]; firstReceived: Date | null }>();
  for (const e of events.data ?? []) {
    const entry = byDate.get(e.work_date) ?? { events: [], firstReceived: null };
    entry.events.push({ kind: e.kind, at: new Date(e.occurred_at), source: e.source });
    const rec = new Date(e.received_at);
    if (!entry.firstReceived || rec < entry.firstReceived) entry.firstReceived = rec;
    byDate.set(e.work_date, entry);
  }

  const shiftOn = (date: string) => {
    const s = (shifts.data ?? []).find((x) => dateKeyOf(new Date(x.starts_at)) === date);
    return s ? { startsAt: new Date(s.starts_at), endsAt: new Date(s.ends_at) } : null;
  };
  const hasAbsence = (date: string) => (absences.data ?? []).some((a) => a.start_date <= date && a.end_date >= date);

  // --- 1) Tagesbewertung ---------------------------------------------------
  const days = new Map<string, DayEvaluation>();
  const violations = new Map<string, Violation[]>();
  const lastOutByDate = new Map((history.data ?? []).map((w) => [w.work_date, w.last_out ? new Date(w.last_out) : null]));

  let previousEnd: Date | null = null;
  // Ende des letzten Arbeitstags vor `from`
  for (const [d, lo] of [...lastOutByDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (d < from && lo) previousEnd = lo;
  }
  for (const [d, entry] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (d < from) {
      const lastOut = [...entry.events].reverse().find((e) => e.kind === "check_out");
      if (lastOut) previousEnd = lastOut.at;
    }
  }

  for (let d = from; d <= to; d = addDaysKey(d, 1)) {
    const entry = byDate.get(d);
    if (!entry) {
      violations.set(d, []);
      continue;
    }
    const ev = evaluateDay({
      date: d,
      events: entry.events,
      now,
      profile: profileOn(ctx, d),
      rules: ctx.rules,
      holidays,
      targetMinutes: targetOn(ctx, d, holidays),
      shift: shiftOn(d),
      previousEnd,
    });
    days.set(d, ev);
    violations.set(d, [...ev.violations]);
    if (ev.lastOut) previousEnd = ev.lastOut;
  }

  // --- 2) Zeitraumprüfungen --------------------------------------------------
  const netByDate = new Map((history.data ?? []).map((w) => [w.work_date, w.net_minutes]));
  for (const [d, ev] of days) netByDate.set(d, ev.netMin);
  const records: DayRecord[] = [];
  for (let d = histFrom; d <= to; d = addDaysKey(d, 1)) {
    records.push({
      date: d,
      netMin: netByDate.get(d) ?? 0,
      targetMin: targetOn(ctx, d, holidays),
      hasEvents: netByDate.has(d) || byDate.has(d),
      hasAbsence: hasAbsence(d),
      firstReceivedAt: byDate.get(d)?.firstReceived ?? null,
    });
  }
  const p = profileOn(ctx, to);
  const period = new Map<string, Violation[]>();
  minorWeekViolations(records, p, period);
  maternityDoubleWeekViolations(records, p, period);
  averageViolations(records, [...days.keys()], holidays, p, period);
  replacementRestViolations(records, today, holidays, period);
  sundaysOffViolations(records, period);
  milogViolations(
    records.filter((r) => r.date >= from && r.date < today),
    today,
    p,
    ctx.rules.milogAllEmployees,
  ).forEach((v, d) => period.set(d, [...(period.get(d) ?? []), ...v]));

  for (const [d, list] of period) {
    if (d < from || d > to) continue;
    violations.set(d, [...(violations.get(d) ?? []), ...list]);
  }

  await persist(admin, ctx, days, violations, from, to, now, holidays);
  return { days, violations };
}

async function persist(
  admin: AdminClient,
  ctx: MemberContext,
  days: Map<string, DayEvaluation>,
  violations: Map<string, Violation[]>,
  from: string,
  to: string,
  now: Date,
  holidaysForPersist: ReadonlyMap<string, string>,
) {
  // Tageswerte (nur bewertete Felder – Rohwerte rechnet die Datenbank selbst)
  for (const [date, ev] of days) {
    await admin
      .from("work_days")
      .update({
        valued_minutes: ev.valuedMin,
        target_minutes: targetOn(ctx, date, holidaysForPersist),
        auto_break_minutes: ev.autoBreakMin,
        surcharges: { ...ev.surcharges },
        evaluated_at: now.toISOString(),
      })
      .eq("membership_id", ctx.membershipId)
      .eq("work_date", date);
  }

  // Verstöße: neue/aktuelle upserten, behobene entfernen
  const rows = [...violations.entries()].flatMap(([date, list]) =>
    dedupe(list).map((v) => ({
      org_id: ctx.orgId,
      membership_id: ctx.membershipId,
      work_date: date,
      code: v.code,
      severity: v.severity,
      message: v.message,
      law: v.law ?? null,
      details: (v.details ?? {}) as Record<string, never>,
    })),
  );
  if (rows.length > 0) {
    const { error } = await admin
      .from("compliance_violations")
      .upsert(rows, { onConflict: "membership_id,work_date,code", ignoreDuplicates: false });
    if (error) throw error;
  }

  const { data: existing } = await admin
    .from("compliance_violations")
    .select("id, work_date, code")
    .eq("membership_id", ctx.membershipId)
    .gte("work_date", from)
    .lte("work_date", to);
  const keep = new Set(rows.map((r) => `${r.work_date}|${r.code}`));
  const stale = (existing ?? []).filter((e) => !keep.has(`${e.work_date}|${e.code}`)).map((e) => e.id);
  if (stale.length > 0) await admin.from("compliance_violations").delete().in("id", stale);
}

function dedupe(list: Violation[]): Violation[] {
  const seen = new Set<string>();
  return list.filter((v) => (seen.has(v.code) ? false : (seen.add(v.code), true)));
}
