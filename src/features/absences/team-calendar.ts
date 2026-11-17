import "server-only";
import { addDaysKey, holidayMap, type State } from "@/compliance";
import { createClient } from "@/lib/supabase/server";
import { monthRange } from "@/lib/time/berlin";

export interface TeamCalendar {
  month: string; // yyyy-MM-01
  days: { date: string; weekday: number; holiday: string | null }[];
  people: { id: string; name: string }[];
  absences: { id: string; membershipId: string; start: string; end: string; key: string; label: string; status: "approved" | "pending" }[];
  locations: { id: string; name: string }[];
  locationId: string | null;
}

export async function getTeamCalendar(orgId: string, month: string, locationParam: string | null): Promise<TeamCalendar> {
  const supabase = await createClient();
  const r = monthRange(month);
  const [{ data: locations }, { data: org }] = await Promise.all([
    supabase.from("locations").select("id, name, state").eq("org_id", orgId).is("archived_at", null).order("name"),
    supabase.from("organizations").select("default_state").eq("id", orgId).single(),
  ]);
  const location = locations?.find((l) => l.id === locationParam) ?? null;
  const hol = holidayMap((location?.state ?? org?.default_state ?? "NW") as State, Number(r.from.slice(0, 4)));

  let pq = supabase.from("memberships").select("id, display_name").eq("org_id", orgId).eq("status", "active").order("display_name");
  if (location) pq = pq.eq("location_id", location.id);
  const [{ data: people }, { data: absences }] = await Promise.all([
    pq,
    supabase
      .from("absences")
      .select("id, membership_id, start_date, end_date, status, absence_types(key, label)")
      .eq("org_id", orgId)
      .in("status", ["approved", "pending"])
      .lte("start_date", r.to)
      .gte("end_date", r.from),
  ]);
  const ids = new Set((people ?? []).map((p) => p.id));
  const days: TeamCalendar["days"] = [];
  for (let d = r.from; d <= r.to; d = addDaysKey(d, 1)) {
    const wd = ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    days.push({ date: d, weekday: wd, holiday: hol.get(d) ?? null });
  }
  return {
    month: r.from,
    days,
    people: (people ?? []).map((p) => ({ id: p.id, name: p.display_name })),
    absences: (absences ?? [])
      .filter((a) => ids.has(a.membership_id))
      .map((a) => ({
        id: a.id,
        membershipId: a.membership_id,
        start: a.start_date,
        end: a.end_date,
        key: a.absence_types?.key ?? "other",
        label: a.absence_types?.label ?? "Abwesend",
        status: a.status as "approved" | "pending",
      })),
    locations: (locations ?? []).map((l) => ({ id: l.id, name: l.name })),
    locationId: location?.id ?? null,
  };
}
