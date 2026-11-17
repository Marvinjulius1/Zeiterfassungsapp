import "server-only";
import { addDaysKey, dateKeyOf, holidayMap, localTime, netShiftMinutes, shiftConflicts, type State, type Violation } from "@/compliance";
import { isMinorOn } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

export interface PlanShift {
  id: string;
  membershipId: string | null;
  locationId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  position: string | null;
  status: "draft" | "published" | "cancelled";
  conflicts: Pick<Violation, "message" | "severity" | "law">[];
}

export interface PlanPerson {
  id: string;
  name: string;
  locationId: string | null;
  weeklyTargetMinutes: number;
  plannedMinutes: number;
  isMinor: boolean;
}

export interface WeekPlan {
  monday: string;
  days: { date: string; holiday: string | null }[];
  locations: { id: string; name: string }[];
  locationId: string | null;
  people: PlanPerson[];
  shifts: PlanShift[];
  absences: { membershipId: string; start: string; end: string; label: string; status: "approved" | "pending" }[];
  templates: { id: string; name: string; start: string; end: string; breakMinutes: number }[];
  drafts: number;
}

export async function getWeekPlan(orgId: string, monday: string, locationParam: string | null): Promise<WeekPlan> {
  const supabase = await createClient();
  const sunday = addDaysKey(monday, 6);
  const [{ data: locations }, { data: org }] = await Promise.all([
    supabase.from("locations").select("id, name, state").eq("org_id", orgId).is("archived_at", null).order("name"),
    supabase.from("organizations").select("default_state").eq("id", orgId).single(),
  ]);
  const location = locations?.find((l) => l.id === locationParam) ?? null;
  const state = (location?.state ?? org?.default_state ?? "NW") as State;
  const holidays = holidayMap(state, Number(monday.slice(0, 4)), Number(sunday.slice(0, 4)));

  let membersQ = supabase
    .from("memberships")
    .select("id, display_name, location_id, birth_date, maternity_protection, employment_contracts(type, weekly_minutes, school_days, valid_from, valid_to)")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("display_name");
  if (location) membersQ = membersQ.eq("location_id", location.id);

  // ±1 Tag laden, damit Ruhezeiten an den Wochenrändern geprüft werden
  let shiftsQ = supabase
    .from("shifts")
    .select("id, membership_id, location_id, starts_at, ends_at, break_minutes, position, status")
    .eq("org_id", orgId)
    .neq("status", "cancelled")
    .gte("starts_at", localTime(addDaysKey(monday, -1), 0).toISOString())
    .lt("starts_at", localTime(addDaysKey(sunday, 2), 0).toISOString())
    .order("starts_at");
  if (location) shiftsQ = shiftsQ.eq("location_id", location.id);

  const [{ data: members }, { data: shifts }, { data: absences }, { data: templates }] = await Promise.all([
    membersQ,
    shiftsQ,
    supabase
      .from("absences")
      .select("membership_id, start_date, end_date, status, absence_types(label)")
      .eq("org_id", orgId)
      .in("status", ["approved", "pending"])
      .lte("start_date", sunday)
      .gte("end_date", monday),
    supabase.from("shift_templates").select("id, name, start_time, end_time, break_minutes").eq("org_id", orgId).order("start_time"),
  ]);

  const absList = (absences ?? []).map((a) => ({
    membershipId: a.membership_id,
    start: a.start_date,
    end: a.end_date,
    label: a.absence_types?.label ?? "Abwesend",
    status: a.status as "approved" | "pending",
  }));

  // Konflikte je Person
  const conflicts = new Map<string, Violation[]>();
  const people: PlanPerson[] = (members ?? []).map((m) => {
    const c = m.employment_contracts?.find((x) => x.valid_from <= sunday && (!x.valid_to || x.valid_to >= monday));
    const mine = (shifts ?? []).filter((s) => s.membership_id === m.id);
    const planned = mine.map((s) => ({ id: s.id, start: new Date(s.starts_at), end: new Date(s.ends_at), breakMinutes: s.break_minutes }));
    const profile = {
      isMinor: isMinorOn(m.birth_date, monday),
      maternityProtection: m.maternity_protection,
      contractType: (c?.type ?? "full_time") as "full_time",
      schoolDays: c?.school_days ?? [],
      trustBasedHours: false,
    };
    shiftConflicts(planned, profile, absList.filter((a) => a.membershipId === m.id), holidays).forEach((v, id) => conflicts.set(id, v));
    const inWeek = planned.filter((p) => {
      const d = dateKeyOf(p.start);
      return d >= monday && d <= sunday;
    });
    return {
      id: m.id,
      name: m.display_name,
      locationId: m.location_id,
      weeklyTargetMinutes: c?.weekly_minutes ?? 0,
      plannedMinutes: inWeek.reduce((s, p) => s + netShiftMinutes(p), 0),
      isMinor: profile.isMinor,
    };
  });

  const planShifts: PlanShift[] = (shifts ?? [])
    .map((s) => ({
      id: s.id,
      membershipId: s.membership_id,
      locationId: s.location_id,
      date: dateKeyOf(new Date(s.starts_at)),
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      breakMinutes: s.break_minutes,
      position: s.position,
      status: s.status as PlanShift["status"],
      conflicts: (conflicts.get(s.id) ?? []).map(({ message, severity, law }) => ({ message, severity, law })),
    }))
    .filter((s) => s.date >= monday && s.date <= sunday);

  return {
    monday,
    days: Array.from({ length: 7 }, (_, i) => {
      const d = addDaysKey(monday, i);
      return { date: d, holiday: holidays.get(d) ?? null };
    }),
    locations: (locations ?? []).map((l) => ({ id: l.id, name: l.name })),
    locationId: location?.id ?? null,
    people,
    shifts: planShifts,
    absences: absList,
    templates: (templates ?? []).map((t) => ({ id: t.id, name: t.name, start: t.start_time.slice(0, 5), end: t.end_time.slice(0, 5), breakMinutes: t.break_minutes })),
    drafts: planShifts.filter((s) => s.status === "draft").length,
  };
}

/**
 * Was passiert, wenn diese Schicht Person X bekommt? (Vorschau für Freigaben)
 * Prüft Überschneidung, Ruhezeit, Höchstarbeitszeit, Abwesenheit, Jugendschutz.
 */
export async function conflictsIfAssigned(
  orgId: string,
  membershipId: string,
  shift: { id: string; startsAt: string; endsAt: string; breakMinutes: number },
): Promise<string[]> {
  const supabase = await createClient();
  const day = dateKeyOf(new Date(shift.startsAt));
  const [{ data: m }, { data: others }, { data: absences }, { data: org }] = await Promise.all([
    supabase
      .from("memberships")
      .select("birth_date, maternity_protection, locations(state), employment_contracts(type, school_days, valid_from, valid_to)")
      .eq("id", membershipId)
      .single(),
    supabase
      .from("shifts")
      .select("id, starts_at, ends_at, break_minutes")
      .eq("membership_id", membershipId)
      .neq("status", "cancelled")
      .neq("id", shift.id)
      .gte("starts_at", localTime(addDaysKey(day, -6), 0).toISOString())
      .lt("starts_at", localTime(addDaysKey(day, 7), 0).toISOString()),
    supabase
      .from("absences")
      .select("start_date, end_date, status, absence_types(label)")
      .eq("membership_id", membershipId)
      .in("status", ["approved", "pending"])
      .lte("start_date", day)
      .gte("end_date", day),
    supabase.from("organizations").select("default_state").eq("id", orgId).single(),
  ]);
  if (!m) return [];
  const c = m.employment_contracts?.find((x) => x.valid_from <= day && (!x.valid_to || x.valid_to >= day));
  const planned = [
    ...(others ?? []).map((s) => ({ id: s.id, start: new Date(s.starts_at), end: new Date(s.ends_at), breakMinutes: s.break_minutes })),
    { id: shift.id, start: new Date(shift.startsAt), end: new Date(shift.endsAt), breakMinutes: shift.breakMinutes },
  ];
  const holidays = holidayMap((m.locations?.state ?? org?.default_state ?? "NW") as State, Number(day.slice(0, 4)));
  const res = shiftConflicts(
    planned,
    { isMinor: isMinorOn(m.birth_date, day), maternityProtection: m.maternity_protection, contractType: (c?.type ?? "full_time") as "full_time", schoolDays: c?.school_days ?? [], trustBasedHours: false },
    (absences ?? []).map((a) => ({ start: a.start_date, end: a.end_date, label: a.absence_types?.label ?? "Abwesend", status: a.status as "approved" | "pending" })),
    holidays,
  );
  // Konflikte der neuen Schicht selbst – und ob sie an einer anderen Schicht einen auslöst (z. B. Ruhezeit danach)
  const all = [...res.entries()].flatMap(([id, list]) => (id === shift.id ? list : list.filter((v) => v.severity === "violation")));
  return [...new Set(all.filter((v) => v.severity !== "info").map((v) => v.message))];
}
