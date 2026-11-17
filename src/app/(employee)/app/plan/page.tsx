import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { MyPlanView } from "@/features/shifts/components/my-plan";
import { getMyPlan } from "@/features/shifts/my-plan";
import { requireMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Schichtplan" };

async function Content() {
  const viewer = await requireMember();
  const data = await getMyPlan(viewer.active.id, viewer.active.orgId);
  return <MyPlanView data={data} />;
}

export default function PlanPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Schichtplan" />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[24px]" />}>
        <Content />
      </Suspense>
    </div>
  );
}
