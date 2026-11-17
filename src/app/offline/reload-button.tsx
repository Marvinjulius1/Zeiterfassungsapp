"use client";

import { Button } from "@/design-system/components/button";
import { buttonVariants } from "@/design-system/components/button-variants";

/** Zurück zur ursprünglich aufgerufenen Seite (?von=…), nur interne Pfade. */
function target() {
  const from = new URLSearchParams(window.location.search).get("von");
  return from && from.startsWith("/") && !from.startsWith("//") ? from : "/app";
}

export function ReloadButton() {
  return (
    <div className="flex gap-2">
      <Button onClick={() => window.location.replace(target())}>Erneut versuchen</Button>
      {/* bewusst ein normaler Link: voller Seitenaufruf, damit der Service Worker die gespeicherte Seite liefert */}
      <a className={buttonVariants({ variant: "secondary" })} href="/app">
        Zu „Heute“
      </a>
    </div>
  );
}
