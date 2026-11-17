import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { TeamCalendarView } from "@/features/absences/components/team-calendar";
import { getTeamCalendar } from "@/features/absences/team-calendar";
import { requireAdminArea } from "@/lib/auth/session";
import { berlinDateKey } from "@/lib/time/berlin";

export const metadata: Metadata = { title: "Abwesenheiten" };

async function Content({ searchParams }: { searchParams: PageProps<"/admin/abwesenheiten">["searchParams"] }) {
  const viewer = await requireAdminArea();
  const sp = await searchParams;
  const month = typeof sp.monat === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.monat) ? sp.monat : berlinDateKey();
  const data = await getTeamCalendar(viewer.active.orgId, month, typeof sp.standort === "string" ? sp.standort : null);
  return <TeamCalendarView data={data} canCreate />;
}

export default function AbsencesPage(props: PageProps<"/admin/abwesenheiten">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Abwesenheiten" description="Wer ist wann weg? Urlaub, Krankheit und Feiertage auf einen Blick." />
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-[24px]" />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
