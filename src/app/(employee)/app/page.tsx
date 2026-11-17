import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/skeleton";
import { TodayView } from "@/features/stamping/components/today-view";
import { getTodayData } from "@/features/stamping/queries";
import { requireMember } from "@/lib/auth/session";
import { firstName, greeting } from "@/lib/greeting";

export const metadata: Metadata = { title: "Heute" };

async function Today() {
  const viewer = await requireMember();
  const data = await getTodayData(viewer.active.id);
  return (
    <>
      <header>
        <p className="text-sm font-medium text-fg-2">{viewer.active.orgName}</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.03em]">
          {greeting()}, {firstName(viewer.active.displayName)}
        </h1>
      </header>
      <TodayView
        membershipId={viewer.active.id}
        workDate={data.workDate}
        initialEvents={data.events}
        targetMinutes={data.targetMinutes}
        isMinor={data.isMinor}
        requireGeofence={data.requireGeofence}
        geoConsent={data.geoConsent}
        weekMinutesBefore={data.weekMinutesBefore}
        nextShift={data.nextShift}
      />
    </>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-8" aria-busy aria-label="Wird geladen">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-8 w-56 rounded-full" />
      </div>
      <Skeleton className="h-8 w-48 rounded-full" />
      <Skeleton className="h-24 w-72" />
      <Skeleton className="mx-auto h-[292px] w-[292px] rounded-full" />
    </div>
  );
}

export default function TodayPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<TodaySkeleton />}>
        <Today />
      </Suspense>
    </div>
  );
}
