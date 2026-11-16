"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { formatDayLong, formatDayShort, formatTime, shiftDays } from "@/lib/time/berlin";
import { formatHours, formatMinutesShort } from "@/lib/time/format";
import { DayEditor } from "./day-editor";

export interface TimeRow {
  key: string;
  membershipId: string;
  name: string;
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  netMinutes: number;
  breakMinutes: number;
  targetMinutes: number;
  status: "open" | "complete" | "incomplete" | "none";
  violations: number;
  edited: boolean;
}

export function TimesTable({ rows, date, person, today }: { rows: TimeRow[]; date: string; person: { id: string; name: string } | null; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState<TimeRow | null>(null);
  const go = (d: string) => router.push(`${pathname}?datum=${d}${person ? `&person=${person.id}` : ""}`, { scroll: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!person && (
          <>
            <Button variant="ghost" size="icon" aria-label="Vorheriger Tag" onClick={() => go(shiftDays(date, -1))}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </Button>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && go(e.target.value)}
              aria-label="Datum"
              className="h-10 rounded-full border border-line bg-surface-2 px-4 text-sm text-fg"
            />
            <Button variant="ghost" size="icon" aria-label="Nächster Tag" disabled={date >= today} onClick={() => go(shiftDays(date, 1))}>
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Button>
            <span className="ml-2 text-[15px] font-semibold">{formatDayLong(date)}</span>
          </>
        )}
        {person && (
          <span className="flex items-center gap-2 text-[15px]">
            Letzte 14 Tage von <strong>{person.name}</strong>
            <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>Alle anzeigen</Button>
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Keine Einträge." description="Für diesen Tag gibt es keine Buchungen und kein Soll." />
      ) : (
        <div className="overflow-x-auto rounded-[24px] border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead className="border-b border-line text-sm text-fg-3">
              <tr>
                <th className="px-5 py-3 font-medium">{person ? "Tag" : "Person"}</th>
                <th className="px-3 py-3 font-medium">Von – bis</th>
                <th className="px-3 py-3 font-medium">Pause</th>
                <th className="px-3 py-3 text-right font-medium">Netto</th>
                <th className="px-3 py-3 text-right font-medium">Soll</th>
                <th className="px-5 py-3 font-medium"><span className="sr-only">Status</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr
                  key={r.key}
                  tabIndex={0}
                  onClick={() => setEditing(r)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setEditing(r))}
                  className="cursor-pointer transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                  aria-label={`${person ? formatDayShort(r.date) : r.name} bearbeiten`}
                >
                  <td className="px-5 py-3">
                    {person ? (
                      <span className="font-medium">{formatDayShort(r.date)}</span>
                    ) : (
                      <span className="flex items-center gap-3">
                        <Avatar name={r.name} size={32} />
                        <span className="font-medium">{r.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="tabular px-3 py-3 text-fg-2">
                    {r.firstIn ? `${formatTime(r.firstIn)} – ${r.lastOut ? formatTime(r.lastOut) : "läuft"}` : "–"}
                  </td>
                  <td className="tabular px-3 py-3 text-fg-2">{r.breakMinutes ? formatMinutesShort(r.breakMinutes) : "–"}</td>
                  <td className="tabular px-3 py-3 text-right font-semibold">{r.status === "none" ? "–" : formatHours(r.netMinutes)}</td>
                  <td className="tabular px-3 py-3 text-right text-fg-2">{r.targetMinutes ? formatHours(r.targetMinutes) : "–"}</td>
                  <td className="px-5 py-3">
                    <span className="flex justify-end gap-1.5">
                      {r.edited && <Badge>korrigiert</Badge>}
                      {r.status === "open" && <Badge tone="ok">läuft</Badge>}
                      {r.status === "incomplete" && <Badge tone="alert">offen</Badge>}
                      {r.status === "none" && r.targetMinutes > 0 && <Badge tone="pause">fehlt</Badge>}
                      {r.violations > 0 && (
                        <Badge tone="alert">
                          <ShieldAlert className="mr-1 h-3 w-3" aria-hidden />
                          {r.violations}
                        </Badge>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <DayEditor
          key={editing.key}
          membershipId={editing.membershipId}
          name={editing.name}
          date={editing.date}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
    </div>
  );
}
