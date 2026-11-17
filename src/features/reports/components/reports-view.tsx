"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, FileText, Lock, LockOpen, Settings2 } from "lucide-react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { buttonVariants } from "@/design-system/components/button-variants";
import { Card } from "@/design-system/components/card";
import { Input } from "@/design-system/components/input";
import { Sheet } from "@/design-system/components/sheet";
import { toast } from "@/design-system/components/toaster";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { formatHours } from "@/lib/time/format";
import { lockMonths, savePayrollSettings, unlockMonth } from "../actions";
import { LOHNART_LABEL, type PayrollSettings } from "../payroll-settings";

export interface ReportRow {
  membershipId: string;
  name: string;
  employeeNo: string | null;
  valued: number;
  credit: number;
  target: number;
  diff: number;
  balanceEnd: number;
  vacationDays: number;
  sickDays: number;
  surcharges: number;
  incompleteDays: number;
  pendingCorrections: number;
  status: "open" | "confirmed" | "locked";
  /** von der Person bestätigt (bleibt nach dem Entsperren erhalten) */
  confirmed: boolean;
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export function ReportsView({
  month,
  isPast,
  rows: serverRows,
  canAdmin,
  payroll,
  locationQuery,
}: {
  month: string; // yyyy-MM-01
  isPast: boolean;
  rows: ReportRow[];
  canAdmin: boolean;
  payroll: PayrollSettings;
  locationQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  // Sofortige Rückmeldung, bis die Neuberechnung vom Server da ist
  const [override, setOverride] = useState<Record<string, ReportRow["status"]>>({});
  const [seen, setSeen] = useState(serverRows);
  if (seen !== serverRows) {
    setSeen(serverRows);
    setOverride({});
  }
  const rows = serverRows.map((r) => (override[r.membershipId] ? { ...r, status: override[r.membershipId] } : r));
  const applyStatus = (ids: string[], status: (r: ReportRow) => ReportRow["status"]) =>
    setOverride((o) => ({ ...o, ...Object.fromEntries(serverRows.filter((r) => ids.includes(r.membershipId)).map((r) => [r.membershipId, status(r)])) }));
  const ym = month.slice(0, 7);
  const label = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  const step = (dir: -1 | 1) => {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + dir, 1));
    router.push(`${pathname}?monat=${d.toISOString().slice(0, 7)}${locationQuery}`, { scroll: false });
  };

  const lockable = rows.filter((r) => r.status !== "locked");
  const issues = rows.reduce((s, r) => s + r.incompleteDays + r.pendingCorrections, 0);
  const confirmed = rows.filter((r) => r.status !== "open").length;
  const missingPnr = rows.filter((r) => !(r.employeeNo ?? "").replace(/\D/g, "")).map((r) => r.name);
  const exportHref = (format: string) => `/api/reports/export?format=${format}&monat=${ym}${locationQuery}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Vorheriger Monat" onClick={() => step(-1)}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Button>
          <span className="min-w-36 text-center text-[15px] font-semibold">{label}</span>
          <Button variant="ghost" size="icon" aria-label="Nächster Monat" onClick={() => step(1)}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={exportHref("csv")} download>
            <FileDown className="h-4 w-4" aria-hidden /> CSV
          </a>
          <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={exportHref("xlsx")} download>
            <FileSpreadsheet className="h-4 w-4" aria-hidden /> Excel
          </a>
          {canAdmin && (
            <>
              <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={exportHref("datev")} download>
                <FileText className="h-4 w-4" aria-hidden /> DATEV LODAS
              </a>
              <DatevSettings settings={payroll} />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Personen", String(rows.length)],
          ["Gearbeitet", formatHours(rows.reduce((s, r) => s + r.valued, 0))],
          ["Bestätigt", `${confirmed} / ${rows.length}`],
          ["Offene Punkte", String(issues)],
        ].map(([l, v]) => (
          <Card key={l} className="p-5">
            <p className="text-sm text-fg-2">{l}</p>
            <p className={cn("tabular mt-1 text-2xl font-semibold", l === "Offene Punkte" && issues > 0 && "text-pause")}>{v}</p>
          </Card>
        ))}
      </div>

      {canAdmin && missingPnr.length > 0 && (
        <p className="flex items-start gap-2 rounded-[18px] bg-pause-soft px-4 py-3 text-sm" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pause" aria-hidden />
          Für den DATEV-Export fehlt eine numerische Personalnummer bei: {missingPnr.join(", ")}. Diese Personen werden übersprungen.
        </p>
      )}

      <div className="overflow-x-auto rounded-[24px] border border-line bg-surface">
        <table className="w-full min-w-[960px] text-left text-[15px]">
          <thead className="border-b border-line text-sm text-fg-3">
            <tr>
              {canAdmin && isPast && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Alle offenen auswählen"
                    checked={selected.size === lockable.length && lockable.length > 0}
                    disabled={lockable.length === 0}
                    onChange={() => setSelected(selected.size === lockable.length ? new Set() : new Set(lockable.map((r) => r.membershipId)))}
                    className="h-4 w-4 accent-current"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-3 py-3 text-right font-medium">Ist</th>
              <th className="px-3 py-3 text-right font-medium">Gutschrift</th>
              <th className="px-3 py-3 text-right font-medium">Soll</th>
              <th className="px-3 py-3 text-right font-medium">Saldo</th>
              <th className="px-3 py-3 text-right font-medium">Konto</th>
              <th className="px-3 py-3 text-right font-medium">Urlaub / Krank</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-4 py-3"><span className="sr-only">Aktionen</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.membershipId} className={cn(selected.has(r.membershipId) && "bg-surface-2")}>
                {canAdmin && isPast && (
                  <td className="px-4 py-3">
                    {r.status !== "locked" && (
                      <input
                        type="checkbox"
                        aria-label={`${r.name} auswählen`}
                        checked={selected.has(r.membershipId)}
                        onChange={() =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (n.has(r.membershipId)) n.delete(r.membershipId);
                            else n.add(r.membershipId);
                            return n;
                          })
                        }
                        className="h-4 w-4 accent-current"
                      />
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  <p className="font-medium">{r.name}</p>
                  {(r.incompleteDays > 0 || r.pendingCorrections > 0) && (
                    <p className="flex items-center gap-1 text-xs text-pause">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      {[r.incompleteDays && `${r.incompleteDays} Tag(e) ohne Ausstempeln`, r.pendingCorrections && `${r.pendingCorrections} offene Korrektur(en)`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </td>
                <td className="tabular px-3 py-3 text-right">{formatHours(r.valued)}</td>
                <td className="tabular px-3 py-3 text-right text-fg-2">{r.credit ? formatHours(r.credit) : "–"}</td>
                <td className="tabular px-3 py-3 text-right text-fg-2">{formatHours(r.target)}</td>
                <td className={cn("tabular px-3 py-3 text-right font-semibold", r.diff < 0 && "text-alert")}>{formatHours(r.diff, { sign: true })}</td>
                <td className="tabular px-3 py-3 text-right text-fg-2">{formatHours(r.balanceEnd, { sign: true })}</td>
                <td className="tabular px-3 py-3 text-right text-fg-2">
                  {String(r.vacationDays).replace(".", ",")} / {String(r.sickDays).replace(".", ",")}
                </td>
                <td className="px-3 py-3">
                  {r.status === "locked" ? <Badge tone="inverse">Abgeschlossen</Badge> : r.status === "confirmed" ? <Badge tone="ok">Bestätigt</Badge> : <Badge>Offen</Badge>}
                </td>
                <td className="px-4 py-3">
                  <span className="flex justify-end gap-1">
                    <a
                      className={buttonVariants({ variant: "ghost", size: "icon" })}
                      href={`/api/reports/timesheet?monat=${ym}&person=${r.membershipId}`}
                      download
                      aria-label={`Stundenzettel ${r.name} als PDF`}
                      title="Stundenzettel (PDF)"
                    >
                      <FileText className="h-4 w-4" aria-hidden />
                    </a>
                    {canAdmin && r.status === "locked" && (
                      <UnlockButton month={month} membershipId={r.membershipId} name={r.name} onDone={() => applyStatus([r.membershipId], (x) => (x.confirmed ? "confirmed" : "open"))} />
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isPast && <p className="text-sm text-fg-3">Abschließen ist möglich, sobald der Monat vorbei ist.</p>}

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-[min(620px,calc(100%-32px))] items-center justify-between gap-3 rounded-full border border-line bg-surface-2 py-2 shadow-[0_12px_40px_rgb(0_0_0/0.35)] pl-5 pr-2 lg:ml-[calc(50%+130px-310px)]"
          >
            <span className="text-sm font-medium">
              {selected.size} ausgewählt{rows.filter((r) => selected.has(r.membershipId) && r.status === "open").length > 0 && " · nicht alle haben bestätigt"}
            </span>
            <Button
              size="sm"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await lockMonths(month, [...selected]);
                  if (!res.ok) return void toast.error(res.error);
                  haptic("success");
                  applyStatus([...selected], () => "locked");
                  setSelected(new Set());
                  setCelebrate(true);
                  setTimeout(() => setCelebrate(false), 2200);
                  toast.success(`${res.data?.count ?? 0} Monatsabschlüsse gespeichert`, { description: "Änderungen sind ab jetzt nur noch für Admins mit Begründung möglich." });
                  router.refresh();
                })
              }
            >
              <Lock className="h-4 w-4" aria-hidden /> {label} abschließen
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrate && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          >
            <motion.span
              className="flex h-32 w-32 items-center justify-center rounded-full bg-ok"
              initial={{ scale: 0.3, rotate: -30 }}
              animate={{ scale: [0.3, 1.1, 1], rotate: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <Lock className="h-14 w-14 text-bg" strokeWidth={2.5} />
            </motion.span>
            {Array.from({ length: 12 }, (_, i) => (
              <motion.span
                key={i}
                className="absolute h-2 w-2 rounded-full bg-fg"
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: Math.cos((i / 12) * Math.PI * 2) * 140, y: Math.sin((i / 12) * Math.PI * 2) * 140, opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UnlockButton({ month, membershipId, name, onDone }: { month: string; membershipId: string; name: string; onDone: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Monat wieder öffnen"
      description={`${name} – nur mit Begründung, wird protokolliert.`}
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Monat für ${name} wieder öffnen`} title="Wieder öffnen">
          <LockOpen className="h-4 w-4" aria-hidden />
        </Button>
      }
    >
      <div className="space-y-4">
        <Input label="Begründung" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z. B. Krankmeldung nachträglich eingereicht" />
        <Button
          size="lg"
          block
          loading={pending}
          disabled={reason.trim().length < 3}
          onClick={() =>
            start(async () => {
              const res = await unlockMonth(month, membershipId, reason);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Monat wieder geöffnet");
              onDone();
              setOpen(false);
              router.refresh();
            })
          }
        >
          Wieder öffnen
        </Button>
      </div>
    </Sheet>
  );
}

function DatevSettings({ settings }: { settings: PayrollSettings }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(settings);
  const [pending, start] = useTransition();
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="DATEV-Einstellungen"
      description="Lohnarten bitte mit dem Steuerbüro abstimmen – die Vorgaben sind nur Platzhalter."
      trigger={
        <Button variant="ghost" size="icon" aria-label="DATEV-Einstellungen">
          <Settings2 className="h-4 w-4" aria-hidden />
        </Button>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await savePayrollSettings(v);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Gespeichert");
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="Beraternummer" inputMode="numeric" value={v.beraterNr} onChange={(e) => setV({ ...v, beraterNr: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
          <Input label="Mandantennummer" inputMode="numeric" value={v.mandantNr} onChange={(e) => setV({ ...v, mandantNr: e.target.value.replace(/\D/g, "").slice(0, 5) })} />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-fg-2">Lohnarten (0 = nicht exportieren)</legend>
          {(Object.keys(LOHNART_LABEL) as (keyof PayrollSettings["lohnarten"])[]).map((k) => (
            <label key={k} className="flex items-center justify-between gap-4 text-[15px]">
              {LOHNART_LABEL[k]}
              <input
                inputMode="numeric"
                aria-label={`Lohnart ${LOHNART_LABEL[k]}`}
                value={v.lohnarten[k]}
                onChange={(e) => setV({ ...v, lohnarten: { ...v.lohnarten, [k]: Number(e.target.value.replace(/\D/g, "").slice(0, 4) || 0) } })}
                className="tabular h-10 w-24 rounded-[12px] border border-line bg-surface-2 px-3 text-right text-fg"
              />
            </label>
          ))}
        </fieldset>
        <Button type="submit" size="lg" block loading={pending}>Speichern</Button>
      </form>
    </Sheet>
  );
}
