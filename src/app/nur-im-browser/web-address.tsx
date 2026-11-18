"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { haptic } from "@/lib/haptics";

/** Adresse der Verwaltung zum Abtippen oder Kopieren */
export function WebAddress() {
  // Adresse erst im Browser bekannt (Server: null → Platzhalter, kein Hydration-Fehler)
  const url = useSyncExternalStore(
    () => () => {},
    () => `${window.location.host}/admin`,
    () => null,
  );
  const [copied, setCopied] = useState(false);
  if (!url) return <div className="h-14 w-full" aria-hidden />;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/admin`);
          haptic("success");
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* Zwischenablage nicht verfügbar – Adresse ist sichtbar */
        }
      }}
      className="flex h-14 w-full items-center justify-between gap-3 rounded-[18px] border border-line bg-surface px-4 text-left"
      aria-label={`Adresse ${url} kopieren`}
    >
      <span className="tabular truncate text-[15px] font-semibold">{url}</span>
      {copied ? <Check className="h-5 w-5 shrink-0 text-ok" aria-hidden /> : <Copy className="h-5 w-5 shrink-0 text-fg-2" aria-hidden />}
    </button>
  );
}
