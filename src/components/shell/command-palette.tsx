"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { LogOut, Moon, Search, Smartphone, UserPlus, UserRound } from "lucide-react";
import { setTheme } from "@/design-system/components/theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { adminNav } from "./admin-nav";
import { paletteFilter } from "./palette-filter";

/** Sprungkürzel: erst „g", dann Buchstabe */
const JUMPS: Record<string, string> = {
  l: "/admin",
  f: "/admin/freigaben",
  m: "/admin/mitarbeiter",
  z: "/admin/zeiten",
  r: "/admin/regeln",
  a: "/admin/audit",
  e: "/admin/einstellungen",
};

export function CommandPalette({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const gPressed = useRef<number>(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "g") {
        gPressed.current = Date.now();
        return;
      }
      if (Date.now() - gPressed.current < 900 && JUMPS[k]) {
        e.preventDefault();
        gPressed.current = 0;
        router.push(JUMPS[k]);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("zg:command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("zg:command-palette", onOpen);
    };
  }, [router]);

  // Personen vorab laden, damit die Suche beim ersten Tippen schon alles kennt
  useEffect(() => {
    void createClient()
      .from("memberships")
      .select("id, display_name")
      .eq("org_id", orgId)
      .neq("status", "archived")
      .order("display_name")
      .then(({ data }) => setPeople((data ?? []).map((m) => ({ id: m.id, name: m.display_name }))));
  }, [orgId]);

  const run = useCallback(
    (fn: () => void) => {
      setOpen(false);
      fn();
    },
    [],
  );

  const item =
    "flex h-11 cursor-pointer items-center gap-3 rounded-[14px] px-3 text-[15px] text-fg-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-fg";
  const heading = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-3";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--zg-overlay)] backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100%-32px))] -translate-x-1/2 overflow-hidden rounded-[24px] border border-line bg-surface shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Befehle und Suche</Dialog.Title>
          <Command loop label="Befehle und Suche" filter={paletteFilter}>
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search className="h-5 w-5 text-fg-3" aria-hidden />
              <Command.Input
                autoFocus
                placeholder="Wohin? Wen suchst du?"
                className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-3"
              />
              <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 text-xs text-fg-3">esc</kbd>
            </div>
            <Command.List className={`max-h-[60vh] overflow-y-auto p-2 ${heading}`}>
              <Command.Empty className="py-10 text-center text-sm text-fg-2">Nichts gefunden.</Command.Empty>
              <Command.Group heading="Aktionen">
                <Command.Item className={item} onSelect={() => run(() => router.push("/admin/mitarbeiter?einladen=1"))}>
                  <UserPlus className="h-4 w-4" aria-hidden /> Mitarbeiter einladen
                </Command.Item>
                <Command.Item className={item} onSelect={() => run(() => router.push("/app"))}>
                  <Smartphone className="h-4 w-4" aria-hidden /> Zur Mitarbeiter-App
                </Command.Item>
                <Command.Item
                  className={item}
                  onSelect={() => run(() => setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"))}
                >
                  <Moon className="h-4 w-4" aria-hidden /> Hell/Dunkel umschalten
                </Command.Item>
                <Command.Item className={item} onSelect={() => run(() => void signOut())}>
                  <LogOut className="h-4 w-4" aria-hidden /> Abmelden
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Gehe zu">
                {adminNav.map(({ href, label, icon: Icon }) => {
                  const key = Object.entries(JUMPS).find(([, v]) => v === href)?.[0];
                  return (
                    <Command.Item key={href} value={`gehe zu ${label}`} className={item} onSelect={() => run(() => router.push(href))}>
                      <Icon className="h-4 w-4" aria-hidden /> {label}
                      {key && <span className="ml-auto text-xs text-fg-3">G {key.toUpperCase()}</span>}
                    </Command.Item>
                  );
                })}
              </Command.Group>
              {people.length > 0 && (
                <Command.Group heading="Personen">
                  {people.map((p) => (
                    <Command.Item key={p.id} value={`person ${p.name}`} className={item} onSelect={() => run(() => router.push(`/admin/mitarbeiter/${p.id}`))}>
                      <UserRound className="h-4 w-4" aria-hidden /> {p.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Knopf in der Sidebar */
export function CommandButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("zg:command-palette"))}
      className="flex h-10 w-full items-center gap-3 rounded-full bg-surface-2 px-3.5 text-sm text-fg-3 hover:text-fg"
    >
      <Search className="h-4 w-4" aria-hidden />
      Suchen
      <kbd className="ml-auto rounded-md border border-line-strong px-1.5 text-xs">⌘K</kbd>
    </button>
  );
}
