"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Sheet } from "@/design-system/components/sheet";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { markNotificationsRead } from "../actions";
import { linkFor } from "../links";
import { PushToggle } from "./push-toggle";

interface Item {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  payload: unknown;
  read_at: string | null;
  created_at: string;
}

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "gestern" : `vor ${d} Tagen`;
  return new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "short" });
}

/** Glocke mit Zähler. Lädt die letzten Benachrichtigungen und aktualisiert sich live (Realtime, RLS). */
export function NotificationBell({ className }: { className?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, payload, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      await load();
      channel = supabase
        .channel(`notifications:${data.user.id}:${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${data.user.id}` }, (p) =>
          setItems((list) => [p.new as Item, ...list.filter((x) => x.id !== (p.new as Item).id)].slice(0, 30)),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load]);

  const unread = items.filter((i) => !i.read_at).length;

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && unread > 0) {
      // Beim Öffnen gelesen markieren; die Punkte bleiben sichtbar, bis das Sheet zu ist
      setFreshIds(new Set(items.filter((i) => !i.read_at).map((i) => i.id)));
      const now = new Date().toISOString();
      setItems((list) => list.map((i) => (i.read_at ? i : { ...i, read_at: now })));
      void markNotificationsRead();
    }
    if (!v) setFreshIds(new Set());
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Benachrichtigungen"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={unread ? `Benachrichtigungen, ${unread} ungelesen` : "Benachrichtigungen"}
          data-testid="notification-bell"
        >
          <Bell className="h-5 w-5" aria-hidden />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key={unread}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 22 }}
                className="tabular absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-alert px-1 text-[11px] font-bold leading-none text-white"
                aria-hidden
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      }
    >
      <div className="space-y-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-fg-2">
            <BellOff className="h-8 w-8" aria-hidden />
            <p className="text-[15px]">{loaded ? "Noch keine Benachrichtigungen." : "Wird geladen …"}</p>
          </div>
        ) : (
          <ul className="-mx-2 max-h-[52dvh] space-y-1 overflow-y-auto" aria-label="Letzte Benachrichtigungen">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={linkFor(n.kind, n.payload)}
                  onClick={() => onOpenChange(false)}
                  className="flex gap-3 rounded-[16px] px-2 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <span
                    className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", freshIds.has(n.id) || !n.read_at ? "bg-alert" : "bg-transparent")}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[15px] font-semibold">
                        {freshIds.has(n.id) && <span className="sr-only">Neu: </span>}
                        {n.title}
                      </span>
                      <span className="shrink-0 text-xs text-fg-3">{ago(n.created_at)}</span>
                    </span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-fg-2">{n.body}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line pt-4">
          <PushToggle />
        </div>
      </div>
    </Sheet>
  );
}
