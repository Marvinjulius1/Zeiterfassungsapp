import "server-only";
import { addDaysKey, dateKeyOf, localTime } from "@/compliance";
import { createClient } from "@/lib/supabase/server";
import { berlinDateKey } from "@/lib/time/berlin";

export interface MyShift {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  location: string | null;
  position: string | null;
  swap: { status: string; targetName: string; accepted: boolean } | null;
}

export interface MyPlan {
  orgId: string;
  shifts: MyShift[];
  open: (MyShift & { claimed: string | null })[];
  incoming: { id: string; fromName: string; date: string; startsAt: string; endsAt: string; location: string | null }[];
  colleagues: { id: string; name: string; locationId: string | null }[];
  myLocationId: string | null;
}

export async function getMyPlan(membershipId: string, orgId: string): Promise<MyPlan> {
  const supabase = await createClient();
  const today = berlinDateKey();
  const until = localTime(addDaysKey(today, 28), 0).toISOString();
  const now = new Date().toISOString();

  const [{ data: me }, { data: mine }, { data: open }, { data: claims }, { data: swaps }, { data: colleagues }] = await Promise.all([
    supabase.from("memberships").select("location_id").eq("id", membershipId).single(),
    supabase
      .from("shifts")
      .select("id, starts_at, ends_at, break_minutes, position, locations(name)")
      .eq("membership_id", membershipId)
      .eq("status", "published")
      .gte("ends_at", now)
      .lt("starts_at", until)
      .order("starts_at"),
    supabase
      .from("shifts")
      .select("id, starts_at, ends_at, break_minutes, position, location_id, locations(name)")
      .eq("org_id", orgId)
      .is("membership_id", null)
      .eq("status", "published")
      .gte("starts_at", now)
      .order("starts_at")
      .limit(30),
    supabase.from("shift_claims").select("shift_id, status").eq("membership_id", membershipId),
    supabase
      .from("shift_swap_requests")
      .select("id, shift_id, status, requester_id, target_membership_id, target_accepted_at, created_at")
      .eq("org_id", orgId)
      .in("status", ["pending"])
      .or(`requester_id.eq.${membershipId},target_membership_id.eq.${membershipId}`),
    supabase.rpc("list_colleagues", { p_org: orgId }),
  ]);

  const names = new Map((colleagues ?? []).map((c) => [c.id, c.display_name]));
  const incomingIds = (swaps ?? []).filter((s) => s.target_membership_id === membershipId && !s.target_accepted_at);
  const { data: incomingShifts } = incomingIds.length
    ? await supabase.from("shifts").select("id, starts_at, ends_at, locations(name)").in("id", incomingIds.map((s) => s.shift_id))
    : { data: [] };

  const toShift = (s: { id: string; starts_at: string; ends_at: string; break_minutes: number; position: string | null; locations: { name: string } | null }): MyShift => ({
    id: s.id,
    date: dateKeyOf(new Date(s.starts_at)),
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    breakMinutes: s.break_minutes,
    location: s.locations?.name ?? null,
    position: s.position,
    swap: null,
  });

  return {
    orgId,
    myLocationId: me?.location_id ?? null,
    shifts: (mine ?? []).map((s) => {
      const swap = (swaps ?? []).find((w) => w.shift_id === s.id && w.requester_id === membershipId);
      return {
        ...toShift(s),
        swap: swap ? { status: swap.status, targetName: names.get(swap.target_membership_id ?? "") ?? "", accepted: !!swap.target_accepted_at } : null,
      };
    }),
    open: (open ?? [])
      .sort((a, b) => Number(b.location_id === me?.location_id) - Number(a.location_id === me?.location_id) || a.starts_at.localeCompare(b.starts_at))
      .map((s) => ({ ...toShift(s), claimed: claims?.find((c) => c.shift_id === s.id)?.status ?? null })),
    incoming: incomingIds.map((w) => {
      const s = incomingShifts?.find((x) => x.id === w.shift_id);
      return {
        id: w.id,
        fromName: names.get(w.requester_id) ?? "",
        date: s ? dateKeyOf(new Date(s.starts_at)) : "",
        startsAt: s?.starts_at ?? "",
        endsAt: s?.ends_at ?? "",
        location: s?.locations?.name ?? null,
      };
    }),
    colleagues: (colleagues ?? []).filter((c) => c.id !== membershipId).map((c) => ({ id: c.id, name: c.display_name, locationId: c.location_id })),
  };
}
