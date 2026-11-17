import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time/berlin";
import { holidayMap, type State, addDaysKey, weekdayOf, dateKeyOf } from "@/compliance";
import { relativeDayLabel } from "@/lib/time/berlin";
import { conflictsIfAssigned } from "@/features/shifts/queries";

export interface InboxItem {
  type: "correction" | "absence" | "claim" | "swap";
  id: string;
  membershipId: string;
  name: string;
  title: string;
  subtitle: string;
  details: { label: string; value: string }[];
  reason: string | null;
  createdAt: string;
}

const KIND: Record<string, string> = {
  missing_check_in: "Einstempeln vergessen",
  missing_check_out: "Ausstempeln vergessen",
  wrong_time: "Falsche Zeit",
  missing_break: "Pause nachtragen",
  other: "Sonstiges",
};
const EVENT: Record<string, string> = { check_in: "Ein", check_out: "Aus", break_start: "Pause ab", break_end: "Pause bis" };

const fmtDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/** Arbeitstage (Mo–Fr ohne Feiertage) zwischen zwei Daten */
export function workdaysBetween(from: string, to: string, state: State): number {
  const hol = holidayMap(state, Number(from.slice(0, 4)), Number(to.slice(0, 4)));
  let n = 0;
  for (let k = from; k <= to; k = addDaysKey(k, 1)) if (weekdayOf(k) <= 5 && !hol.has(k)) n++;
  return n;
}

export async function getInbox(orgId: string): Promise<InboxItem[]> {
  const supabase = await createClient();
  const [corrections, absences, org, claims, swaps] = await Promise.all([
    supabase
      .from("correction_requests")
      .select("id, membership_id, work_date, kind, proposed, reason, created_at, memberships(display_name)")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("absences")
      .select("id, membership_id, start_date, end_date, note, created_at, memberships!absences_membership_id_fkey(display_name, locations(state)), absence_types(label)")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("organizations").select("default_state").eq("id", orgId).single(),
    supabase
      .from("shift_claims")
      .select("id, membership_id, created_at, memberships(display_name), shifts(id, starts_at, ends_at, break_minutes, membership_id, locations(name))")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("shift_swap_requests")
      .select("id, requester_id, target_membership_id, created_at, target_accepted_at, shifts!shift_swap_requests_shift_id_fkey(id, starts_at, ends_at, break_minutes, locations(name))")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .not("target_accepted_at", "is", null)
      .order("created_at"),
  ]);
  const swapNames = new Map<string, string>();
  const swapIds = [...new Set((swaps.data ?? []).flatMap((w) => [w.requester_id, w.target_membership_id ?? ""]))].filter(Boolean);
  if (swapIds.length) {
    const { data: names } = await supabase.from("memberships").select("id, display_name").in("id", swapIds);
    for (const n of names ?? []) swapNames.set(n.id, n.display_name);
  }

  // aktuelle Buchungen der betroffenen Tage, damit man Vorher/Nachher sieht
  const days = corrections.data ?? [];
  const { data: events } = days.length
    ? await supabase
        .from("time_events")
        .select("membership_id, work_date, kind, occurred_at")
        .in("membership_id", [...new Set(days.map((d) => d.membership_id))])
        .in("work_date", [...new Set(days.map((d) => d.work_date))])
        .is("voided_at", null)
        .order("occurred_at")
    : { data: [] };

  const items: InboxItem[] = [];
  for (const c of days) {
    const current = (events ?? []).filter((e) => e.membership_id === c.membership_id && e.work_date === c.work_date);
    const proposed = (c.proposed as { kind: string; occurred_at: string }[]) ?? [];
    items.push({
      type: "correction",
      id: c.id,
      membershipId: c.membership_id,
      name: c.memberships?.display_name ?? "",
      title: KIND[c.kind] ?? c.kind,
      subtitle: fmtDate(c.work_date),
      details: [
        { label: "Bisher", value: current.length ? current.map((e) => `${EVENT[e.kind]} ${formatTime(e.occurred_at)}`).join(" · ") : "keine Buchungen" },
        { label: "Neu", value: proposed.map((p) => `${EVENT[p.kind]} ${formatTime(p.occurred_at)}`).join(" · ") },
      ],
      reason: c.reason,
      createdAt: c.created_at,
    });
  }
  for (const a of absences.data ?? []) {
    const state = (a.memberships?.locations?.state ?? org.data?.default_state ?? "NW") as State;
    const n = workdaysBetween(a.start_date, a.end_date, state);
    items.push({
      type: "absence",
      id: a.id,
      membershipId: a.membership_id,
      name: a.memberships?.display_name ?? "",
      title: a.absence_types?.label ?? "Abwesenheit",
      subtitle: `${fmtDate(a.start_date)} – ${fmtDate(a.end_date)}`,
      details: [{ label: "Dauer", value: `${n} Arbeitstag${n === 1 ? "" : "e"}` }],
      reason: a.note,
      createdAt: a.created_at,
    });
  }
  const shiftLabel = (sh: { starts_at: string; ends_at: string; locations: { name: string } | null } | null) =>
    sh ? `${relativeDayLabel(dateKeyOf(new Date(sh.starts_at)))}, ${formatTime(sh.starts_at)}–${formatTime(sh.ends_at)}${sh.locations?.name ? ` · ${sh.locations.name}` : ""}` : "";
  for (const c of claims.data ?? []) {
    if (c.shifts?.membership_id) continue; // inzwischen vergeben
    const warn = c.shifts
      ? await conflictsIfAssigned(orgId, c.membership_id, { id: c.shifts.id, startsAt: c.shifts.starts_at, endsAt: c.shifts.ends_at, breakMinutes: c.shifts.break_minutes })
      : [];
    items.push({
      type: "claim",
      id: c.id,
      membershipId: c.membership_id,
      name: c.memberships?.display_name ?? "",
      title: "Offene Schicht übernehmen",
      subtitle: shiftLabel(c.shifts),
      details: warn.map((w) => ({ label: "⚠︎", value: w })),
      reason: null,
      createdAt: c.created_at,
    });
  }
  for (const w of swaps.data ?? []) {
    items.push({
      type: "swap",
      id: w.id,
      membershipId: w.requester_id,
      name: swapNames.get(w.requester_id) ?? "",
      title: "Schichttausch",
      subtitle: shiftLabel(w.shifts),
      details: [
        { label: "An", value: `${swapNames.get(w.target_membership_id ?? "") ?? ""} (hat zugestimmt)` },
        ...(w.shifts && w.target_membership_id
          ? await conflictsIfAssigned(orgId, w.target_membership_id, { id: w.shifts.id, startsAt: w.shifts.starts_at, endsAt: w.shifts.ends_at, breakMinutes: w.shifts.break_minutes })
          : []
        ).map((v) => ({ label: "⚠︎", value: v })),
      ],
      reason: null,
      createdAt: w.created_at,
    });
  }
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
