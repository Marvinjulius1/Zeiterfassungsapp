"use client";

import { toast } from "@/design-system/components/toaster";
import { downloadInApp } from "@/lib/native/download";
import { isNativeApp } from "@/lib/native/platform";

/**
 * Download-Link, der im Browser ganz normal funktioniert und in der nativen App
 * stattdessen das Teilen-Menü öffnet.
 */
export function DownloadLink({ href, children, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...rest}
      href={href}
      download
      onClick={(e) => {
        onClick?.(e);
        // synchron entscheiden – nach einem await wäre es für preventDefault zu spät
        if (e.defaultPrevented || !isNativeApp()) return;
        e.preventDefault();
        downloadInApp(href).catch((err) => {
          // Teilen abgebrochen ist kein Fehler
          if (!/cancel/i.test(String(err))) toast.error(err instanceof Error ? err.message : "Download fehlgeschlagen");
        });
      }}
    >
      {children}
    </a>
  );
}
