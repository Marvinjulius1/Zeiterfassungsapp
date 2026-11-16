"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Activity, CalendarRange, ClipboardCheck, Clock4, FileBarChart, MapPin,
  ScrollText, Settings2, SlidersHorizontal, Smartphone, Users, CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { spring } from "@/design-system/motion";

export const adminNav = [
  { href: "/admin", label: "Live", icon: Activity },
  { href: "/admin/freigaben", label: "Freigaben", icon: ClipboardCheck },
  { href: "/admin/mitarbeiter", label: "Mitarbeiter", icon: Users },
  { href: "/admin/zeiten", label: "Zeiten", icon: Clock4 },
  { href: "/admin/schichtplan", label: "Schichtplan", icon: CalendarClock },
  { href: "/admin/abwesenheiten", label: "Abwesenheiten", icon: CalendarRange },
  { href: "/admin/berichte", label: "Berichte", icon: FileBarChart },
  { href: "/admin/regeln", label: "Regeln", icon: SlidersHorizontal },
  { href: "/admin/standorte", label: "Standorte", icon: MapPin },
  { href: "/admin/audit", label: "Audit-Log", icon: ScrollText },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: Settings2 },
] as const;

/** Aktiver Pfad – braucht Request-Daten, daher in <Suspense> rendern (Fallback: AdminNavLinks). */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return <AdminNavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

export function AdminNavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {adminNav.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-full px-3.5 text-[14px] font-medium transition-colors",
                active ? "text-fg" : "text-fg-2 hover:text-fg",
              )}
            >
              {active && (
                <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-full bg-surface-2" transition={spring.snappy} />
              )}
              <Icon className="relative h-[18px] w-[18px]" aria-hidden />
              <span className="relative">{label}</span>
            </Link>
          </li>
        );
      })}
      <li className="pt-4">
        <Link
          href="/app"
          className="flex h-10 items-center gap-3 rounded-full px-3.5 text-[14px] font-medium text-fg-2 hover:text-fg"
        >
          <Smartphone className="h-[18px] w-[18px]" aria-hidden />
          Zur Mitarbeiter-App
        </Link>
      </li>
    </ul>
  );
}
