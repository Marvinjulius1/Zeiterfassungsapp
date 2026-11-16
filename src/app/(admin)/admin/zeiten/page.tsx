import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { TimesTable, type TimeRow } from "@/features/admin/components/times-table";
import { requireAdminArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { berlinDateKey, isoWeekday, shiftDays } from "@/lib/time/berlin";

export const metadata: Metadata = { title: "Zeiten" };

async function Content({ searchParams }: { searchParams: PageProps<"/admin/zeiten">["searchParams"] }) {
  const viewer = await requireAdminArea();
  const sp = await searchParams;
  const today = berlinDateKey();
  const date = typeof sp.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) ? sp.datum : today;
  const personId = typeof sp.person === "string" ? sp.person : null;
  const supabase = await createClient();
  const orgId = viewer.active.orgId;
  const from = personId ? shiftDays(today, -13) : date;
  const to = personId ? today : date;

  let membersQuery = supabase
    .from("memberships")
    .select("id, display_name, employment_contracts(daily_targets, school_days, valid_from, valid_to)")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("display_name");
  if (personId) membersQuery = membersQuery.eq("id", personId);

  const [members, days, violations, edits] = await Promise.all([
    membersQuery,
    supabase.from("work_days").select("membership_id, work_date, first_in, last_out, net_minutes, break_minutes, target_minutes, status").eq("org_id", orgId).gte("work_date", from).lte("work_date", to),
    supabase.from("compliance_violations").select("membership_id, work_date").eq("org_id", orgId).in("severity", ["violation", "warning"]).is("acknowledged_at", null).gte("work_date", from).lte("work_date", to),
    supabase.from("time_events").select("membership_id, work_date").eq("org_id", orgId).eq("source", "admin").gte("work_date", from).lte("work_date", to),
  ]);

  const dates: string[] = [];
  for (let d = to; d >= from; d = shiftDays(d, -1)) dates.push(d);

  const rows: TimeRow[] = [];
  for (const m of members.data ?? []) {
    for (const d of dates) {
      const w = days.data?.find((x) => x.membership_id === m.id && x.work_date === d);
      const c = m.employment_contracts?.find((x) => x.valid_from <= d && (!x.valid_to || x.valid_to >= d));
      const wd = isoWeekday(d);
      const target = w?.target_minutes ?? (c && !c.school_days.includes(wd) ? Number((c.daily_targets as Record<string, number>)[String(wd)] ?? 0) : 0);
      if (!w && target === 0) continue;
      rows.push({
        key: `${m.id}-${d}`,
        membershipId: m.id,
        name: m.display_name,
        date: d,
        firstIn: w?.first_in ?? null,
        lastOut: w?.last_out ?? null,
        netMinutes: w?.net_minutes ?? 0,
        breakMinutes: w?.break_minutes ?? 0,
        targetMinutes: target,
        status: (w?.status as TimeRow["status"]) ?? "none",
        violations: (violations.data ?? []).filter((v) => v.membership_id === m.id && v.work_date === d).length,
        edited: (edits.data ?? []).some((e) => e.membership_id === m.id && e.work_date === d),
      });
    }
  }

  const person = personId ? { id: personId, name: members.data?.[0]?.display_name ?? "" } : null;
  return <TimesTable rows={rows} date={date} person={person} today={today} />;
}

export default function TimesAdminPage(props: PageProps<"/admin/zeiten">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Zeiten" description="Alle Buchungen – Korrekturen nur mit Begründung, lückenlos protokolliert." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[24px]" />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
