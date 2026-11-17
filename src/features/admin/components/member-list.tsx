"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArchiveRestore, Check, ChevronRight, MapPin, Search, Users } from "lucide-react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Segmented } from "@/design-system/components/segmented";
import { toast } from "@/design-system/components/toaster";
import { spring } from "@/design-system/motion";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { bulkUpdateMembers, setMembersArchived } from "../actions";
import { CONTRACT_LABEL, type MemberRow, type Option } from "../members-shared";
import { InviteSheet } from "./invite-sheet";

type Filter = "active" | "invited" | "archived";

export function MemberList({ members, locations, teams, canEdit }: { members: MemberRow[]; locations: Option[]; teams: Option[]; canEdit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteOpen, setInviteOpen] = useState(params.get("einladen") === "1");
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(
    () => ({
      active: members.filter((m) => m.status === "active").length,
      invited: members.filter((m) => m.status === "invited").length,
      archived: members.filter((m) => m.status === "archived").length,
    }),
    [members],
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return members.filter(
      (m) =>
        m.status === filter &&
        (!term || [m.name, m.email, m.locationName, m.teamName, m.employeeNo].some((x) => x?.toLowerCase().includes(term))),
    );
  }, [members, q, filter]);

  // Tastatur: „/" sucht, „n" lädt ein
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || e.metaKey || e.ctrlKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "n" && canEdit) {
        e.preventDefault();
        setInviteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit]);

  const toggle = (id: string) => {
    haptic("tick");
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const allSelected = visible.length > 0 && visible.every((m) => selected.has(m.id));

  function bulk(action: () => Promise<{ ok: boolean; error?: string; data?: { count: number } }>, done: string) {
    start(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error ?? "Aktion fehlgeschlagen");
        return;
      }
      toast.success(`${res.data?.count ?? 0} ${done}`);
      setSelected(new Set());
      router.refresh();
    });
  }

  const select = "h-9 rounded-full border border-line bg-surface-2 px-3 text-sm text-fg";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen …  ( / )"
            aria-label="Mitarbeiter suchen"
            className="h-11 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-[15px] text-fg outline-none placeholder:text-fg-3 focus:border-line-strong"
          />
        </div>
        <Segmented
          label="Status"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setSelected(new Set());
          }}
          options={[
            { value: "active", label: `Aktiv ${counts.active}` },
            { value: "invited", label: `Eingeladen ${counts.invited}` },
            { value: "archived", label: `Archiv ${counts.archived}` },
          ]}
        />
        {canEdit && <InviteSheet locations={locations} teams={teams} open={inviteOpen} onOpenChange={setInviteOpen} />}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={q ? "Niemand gefunden." : filter === "invited" ? "Keine offenen Einladungen." : filter === "archived" ? "Das Archiv ist leer." : "Noch niemand hier."}
          description={q ? "Versuch es mit einem anderen Suchbegriff." : filter === "active" ? "Lade dein Team ein – das dauert keine Minute." : undefined}
          action={canEdit && filter === "active" && !q ? <Button onClick={() => setInviteOpen(true)}>Erste Person einladen</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-line bg-surface">
          <div className="flex items-center gap-4 border-b border-line px-5 py-3 text-sm text-fg-3">
            {canEdit && (
              <Checkbox
                checked={allSelected}
                label="Alle auswählen"
                onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((m) => m.id)))}
              />
            )}
            <span>{visible.length} {visible.length === 1 ? "Person" : "Personen"}</span>
          </div>
          <ul className="divide-y divide-line">
            {visible.map((m) => (
              <li key={m.id} className={cn("flex items-center gap-4 px-5 py-3.5 transition-colors", selected.has(m.id) && "bg-surface-2")}>
                {canEdit && <Checkbox checked={selected.has(m.id)} label={`${m.name} auswählen`} onChange={() => toggle(m.id)} />}
                <Link href={`/admin/mitarbeiter/${m.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <Avatar name={m.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{m.name}</span>
                      {m.role !== "employee" && <Badge>{ROLE_LABEL[m.role]}</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-fg-2">
                      {[m.contractType && CONTRACT_LABEL[m.contractType], m.weeklyMinutes != null && `${m.weeklyMinutes / 60} h/Woche`, m.locationName, m.teamName]
                        .filter(Boolean)
                        .join(" · ") || m.email}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-fg-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bulk-Leiste */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={spring.gentle}
            className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-[min(720px,calc(100%-32px))] flex-wrap items-center gap-2 rounded-[28px] border border-line bg-surface-2 p-2 shadow-[0_12px_40px_rgb(0_0_0/0.35)] pl-5 lg:ml-[calc(50%+130px-360px)]"
            role="toolbar"
            aria-label="Aktionen für Auswahl"
          >
            <span className="mr-auto text-sm font-semibold">{selected.size} ausgewählt</span>
            <label className="flex items-center gap-1.5 text-sm text-fg-2">
              <MapPin className="h-4 w-4" aria-hidden />
              <select
                className={select}
                disabled={pending}
                value=""
                aria-label="Standort für Auswahl setzen"
                onChange={(e) => bulk(() => bulkUpdateMembers([...selected], { locationId: e.target.value || null }), "Personen verschoben")}
              >
                <option value="">Standort …</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-sm text-fg-2">
              <Users className="h-4 w-4" aria-hidden />
              <select
                className={select}
                disabled={pending}
                value=""
                aria-label="Team für Auswahl setzen"
                onChange={(e) => bulk(() => bulkUpdateMembers([...selected], { teamId: e.target.value || null }), "Personen neuem Team zugeordnet")}
              >
                <option value="">Team …</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            {filter === "archived" ? (
              <Button size="sm" variant="secondary" loading={pending} onClick={() => bulk(() => setMembersArchived([...selected], false), "Personen reaktiviert")}>
                <ArchiveRestore className="h-4 w-4" aria-hidden /> Reaktivieren
              </Button>
            ) : (
              <Button size="sm" variant="secondary" loading={pending} onClick={() => bulk(() => setMembersArchived([...selected], true), "Personen archiviert")}>
                <Archive className="h-4 w-4" aria-hidden /> Archivieren
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
        checked ? "border-transparent bg-inverse text-inverse-fg" : "border-line-strong",
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
    </button>
  );
}
