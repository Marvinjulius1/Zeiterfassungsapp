import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { BigNumber } from "@/design-system/components/big-number";
import { Card, CardHeader } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { requireAdminArea } from "@/lib/auth/session";
import { greeting, firstName } from "@/lib/greeting";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Live" };

export default async function AdminDashboard() {
  const viewer = await requireAdminArea();
  const supabase = await createClient();
  const orgId = viewer.active.orgId;

  // RLS sorgt dafür, dass Teamleiter hier nur ihr Team sehen.
  const [members, corrections, absences] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    supabase.from("correction_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase.from("absences").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
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
          <BigNumber size="md" label="ArbZG-Hinweise" value="–" caption="ab Phase 4" rolling={false} />
        </Card>
      </div>
      <Card className="p-0">
        <CardHeader className="px-6 pt-6" title="Wer ist gerade da?" subtitle="Live-Übersicht (Realtime)" />
        <EmptyState title="Live-Board folgt in Phase 5." description="Hier siehst du dann in Echtzeit, wer eingecheckt, in Pause oder abwesend ist." />
      </Card>
    </div>
  );
}
