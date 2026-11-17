import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { WeekPlanner } from "@/features/shifts/components/week-planner";
import { getWeekPlan } from "@/features/shifts/queries";
import { requireAdminArea } from "@/lib/auth/session";
import { berlinDateKey, mondayOf } from "@/lib/time/berlin";

export const metadata: Metadata = { title: "Schichtplan" };

async function Content({ searchParams }: { searchParams: PageProps<"/admin/schichtplan">["searchParams"] }) {
  const viewer = await requireAdminArea();
  const sp = await searchParams;
  const week = typeof sp.woche === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.woche) ? sp.woche : berlinDateKey();
  const plan = await getWeekPlan(viewer.active.orgId, mondayOf(week), typeof sp.standort === "string" ? sp.standort : null);
  return <WeekPlanner plan={plan} />;
}

export default function ShiftPlanPage(props: PageProps<"/admin/schichtplan">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Schichtplan" description="Planen per Drag & Drop – Konflikte mit Arbeitszeitgesetz und Urlaub siehst du sofort." />
      <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-[24px]" />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
