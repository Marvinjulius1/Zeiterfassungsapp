"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CalendarDays, ChartNoAxesColumn, Inbox, Timer, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { spring } from "@/design-system/motion";

const tabs = [
  { href: "/app", label: "Heute", icon: Timer },
  { href: "/app/zeiten", label: "Zeiten", icon: ChartNoAxesColumn },
  { href: "/app/plan", label: "Plan", icon: CalendarDays },
  { href: "/app/antraege", label: "Anträge", icon: Inbox },
  { href: "/app/profil", label: "Profil", icon: UserRound },
] as const;

/** Bottom-Tabs; liest den Pfad – in <Suspense> rendern, Fallback: BottomBarTabs. */
export function BottomBar() {
  return <BottomBarTabs pathname={usePathname()} />;
}

export function BottomBarTabs({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--zg-bg)_82%,transparent)] backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-lg px-2 pt-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => !active && haptic("tick")}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-semibold transition-[color,transform] active:scale-95",
                  active ? "text-fg" : "text-fg-3",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-tab"
                    className="absolute -top-2 h-[3px] w-6 rounded-full bg-fg"
                    transition={spring.snappy}
                  />
                )}
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
