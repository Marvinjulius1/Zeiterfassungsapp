import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { MemberList } from "@/features/admin/components/member-list";
import { getMemberOptions, getMembers } from "@/features/admin/members";
import { isOrgAdmin } from "@/lib/auth/roles";
import { requireAdminArea } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mitarbeiter" };

async function Content() {
  const viewer = await requireAdminArea();
  const [members, options] = await Promise.all([getMembers(viewer.active.orgId), getMemberOptions(viewer.active.orgId)]);
  return <MemberList members={members} locations={options.locations} teams={options.teams} canEdit={isOrgAdmin(viewer.active.role)} />;
}

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Mitarbeiter" description="Dein Team auf einen Blick. Einladen per Link, QR-Code oder E-Mail." />
      <Suspense
        fallback={
          <div className="space-y-4" aria-busy aria-label="Wird geladen">
            <Skeleton className="h-11 w-full rounded-full" />
            <Skeleton className="h-96 w-full rounded-[24px]" />
          </div>
        }
      >
        <Content />
      </Suspense>
    </div>
  );
}
