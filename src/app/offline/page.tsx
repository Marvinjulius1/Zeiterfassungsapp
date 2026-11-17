import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { ReloadButton } from "./reload-button";

export const metadata: Metadata = { title: "Offline" };

/** Wird vom Service Worker gezeigt, wenn eine Seite ohne Netz noch nie geladen wurde. */
export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-2" aria-hidden>
        <WifiOff className="h-9 w-9 text-fg-2" />
      </span>
      <div className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Du bist offline</h1>
        <p className="text-[15px] text-fg-2">
          Diese Seite war noch nicht auf deinem Gerät gespeichert. Sobald du wieder Netz hast, geht es weiter. Stempeln
          funktioniert auf „Heute“ auch offline – die Buchungen werden später automatisch gesendet.
        </p>
      </div>
      <ReloadButton />
    </main>
  );
}
