import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/design-system/components/button-variants";
import { LiveDemoClock } from "./_landing/live-demo-clock";

export default function Home() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),32px)]">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Anmelden
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fg-3">Zeiterfassung · Made for Germany</p>
        <h1 className="mt-5 max-w-3xl text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[72px]">
          Arbeitszeit.
          <br />
          <span className="text-fg-2">Ohne Reibung.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-fg-2">
          Einchecken mit einem Fingerdruck. Arbeitszeitgesetz im Hintergrund. Schichtplan, Urlaub und Lohnexport an einem
          Ort – schöner als alles, was du kennst.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login?next=/onboarding" className={buttonVariants({ size: "lg" })}>
            Firma anlegen
          </Link>
          <Link href="/login" className={buttonVariants({ size: "lg", variant: "secondary" })}>
            Ich bin Mitarbeiter
          </Link>
        </div>

        <LiveDemoClock />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-fg-3">
        <span>Gehostet in Frankfurt · DSGVO · ArbZG-konform</span>
        <Link href="/design" className="hover:text-fg">
          Design-System
        </Link>
      </footer>
    </main>
  );
}
