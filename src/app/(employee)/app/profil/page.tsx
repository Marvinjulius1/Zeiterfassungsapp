import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { ListGroup, ListRow } from "@/design-system/components/list-row";
import { Skeleton } from "@/design-system/components/skeleton";
import { ThemeToggle } from "@/design-system/components/theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABEL, canAccessAdmin } from "@/lib/auth/roles";
import { requireMember } from "@/lib/auth/session";
import { OrgSwitcher } from "./org-switcher";

export const metadata: Metadata = { title: "Profil" };

async function ProfileContent() {
  const viewer = await requireMember();
  const { active } = viewer;
  return (
    <>
      <Card className="flex items-center gap-4">
        <Avatar name={viewer.fullName || active.displayName} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{viewer.fullName || active.displayName}</p>
          <p className="truncate text-sm text-fg-2">{viewer.email}</p>
        </div>
        <Badge>{ROLE_LABEL[active.role]}</Badge>
      </Card>

      <Card>
        <ListGroup>
          <ListRow title="Firma" trailing={active.orgName} />
          {viewer.memberships.length > 1 && (
            <div className="py-3.5">
              <OrgSwitcher
                active={active.orgId}
                options={viewer.memberships.map((m) => ({ value: m.orgId, label: m.orgName }))}
              />
            </div>
          )}
          {canAccessAdmin(active.role) && <ListRow title="Zur Verwaltung" href="/admin" />}
          <div className="flex items-center justify-between gap-4 py-3.5">
            <span className="text-[15px] font-medium">Darstellung</span>
            <ThemeToggle />
          </div>
        </ListGroup>
      </Card>
    </>
  );
}

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Profil" />
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-[24px]" />}>
        <ProfileContent />
      </Suspense>
      <form action={signOut}>
        <Button type="submit" variant="secondary" size="lg" block>
          <LogOut className="h-5 w-5" aria-hidden /> Abmelden
        </Button>
      </form>
    </div>
  );
}
