import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time/berlin";
import { holidayMap, type State, addDaysKey, weekdayOf } from "@/compliance";

export interface InboxItem {
  type: "correction" | "absence";
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
  const [corrections, absences, org] = await Promise.all([
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
  ]);

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
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
