import type { Metadata } from "next";
import { Suspense } from "react";
import { PencilLine } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/design-system/components/badge";
import { BigNumber } from "@/design-system/components/big-number";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader } from "@/design-system/components/card";
import { ListGroup, ListRow } from "@/design-system/components/list-row";
import { Skeleton } from "@/design-system/components/skeleton";
import { AbsenceList } from "@/features/absences/components/absence-list";
import { SickSheet, VacationSheet } from "@/features/absences/components/absence-sheets";
import { getMyAbsences } from "@/features/absences/queries";
import { CorrectionSheet } from "@/features/timesheet/components/correction-sheet";
import { CORRECTION_KIND_LABEL, STATUS_LABEL } from "@/features/timesheet/labels";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDayShort } from "@/lib/time/berlin";

export const metadata: Metadata = { title: "Anträge" };

const n = (x: number) => x.toLocaleString("de-DE");

async function Requests() {
  const viewer = await requireMember();
  const supabase = await createClient();
  const [ctx, { data: corrections }] = await Promise.all([
    getMyAbsences(viewer.active.id),
    supabase
      .from("correction_requests")
      .select("id, work_date, kind, status, reason")
      .eq("membership_id", viewer.active.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const b = ctx.balance;
  const sheetCtx = {
    dailyTargets: ctx.dailyTargets,
    schoolDays: ctx.schoolDays,
    holidays: ctx.holidays,
    balance: ctx.balance,
    orgId: ctx.orgId,
    membershipId: ctx.membershipId,
  };

  return (
    <>
      <Card className="space-y-5">
        <BigNumber
          size="lg"
          label={`Resturlaub ${ctx.year}`}
          value={n(b.remaining)}
          rolling={false}
          caption={`von ${n(b.entitlement + b.carriedOver)} Tagen${b.carriedOver ? ` (inkl. ${n(b.carriedOver)} aus dem Vorjahr)` : ""}`}
          ariaLabel={`Resturlaub ${n(b.remaining)} Tage`}
        />
        <div className="grid grid-cols-3 divide-x divide-line text-sm">
          {[
            ["Genommen", b.taken],
            ["Geplant", b.planned],
            ["Beantragt", b.pending],
          ].map(([l, v]) => (
            <div key={l as string} className="px-3 first:pl-0">
              <p className="text-fg-2">{l}</p>
              <p className="tabular mt-0.5 text-lg font-semibold">{n(v as number)}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <VacationSheet ctx={sheetCtx} />
          <SickSheet ctx={sheetCtx} />
        </div>
      </Card>

      <Card className="pb-2">
        <CardHeader title="Abwesenheiten" />
        <AbsenceList items={ctx.absences} />
      </Card>

      <Card className="pb-2">
        <CardHeader
          title="Zeitkorrekturen"
          subtitle="Vergessenes Stempeln, falsche Zeiten"
          action={
            <CorrectionSheet
              allowDatePick
              trigger={
                <Button variant="secondary" size="sm">
                  <PencilLine className="h-4 w-4" aria-hidden /> Neu
                </Button>
              }
            />
          }
        />
        {(corrections ?? []).length === 0 ? (
          <p className="pb-4 text-sm text-fg-2">Noch keine Anträge – alles sauber gestempelt. 👌</p>
        ) : (
          <ListGroup>
            {(corrections ?? []).map((r) => {
              const s = STATUS_LABEL[r.status] ?? { label: r.status, tone: "neutral" as const };
              return (
                <ListRow
                  key={r.id}
                  href={`/app/zeiten?view=day&date=${r.work_date}`}
                  chevron={false}
                  title={CORRECTION_KIND_LABEL[r.kind] ?? r.kind}
                  subtitle={`${formatDayShort(r.work_date)} · ${r.reason}`}
                  trailing={<Badge tone={s.tone}>{s.label}</Badge>}
                />
              );
            })}
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
            <Skeleton className="h-64 w-full rounded-[24px]" />
            <Skeleton className="h-48 w-full rounded-[24px]" />
          </div>
        }
      >
        <Requests />
      </Suspense>
    </div>
  );
}
