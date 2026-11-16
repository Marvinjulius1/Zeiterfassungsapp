import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { Inbox } from "@/features/admin/components/inbox";
import { getInbox } from "@/features/admin/queries";
import { requireAdminArea } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Freigaben" };

async function Content() {
  const viewer = await requireAdminArea();
  const items = await getInbox(viewer.active.orgId);
  return <Inbox initial={items} />;
}

export default function ApprovalsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Freigaben" description="Korrekturen und Urlaubsanträge – mit einem Klick erledigt." />
      <Suspense
        fallback={
          <div className="space-y-3" aria-busy aria-label="Wird geladen">
            <Skeleton className="h-36 w-full rounded-[24px]" />
            <Skeleton className="h-36 w-full rounded-[24px]" />
          </div>
        }
      >
        <Content />
      </Suspense>
    </div>
  );
}
