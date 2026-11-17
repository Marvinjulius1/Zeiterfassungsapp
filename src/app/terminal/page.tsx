import type { Metadata, Viewport } from "next";
import { TerminalApp } from "@/features/terminal/terminal-app";

export const metadata: Metadata = {
  title: "Terminal",
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#000000" };

/** Kiosk-Terminal für Tablets am Eingang. Kein Benutzer-Login – Kopplung per Code. */
export default function TerminalPage() {
  return <TerminalApp />;
}
