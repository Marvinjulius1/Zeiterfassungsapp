import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { AdminMobileBar } from "@/components/shell/admin-mobile-bar";
import { AdminNav } from "@/components/shell/admin-nav";
import { Avatar } from "@/design-system/components/avatar";
import { Skeleton } from "@/design-system/components/skeleton";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { requireAdminArea } from "@/lib/auth/session";

async function Guard({ children }: { children: React.ReactNode }) {
  await requireAdminArea();
  return <>{children}</>;
}

async function SidebarUser() {
  const viewer = await requireAdminArea();
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-surface p-3">
      <Avatar name={viewer.active.displayName} size={36} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{viewer.active.displayName}</p>
        <p className="truncate text-xs text-fg-2">
          {ROLE_LABEL[viewer.active.role]} · {viewer.active.orgName}
        </p>
      </div>
    </div>
  );
}

/** Verwaltung: schlanke Sidebar auf Desktop, Menü-Sheet auf Mobile. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-6 lg:flex" aria-label="Verwaltung">
        <div className="px-3.5 pb-8">
          <Logo size={20} />
        </div>
        <nav aria-label="Verwaltung" className="flex-1 overflow-y-auto">
          <AdminNav />
        </nav>
        <Suspense fallback={<Skeleton className="h-[60px] w-full" />}>
          <SidebarUser />
        </Suspense>
      </aside>
      <div className="min-w-0">
        <AdminMobileBar />
        <main id="main" className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
          <Suspense
            fallback={
              <div className="space-y-6" aria-busy aria-label="Wird geladen">
                <Skeleton className="h-10 w-72" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Skeleton className="h-36" />
                  <Skeleton className="h-36" />
                  <Skeleton className="h-36" />
                </div>
              </div>
            }
          >
            <Guard>{children}</Guard>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
