import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/skeleton";
import { StatusPill } from "@/design-system/components/status-pill";
import { requireMember } from "@/lib/auth/session";
import { firstName, greeting } from "@/lib/greeting";

export const metadata: Metadata = { title: "Heute" };

async function Greeting() {
  const viewer = await requireMember();
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-fg-2">{viewer.active.orgName}</p>
        <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-[-0.03em]">
          {greeting()}, {firstName(viewer.active.displayName)}
        </h1>
      </div>
      <StatusPill status="checked_out" />
    </header>
  );
}

export default function TodayPage() {
  return (
    <div className="space-y-8">
      <Suspense fallback={<Skeleton className="h-20 w-64" />}>
        <Greeting />
      </Suspense>
      <Card className="p-0">
        <EmptyState
          title="Hier tickt bald deine Uhr."
          description="Live-Uhr, Hold-to-check-in und Pausen kommen in Phase 3. Fundament, Login und Rollen stehen."
        />
      </Card>
    </div>
  );
}
