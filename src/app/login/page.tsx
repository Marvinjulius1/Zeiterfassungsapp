import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Skeleton } from "@/design-system/components/skeleton";
import { LoginFlow } from "./login-flow";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),48px)]">
      <Logo />
      <Suspense fallback={<Skeleton className="mt-16 h-64" />}>
        <LoginFlow demoMode={process.env.NEXT_PUBLIC_DEMO_MODE === "true"} />
      </Suspense>
    </main>
  );
}
