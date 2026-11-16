import "server-only";
import { createClient } from "@/lib/supabase/server";
import { berlinDateKey, daysInRange, isoWeekday } from "@/lib/time/berlin";
import type { DayEvent } from "@/features/stamping/day-state";
import { rangeFor, type View } from "./periods";

export interface DayRow {
  date: string;
  netMinutes: number;
  breakMinutes: number;
  targetMinutes: number;
  firstIn: string | null;
  lastOut: string | null;
  status: "open" | "complete" | "incomplete" | "none";
}

export interface CorrectionRow {
  id: string;
  workDate: string;
  kind: string;
  status: string;
  reason: string;
  createdAt: string;
}

export interface Timesheet {
  view: View;
  date: string;
  days: DayRow[];
  totals: { net: number; target: number; breaks: number };
  /** Stundenkonto in Minuten (abgeschlossene Tage bis gestern + manuelle Buchungen) */
  balanceMinutes: number;
  events: DayEvent[];
  corrections: CorrectionRow[];
}

export async function getTimesheet(membershipId: string, view: View, date: string): Promise<Timesheet> {
  const supabase = await createClient();
  const range = rangeFor(view, date);
  const today = berlinDateKey();

  const [workDays, contract, history, adjustments, events, corrections] = await Promise.all([
    supabase
      .from("work_days")
      .select("work_date, net_minutes, break_minutes, valued_minutes, target_minutes, first_in, last_out, status")
      .eq("membership_id", membershipId)
      .gte("work_date", range.from)
      .lte("work_date", range.to)
      .order("work_date"),
    supabase
      .from("employment_contracts")
      .select("daily_targets, school_days, valid_from, valid_to")
      .eq("membership_id", membershipId)
      .order("valid_from", { ascending: false }),
    supabase
      .from("work_days")
      .select("valued_minutes, target_minutes")
      .eq("membership_id", membershipId)
      .lt("work_date", today)
      .neq("status", "open"),
    supabase.from("time_account_adjustments").select("minutes").eq("membership_id", membershipId),
    view === "day"
      ? supabase
          .from("time_events")
          .select("id, kind, occurred_at")
          .eq("membership_id", membershipId)
          .eq("work_date", date)
          .is("voided_at", null)
          .order("occurred_at")
      : Promise.resolve({ data: [] as { id: string; kind: DayEvent["kind"]; occurred_at: string }[] }),
    view === "day"
      ? supabase
          .from("correction_requests")
          .select("id, work_date, kind, status, reason, created_at")
          .eq("membership_id", membershipId)
          .eq("work_date", date)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; work_date: string; kind: string; status: string; reason: string; created_at: string }[] }),
  ]);

  const byDate = new Map((workDays.data ?? []).map((w) => [w.work_date, w]));
  const contracts = contract.data ?? [];
  const targetFor = (d: string): number => {
    const c = contracts.find((x) => x.valid_from <= d && (!x.valid_to || x.valid_to >= d));
    if (!c) return 0;
    const wd = isoWeekday(d);
    if ((c.school_days ?? []).includes(wd)) return 0; // Berufsschule: Soll gilt als erfüllt
    return Number((c.daily_targets as Record<string, number>)[String(wd)] ?? 0);
  };

  const days: DayRow[] = daysInRange(range).map((d) => {
    const w = byDate.get(d);
    return w
      ? {
          date: d,
          netMinutes: w.net_minutes,
          breakMinutes: w.break_minutes,
          targetMinutes: w.target_minutes,
          firstIn: w.first_in,
          lastOut: w.last_out,
          status: w.status as DayRow["status"],
        }
      : { date: d, netMinutes: 0, breakMinutes: 0, targetMinutes: targetFor(d), firstIn: null, lastOut: null, status: "none" };
  });

  // Soll nur für vergangene/heutige Tage zählen, damit die Woche nicht „im Minus" startet
  const totals = days.reduce(
    (t, d) => ({
      net: t.net + d.netMinutes,
      target: t.target + (d.date <= today ? d.targetMinutes : 0),
      breaks: t.breaks + d.breakMinutes,
    }),
    { net: 0, target: 0, breaks: 0 },
  );

  const balanceMinutes =
    (history.data ?? []).reduce((s, w) => s + w.valued_minutes - w.target_minutes, 0) +
    (adjustments.data ?? []).reduce((s, a) => s + a.minutes, 0);

  return {
    view,
    date,
    days,
    totals,
    balanceMinutes,
    events: (events.data ?? []).map((e) => ({ id: e.id, kind: e.kind, occurredAt: e.occurred_at })),
    corrections: (corrections.data ?? []).map((c) => ({
      id: c.id,
      workDate: c.work_date,
      kind: c.kind,
      status: c.status,
      reason: c.reason,
      createdAt: c.created_at,
    })),
  };
}
