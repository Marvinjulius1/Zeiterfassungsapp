import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/skeleton";
import { PageHeader } from "@/components/page-header";
import { BigNumber } from "@/design-system/components/big-number";
import { Card, CardHeader } from "@/design-system/components/card";
import { requireAdminArea } from "@/lib/auth/session";
import { greeting, firstName } from "@/lib/greeting";
import { ViolationList } from "@/features/compliance/components/violation-list";
import { addDaysKey, localTime } from "@/compliance";
import { LiveBoard, type LivePerson } from "@/features/admin/components/live-board";
import { AcknowledgeButton } from "@/features/admin/components/member-forms";
import { berlinDateKey, formatDayShort, shiftDays } from "@/lib/time/berlin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Live" };

async function Dashboard() {
  const viewer = await requireAdminArea();
  const supabase = await createClient();
  const orgId = viewer.active.orgId;

  // RLS sorgt dafür, dass Teamleiter hier nur ihr Team sehen.
  const since = shiftDays(berlinDateKey(), -30);
  const today = berlinDateKey();
  const [members, corrections, absences, violations, people, todayEvents, todayAbsences, todayShifts] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    supabase.from("correction_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase.from("absences").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase
      .from("compliance_violations")
      .select("id, work_date, severity, message, law, memberships(display_name)", { count: "exact" })
      .eq("org_id", orgId)
      .in("severity", ["violation", "warning"])
      .is("acknowledged_at", null)
      .gte("work_date", since)
      .order("work_date", { ascending: false })
      .limit(5),
    supabase.from("memberships").select("id, display_name, locations(name)").eq("org_id", orgId).eq("status", "active").order("display_name"),
    supabase.from("time_events").select("id, membership_id, kind, occurred_at").eq("org_id", orgId).eq("work_date", today).is("voided_at", null).order("occurred_at"),
    supabase.from("absences").select("membership_id, absence_types(label)").eq("org_id", orgId).eq("status", "approved").lte("start_date", today).gte("end_date", today),
    supabase.from("shifts").select("membership_id, starts_at, ends_at").eq("org_id", orgId).eq("status", "published").gte("starts_at", localTime(today, 0).toISOString()).lt("starts_at", localTime(addDaysKey(today, 1), 0).toISOString()),
  ]);
  const livePeople: LivePerson[] = (people.data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    locationName: p.locations?.name ?? null,
    shiftStart: todayShifts.data?.find((s) => s.membership_id === p.id)?.starts_at ?? null,
    shiftEnd: todayShifts.data?.find((s) => s.membership_id === p.id)?.ends_at ?? null,
    absence: todayAbsences.data?.find((a) => a.membership_id === p.id)?.absence_types?.label ?? null,
  }));
  const liveEvents: Record<string, { id: string; kind: "check_in" | "break_start" | "break_end" | "check_out"; occurredAt: string }[]> = {};
  for (const e of todayEvents.data ?? []) (liveEvents[e.membership_id] ??= []).push({ id: e.id, kind: e.kind, occurredAt: e.occurred_at });
  const openRequests = (corrections.count ?? 0) + (absences.count ?? 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={viewer.active.orgName}
        title={`${greeting()}, ${firstName(viewer.active.displayName)}`}
        description={viewer.active.role === "team_lead" ? "Du siehst die Daten deines Teams." : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <BigNumber size="md" label="Mitarbeitende" value={String(members.count ?? 0)} />
        </Card>
        <Card>
          <Link href="/admin/freigaben" className="block">
            <BigNumber size="md" label="Offene Anträge →" value={String(openRequests)} />
          </Link>
        </Card>
        <Card>
          <BigNumber size="md" label="Arbeitsschutz · 30 Tage" value={String(violations.count ?? 0)} caption="offene Verstöße & Warnungen" />
        </Card>
      </div>
      {(violations.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader title="Arbeitsschutz" subtitle="Die neuesten offenen Hinweise" />
          <ViolationList
            items={(violations.data ?? []).map((v) => ({
              id: v.id,
              severity: v.severity,
              message: v.message,
              law: v.law,
              title: v.memberships?.display_name ?? "",
              subtitle: formatDayShort(v.work_date),
              action: <AcknowledgeButton id={v.id} />,
            }))}
          />
        </Card>
      )}
      <LiveBoard orgId={orgId} people={livePeople} initialEvents={liveEvents} />
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8" aria-busy aria-label="Wird geladen">
          <Skeleton className="h-16 w-80" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
