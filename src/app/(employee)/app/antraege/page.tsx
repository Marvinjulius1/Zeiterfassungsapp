import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { ListGroup, ListRow } from "@/design-system/components/list-row";
import { Skeleton } from "@/design-system/components/skeleton";
import { CorrectionSheet } from "@/features/timesheet/components/correction-sheet";
import { CORRECTION_KIND_LABEL, STATUS_LABEL } from "@/features/timesheet/labels";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDayShort } from "@/lib/time/berlin";

export const metadata: Metadata = { title: "Anträge" };

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

async function Requests() {
  const viewer = await requireMember();
  const supabase = await createClient();
  const [corrections, absences] = await Promise.all([
    supabase
      .from("correction_requests")
      .select("id, work_date, kind, status, reason")
      .eq("membership_id", viewer.active.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("absences")
      .select("id, start_date, end_date, status, absence_types(label)")
      .eq("membership_id", viewer.active.id)
      .order("start_date", { ascending: false })
      .limit(30),
  ]);

  const c = corrections.data ?? [];
  const a = absences.data ?? [];

  return (
    <>
      <CorrectionSheet
        membershipId={viewer.active.id}
        orgId={viewer.active.orgId}
        allowDatePick
        trigger={
          <Button size="lg" block>
            <Plus className="h-5 w-5" aria-hidden /> Zeitkorrektur beantragen
          </Button>
        }
      />

      <Card className="pb-2">
        <CardHeader title="Zeitkorrekturen" subtitle="Vergessenes Stempeln, falsche Zeiten" />
        {c.length === 0 ? (
          <p className="pb-4 text-sm text-fg-2">Noch keine Anträge – alles sauber gestempelt. 👌</p>
        ) : (
          <ListGroup>
            {c.map((r) => (
              <ListRow
                key={r.id}
                href={`/app/zeiten?view=day&date=${r.work_date}`}
                chevron={false}
                title={CORRECTION_KIND_LABEL[r.kind] ?? r.kind}
                subtitle={`${formatDayShort(r.work_date)} · ${r.reason}`}
                trailing={<StatusBadge status={r.status} />}
              />
            ))}
          </ListGroup>
        )}
      </Card>

      <Card className="pb-2">
        <CardHeader title="Abwesenheiten" subtitle="Urlaub beantragen und Krankmeldung folgen in Phase 7" />
        {a.length === 0 ? (
          <EmptyState title="Keine Abwesenheiten." className="py-6" />
        ) : (
          <ListGroup>
            {a.map((r) => (
              <ListRow
                key={r.id}
                title={r.absence_types?.label ?? "Abwesenheit"}
                subtitle={`${formatDayShort(r.start_date)} – ${formatDayShort(r.end_date)}`}
                trailing={<StatusBadge status={r.status} />}
              />
            ))}
          </ListGroup>
        )}
      </Card>
    </>
  );
}

export default function RequestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Anträge" />
      <Suspense
        fallback={
          <div className="space-y-6" aria-busy aria-label="Wird geladen">
            <Skeleton className="h-14 w-full rounded-full" />
            <Skeleton className="h-48 w-full rounded-[24px]" />
          </div>
        }
      >
        <Requests />
      </Suspense>
    </div>
  );
}
