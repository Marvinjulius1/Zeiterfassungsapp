import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Firma anlegen" };

export default function OnboardingPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),40px)]">
      <Logo />
      <OnboardingWizard />
    </main>
  );
}
