"use client";

import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-6">
      <EmptyState
        title="Da ist etwas schiefgelaufen."
        description="Die Verbindung zum Server hat kurz gehakt. Versuch es einfach noch einmal."
        action={<Button size="lg" onClick={reset}>Erneut versuchen</Button>}
      />
    </main>
  );
}
