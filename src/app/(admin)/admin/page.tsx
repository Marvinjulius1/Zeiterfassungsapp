import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/skeleton";
import { PageHeader } from "@/components/page-header";
import { BigNumber } from "@/design-system/components/big-number";
import { Card, CardHeader } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { requireAdminArea } from "@/lib/auth/session";
import { greeting, firstName } from "@/lib/greeting";
import { ViolationList } from "@/features/compliance/components/violation-list";
import { berlinDateKey, formatDayShort, shiftDays } from "@/lib/time/berlin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Live" };

async function Dashboard() {
  const viewer = await requireAdminArea();
  const supabase = await createClient();
  const orgId = viewer.active.orgId;

  // RLS sorgt dafür, dass Teamleiter hier nur ihr Team sehen.
  const since = shiftDays(berlinDateKey(), -30);
  const [members, corrections, absences, violations] = await Promise.all([
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
  ]);
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
          <BigNumber size="md" label="Offene Anträge" value={String(openRequests)} />
        </Card>
        <Card>
          <BigNumber size="md" label="Arbeitsschutz · 30 Tage" value={String(violations.count ?? 0)} caption="offene Verstöße & Warnungen" />
        </Card>
      </div>
      {(violations.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader title="Arbeitsschutz" subtitle="Die neuesten offenen Hinweise – Freigabe & Quittieren folgen in Phase 5" />
          <ViolationList
            items={(violations.data ?? []).map((v) => ({
              id: v.id,
              severity: v.severity,
              message: v.message,
              law: v.law,
              title: v.memberships?.display_name ?? "",
              subtitle: formatDayShort(v.work_date),
            }))}
          />
        </Card>
      )}
      <Card className="p-0">
        <CardHeader className="px-6 pt-6" title="Wer ist gerade da?" subtitle="Live-Übersicht (Realtime)" />
        <EmptyState title="Live-Board folgt in Phase 5." description="Hier siehst du dann in Echtzeit, wer eingecheckt, in Pause oder abwesend ist." />
      </Card>
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
