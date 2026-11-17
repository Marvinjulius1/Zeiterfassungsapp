import { canStamp, dateKeyOf, toIntervals, totalMinutes, type EventKind, type StampDecision, type StampMethod } from "@/compliance";
import type { AdminClient } from "@/lib/supabase/admin";
import { loadMemberContext, profileOn, type MemberContext } from "./evaluate-member";

/**
 * Regelprüfung vor einer Live-Buchung – gemeinsam für App, Scan-Seite und Terminal.
 */
export async function checkStamp(
  admin: AdminClient,
  membershipId: string,
  kind: EventKind,
  method: StampMethod,
  now: Date,
  insideGeofence: boolean | null = null,
  ctx?: MemberContext,
): Promise<StampDecision & { ctx: MemberContext }> {
  const c = ctx ?? (await loadMemberContext(admin, membershipId));
  const today = dateKeyOf(now);
  const [lastOut, todayEvents, shift] = await Promise.all([
    admin
      .from("time_events")
      .select("occurred_at")
      .eq("membership_id", membershipId)
      .eq("kind", "check_out")
      .lt("work_date", today) // Ruhezeit ab dem vorherigen Arbeitstag
      .is("voided_at", null)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("time_events").select("kind, occurred_at").eq("membership_id", membershipId).eq("work_date", today).is("voided_at", null),
    admin
      .from("shifts")
      .select("starts_at, ends_at")
      .eq("membership_id", membershipId)
      .eq("status", "published")
      .gte("ends_at", now.toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
  ]);
  const net = totalMinutes(toIntervals((todayEvents.data ?? []).map((e) => ({ kind: e.kind, at: new Date(e.occurred_at) })), now).net);
  const shiftToday =
    shift.data && dateKeyOf(new Date(shift.data.starts_at)) === today
      ? { startsAt: new Date(shift.data.starts_at), endsAt: new Date(shift.data.ends_at) }
      : null;
  const decision = canStamp({
    kind,
    method,
    now,
    profile: profileOn(c, today),
    rules: c.rules,
    lastEnd: lastOut.data ? new Date(lastOut.data.occurred_at) : null,
    netTodayMin: net,
    shift: shiftToday,
    insideGeofence,
  });
  return { ...decision, ctx: c };
}
