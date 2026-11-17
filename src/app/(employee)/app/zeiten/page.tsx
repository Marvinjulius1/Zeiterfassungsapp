import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/design-system/components/badge";
import { BigNumber } from "@/design-system/components/big-number";
import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";
import { WeekChart } from "@/design-system/components/week-chart";
import { Timeline } from "@/features/stamping/components/timeline";
import { CorrectionSheet } from "@/features/timesheet/components/correction-sheet";
import { ViolationList } from "@/features/compliance/components/violation-list";
import { DayList } from "@/features/timesheet/components/day-list";
import { PeriodNav } from "@/features/timesheet/components/period-nav";
import { MonthConfirmCard } from "@/features/reports/components/month-confirm-card";
import { CORRECTION_KIND_LABEL, STATUS_LABEL } from "@/features/timesheet/labels";
import { parseDate, parseView } from "@/features/timesheet/periods";
import { getTimesheet, type Timesheet } from "@/features/timesheet/queries";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { berlinDateKey, formatMonth, formatWeekdayShort, monthRange } from "@/lib/time/berlin";
import { formatHours } from "@/lib/time/format";

export const metadata: Metadata = { title: "Meine Zeiten" };

function Totals({ t }: { t: Timesheet["totals"] }) {
  const diff = t.net - t.target;
  return (
    <div className="grid grid-cols-3 divide-x divide-line">
      {[
        ["Ist", formatHours(t.net)],
        ["Soll", formatHours(t.target)],
        ["Differenz", formatHours(diff, { sign: true })],
      ].map(([label, value]) => (
        <div key={label} className="px-3 first:pl-0 last:pr-0">
          <p className="text-sm text-fg-2">{label}</p>
          <p className="tabular mt-1 whitespace-nowrap text-lg font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

async function loadClosing(membershipId: string, from: string, to: string) {
  const supabase = await createClient();
  const [{ data: c }, { count }] = await Promise.all([
    supabase.from("month_closings").select("employee_confirmed_at, locked_at").eq("membership_id", membershipId).eq("month", from).maybeSingle(),
    supabase.from("work_days").select("work_date", { count: "exact", head: true }).eq("membership_id", membershipId).eq("status", "incomplete").gte("work_date", from).lte("work_date", to),
  ]);
  return { confirmedAt: c?.employee_confirmed_at ?? null, lockedAt: c?.locked_at ?? null, incompleteDays: count ?? 0 };
}

async function Content({ searchParams }: { searchParams: PageProps<"/app/zeiten">["searchParams"] }) {
  // Erst Session (Request-Zeit), dann Datumslogik mit new Date()
  const viewer = await requireMember();
  const sp = await searchParams;
  const view = parseView(sp.view);
  const date = parseDate(sp.date);
  const today = berlinDateKey();
  const ts = await getTimesheet(viewer.active.id, view, date);
  const dayHref = (d: string) => `/app/zeiten?view=day&date=${d}`;
  const month = view === "month" ? monthRange(date) : null;
  const closing = month ? await loadClosing(viewer.active.id, month.from, month.to) : null;

  return (
    <>
      <Card>
        <BigNumber
          size="lg"
          label="Stundenkonto"
          value={formatHours(ts.balanceMinutes, { sign: true }).replace(" h", "")}
          rolling={false}
          caption="Stand gestern · abgeschlossene Tage"
          ariaLabel={`Stundenkonto ${formatHours(ts.balanceMinutes, { sign: true })}`}
        />
      </Card>

      <PeriodNav view={view} date={date} today={today} />

      {view !== "day" && (
        <Card className="space-y-6">
          {view === "week" && (
            <WeekChart
              key={date}
              days={ts.days.map((d) => ({
                label: formatWeekdayShort(d.date),
                minutes: d.netMinutes,
                targetMinutes: d.targetMinutes,
                isToday: d.date === today,
              }))}
            />
          )}
          <Totals t={ts.totals} />
        </Card>
      )}

      {month && closing && (
        <MonthConfirmCard
          key={month.from}
          month={month.from}
          label={formatMonth(month.from)}
          isPast={month.to < today}
          confirmedAt={closing.confirmedAt}
          lockedAt={closing.lockedAt}
          incompleteDays={closing.incompleteDays}
        />
      )}

      {view !== "day" ? (
        <Card className="py-2">
          <DayList days={ts.days} today={today} hrefFor={dayHref} />
        </Card>
      ) : (
        <>
          <Card className="space-y-2">
            <Totals t={ts.totals} />
          </Card>
          {ts.events.length > 0 ? (
            <Card className="py-2">
              <Timeline events={ts.events} />
            </Card>
          ) : (
            <p className="py-4 text-center text-[15px] text-fg-2">An diesem Tag gibt es keine Buchungen.</p>
          )}
          {ts.violations.length > 0 && <ViolationList items={ts.violations} />}
          {ts.corrections.map((c) => (
            <Card key={c.id} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[15px] font-semibold">{CORRECTION_KIND_LABEL[c.kind] ?? c.kind}</p>
                <p className="mt-0.5 text-sm text-fg-2">{c.reason}</p>
              </div>
              <Badge tone={STATUS_LABEL[c.status]?.tone}>{STATUS_LABEL[c.status]?.label ?? c.status}</Badge>
            </Card>
          ))}
          {date <= today && <CorrectionSheet date={date} />}
        </>
      )}
    </>
  );
}

export default function TimesPage(props: PageProps<"/app/zeiten">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Meine Zeiten" />
      <Suspense
        fallback={
          <div className="space-y-6" aria-busy aria-label="Wird geladen">
            <Skeleton className="h-36 w-full rounded-[24px]" />
            <Skeleton className="h-11 w-full rounded-full" />
            <Skeleton className="h-64 w-full rounded-[24px]" />
          </div>
        }
      >
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
