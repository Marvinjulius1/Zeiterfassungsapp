import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { ReportsView, type ReportRow } from "@/features/reports/components/reports-view";
import { getMonthReport } from "@/features/reports/month-report";
import { resolvePayrollSettings } from "@/features/reports/payroll-settings";
import { isOrgAdmin } from "@/lib/auth/roles";
import { requireAdminArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { berlinDateKey, monthRange } from "@/lib/time/berlin";

export const metadata: Metadata = { title: "Berichte & Export" };

async function Content({ searchParams }: { searchParams: PageProps<"/admin/berichte">["searchParams"] }) {
  const viewer = await requireAdminArea();
  const sp = await searchParams;
  const today = berlinDateKey();
  // Standard: Vormonat – der typische Monat für die Lohnabrechnung
  const lastMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
  const ym = typeof sp.monat === "string" && /^\d{4}-\d{2}$/.test(sp.monat) ? sp.monat : lastMonth;
  const month = `${ym}-01`;
  const location = typeof sp.standort === "string" ? sp.standort : null;
  const supabase = await createClient();
  const orgId = viewer.active.orgId;
  const r = monthRange(month);

  let mq = supabase.from("memberships").select("id").eq("org_id", orgId).neq("status", "invited").order("display_name");
  if (location) mq = mq.eq("location_id", location);
  const [{ data: members }, { data: corrections }, { data: org }] = await Promise.all([
    mq,
    supabase.from("correction_requests").select("membership_id").eq("org_id", orgId).eq("status", "pending").gte("work_date", r.from).lte("work_date", r.to),
    supabase.from("organizations").select("payroll_settings").eq("id", orgId).single(),
  ]);
  const reports = await Promise.all((members ?? []).map((m) => getMonthReport(supabase, m.id, month)));
  const rows: ReportRow[] = reports
    .filter((x) => !!x && (x.totals.target > 0 || x.totals.valued > 0 || x.totals.credit > 0 || x.closing))
    .map((x) => {
      const t = x!.totals;
      return {
        membershipId: x!.membershipId,
        name: x!.name,
        employeeNo: x!.employeeNo,
        valued: t.valued,
        credit: t.credit,
        target: t.target,
        diff: t.diff,
        balanceEnd: t.balanceEnd,
        vacationDays: t.vacationDays,
        sickDays: t.sickDays,
        surcharges: t.night + t.sunday + t.holiday,
        incompleteDays: t.incompleteDays,
        pendingCorrections: (corrections ?? []).filter((c) => c.membership_id === x!.membershipId).length,
        confirmed: !!x!.closing?.confirmedAt,
        status: x!.closing?.lockedAt ? "locked" : x!.closing?.confirmedAt ? "confirmed" : "open",
      };
    });

  return (
    <ReportsView
      month={month}
      isPast={r.to < today}
      rows={rows}
      canAdmin={isOrgAdmin(viewer.active.role)}
      payroll={resolvePayrollSettings(org?.payroll_settings)}
      locationQuery={location ? `&standort=${location}` : ""}
    />
  );
}

export default function ReportsPage(props: PageProps<"/admin/berichte">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Berichte & Export" description="Monatsübersicht, Stundenzettel, Lohnexport und Monatsabschluss." />
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-[24px]" />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
