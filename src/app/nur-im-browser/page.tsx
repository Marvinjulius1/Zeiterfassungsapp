import type { Metadata } from "next";
import { Monitor } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { buttonVariants } from "@/design-system/components/button-variants";
import { signOut } from "@/lib/auth/actions";
import { WebAddress } from "./web-address";

export const metadata: Metadata = { title: "Verwaltung im Browser" };

/** Ziel, wenn in der nativen App die Verwaltung oder das Anlegen einer Firma aufgerufen wird. */
export default function BrowserOnlyPage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),24px)] text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-2" aria-hidden>
        <Monitor className="h-9 w-9 text-fg-2" />
      </span>
      <div className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Verwaltung im Browser</h1>
        <p className="text-[15px] text-fg-2">
          Die App ist für die Zeiterfassung da. Mitarbeitende verwalten, Freigaben, Schichtplan, Berichte und das
          Anlegen einer Firma gibt es in der Web-App – am besten am Computer:
        </p>
      </div>
      <WebAddress />
      <div className="flex w-full flex-col gap-2">
        <a className={buttonVariants({ size: "lg", block: true })} href="/app">
          Zur Zeiterfassung
        </a>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="lg" block>
            Abmelden
          </Button>
        </form>
      </div>
    </main>
  );
}
