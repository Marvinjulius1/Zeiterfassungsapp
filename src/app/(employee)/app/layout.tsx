import { Suspense } from "react";
import { BottomBar, BottomBarTabs } from "@/components/shell/bottom-bar";
import { PageTransition } from "@/components/shell/page-transition";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { Skeleton } from "@/design-system/components/skeleton";
import { requireMember } from "@/lib/auth/session";

async function Guard({ children }: { children: React.ReactNode }) {
  await requireMember();
  return <>{children}</>;
}

function AppSkeleton() {
  return (
    <div className="space-y-6 pt-2" aria-busy aria-label="Wird geladen">
      <Skeleton className="h-5 w-40 rounded-full" />
      <Skeleton className="h-24 w-64" />
      <Skeleton className="h-56 w-full rounded-[28px]" />
    </div>
  );
}

/** Mitarbeiter-App: mobile first, Bottom-Tab-Bar. */
export default function EmployeeLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      <main
        id="main"
        className="relative mx-auto w-full max-w-lg px-5 pb-32 pt-[max(env(safe-area-inset-top),24px)]"
      >
        <Suspense fallback={<AppSkeleton />}>
          <Guard>
            <div className="absolute right-3 top-[max(env(safe-area-inset-top),24px)] z-20">
              <NotificationBell />
            </div>
            <PageTransition>{children}</PageTransition>
          </Guard>
        </Suspense>
      </main>
      <Suspense fallback={<BottomBarTabs pathname={null} />}>
        <BottomBar />
      </Suspense>
    </>
  );
}
