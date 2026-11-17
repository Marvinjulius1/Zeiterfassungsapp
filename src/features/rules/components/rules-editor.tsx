"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, RotateCcw } from "lucide-react";
import { diffRules, STAMP_METHODS, type Enforcement, type RuleSettings, type StampMethod } from "@/compliance";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Segmented } from "@/design-system/components/segmented";
import { Stepper } from "@/design-system/components/stepper";
import { toast } from "@/design-system/components/toaster";
import { Toggle } from "@/design-system/components/toggle";
import { spring } from "@/design-system/motion";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { saveRules } from "../actions";

type Section = keyof RuleSettings;

const METHOD_LABEL: Record<StampMethod, string> = {
  app: "App",
  terminal_qr: "QR am Terminal",
  personal_qr: "Eigener QR-Code",
  pin: "PIN am Terminal",
  rfid: "RFID-Chip",
  nfc: "NFC (Android)",
};

export interface RulesEditorProps {
  scope: "org" | "location";
  scopeId: string;
  scopeLabel: string;
  /** Regeln der übergeordneten Ebene (Standard bzw. Firma) */
  parent: RuleSettings;
  /** aktuell wirksame Regeln dieser Ebene */
  initial: RuleSettings;
  canEdit: boolean;
}

export function RulesEditor({ scope, scopeId, scopeLabel, parent, initial, canEdit }: RulesEditorProps) {
  const [rules, setRules] = useState<RuleSettings>(initial);
  const [saved, setSaved] = useState<RuleSettings>(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);
  const ownDiff = useMemo(() => diffRules(parent, rules), [parent, rules]);
  const isLocation = scope === "location";

  function set<S extends Section>(section: S, value: RuleSettings[S] extends object ? Partial<RuleSettings[S]> : RuleSettings[S]) {
    if (!canEdit) return;
    setRules((r) => ({
      ...r,
      [section]: typeof r[section] === "object" && !Array.isArray(r[section]) ? { ...(r[section] as object), ...(value as object) } : value,
    }));
  }

  /** Markierung „eigene Regel" auf Standort-Ebene */
  const own = (section: Section, key?: string) => {
    if (!isLocation) return false;
    const d = (ownDiff as Record<string, unknown>)[section];
    if (d === undefined) return false;
    return key ? typeof d === "object" && d !== null && key in d : true;
  };

  function resetSection(section: Section) {
    setRules((r) => ({ ...r, [section]: parent[section] }));
    haptic("tick");
  }

  function save() {
    start(async () => {
      const res = await saveRules({ scope, scopeId, override: diffRules(parent, rules) });
      if (!res.ok) {
        haptic("error");
        toast.error(res.error);
        return;
      }
      haptic("success");
      setSaved(rules);
      toast.success("Regeln gespeichert", { description: "Gilt ab sofort für neue Buchungen. Vergangene Tage werden nachts neu bewertet." });
    });
  }

  const sectionProps = (section: Section) => ({
    showReset: isLocation && own(section) && canEdit,
    onReset: () => resetSection(section),
  });

  return (
    <div className={cn("space-y-5 pb-28", !canEdit && "[&_button]:pointer-events-none")}>
      {!canEdit && (
        <p className="flex items-center gap-2 rounded-[18px] bg-surface-2 px-4 py-3 text-sm text-fg-2">
          <Info className="h-4 w-4 shrink-0" aria-hidden /> Nur Owner und Admins können Regeln ändern. Du siehst die wirksamen Werte.
        </p>
      )}

      <RuleSection title="Einchecken & Auschecken" {...sectionProps("checkIn")}>
        <Sentence own={own("checkIn", "earliestBeforeShiftMin")}>
          Mitarbeiter dürfen sich frühestens{" "}
          <Stepper label="Minuten vor Schichtbeginn" value={rules.checkIn.earliestBeforeShiftMin} step={5} max={240} onChange={(v) => set("checkIn", { earliestBeforeShiftMin: v })} />{" "}
          Minuten vor Schichtbeginn einchecken.
        </Sentence>
        <EnforcementRow label="Bei zu frühem Einchecken" value={rules.checkIn.earliestEnforcement} onChange={(v) => set("checkIn", { earliestEnforcement: v })} own={own("checkIn", "earliestEnforcement")} />
        <Divider />
        <Sentence own={own("checkIn", "lateToleranceMin")}>
          Als verspätet gilt, wer mehr als{" "}
          <Stepper label="Minuten Toleranz" value={rules.checkIn.lateToleranceMin} max={120} onChange={(v) => set("checkIn", { lateToleranceMin: v })} />{" "}
          Minuten nach Schichtbeginn eincheckt.
        </Sentence>
        <ToggleRow label="Teamleitung bei Verspätung benachrichtigen" checked={rules.checkIn.notifyLeadOnLate} onChange={(v) => set("checkIn", { notifyLeadOnLate: v })} own={own("checkIn", "notifyLeadOnLate")} />
        <Divider />
        <Sentence own={own("checkOut")}>
          Hinweis, wenn jemand später als{" "}
          <Stepper label="Minuten nach Schichtende" value={rules.checkOut.latestAfterShiftMin} step={15} max={480} onChange={(v) => set("checkOut", { latestAfterShiftMin: v })} />{" "}
          Minuten nach Schichtende auscheckt.
        </Sentence>
        <ToggleRow label="Hinweis aktiv" checked={rules.checkOut.latestEnforcement === "warn"} onChange={(v) => set("checkOut", { latestEnforcement: v ? "warn" : "off" })} own={own("checkOut", "latestEnforcement")} />
      </RuleSection>

      <RuleSection title="Automatisch auschecken" description="Für vergessene Check-outs. Die Person wird benachrichtigt und kann korrigieren." {...sectionProps("autoCheckout")}>
        <ToggleRow label="Automatisch auschecken" checked={rules.autoCheckout.enabled} onChange={(v) => set("autoCheckout", { enabled: v })} own={own("autoCheckout", "enabled")} />
        <Collapse open={rules.autoCheckout.enabled}>
          <Sentence own={own("autoCheckout", "afterHours")}>
            Nach{" "}
            <Stepper label="Stunden" value={rules.autoCheckout.afterHours} min={4} max={16} onChange={(v) => set("autoCheckout", { afterHours: v })} />{" "}
            Stunden ohne Check-out wird automatisch ausgecheckt.
          </Sentence>
          <ToggleRow label="Spätestens um Mitternacht" checked={rules.autoCheckout.atMidnight} onChange={(v) => set("autoCheckout", { atMidnight: v })} own={own("autoCheckout", "atMidnight")} />
        </Collapse>
      </RuleSection>

      <RuleSection
        title="Bewertung der Arbeitszeit"
        description="Rohzeiten bleiben immer unverändert gespeichert. Rundung und Pausenabzug wirken nur auf Stundenkonto und Lohn."
        {...sectionProps("rounding")}
      >
        <Row label="Rundung" own={own("rounding", "mode")}>
          <Segmented
            label="Rundung"
            value={rules.rounding.mode}
            onChange={(v) => set("rounding", { mode: v })}
            options={[
              { value: "none", label: "Aus" },
              { value: "employee_favor", label: "Zugunsten MA" },
              { value: "commercial", label: "Kaufmännisch" },
            ]}
          />
        </Row>
        <Collapse open={rules.rounding.mode !== "none"}>
          <Row label="Auf" own={own("rounding", "unitMin")}>
            <Segmented
              label="Rundungseinheit"
              value={String(rules.rounding.unitMin) as "5" | "10" | "15"}
              onChange={(v) => set("rounding", { unitMin: Number(v) as 5 | 10 | 15 })}
              options={[
                { value: "5", label: "5 Min." },
                { value: "10", label: "10 Min." },
                { value: "15", label: "15 Min." },
              ]}
            />
          </Row>
          {rules.rounding.mode === "commercial" && (
            <Note>Kaufmännische Rundung kann im Einzelfall zulasten der Mitarbeiter gehen. Rechtlich sicherer ist „Zugunsten MA“.</Note>
          )}
        </Collapse>
        <Divider />
        <ToggleRow
          label="Fehlende Pause automatisch abziehen"
          hint="Wenn keine ausreichende Pause gebucht wurde (§ 4 ArbZG) – mit Hinweis an die Person."
          checked={rules.autoBreak.enabled}
          onChange={(v) => set("autoBreak", { enabled: v })}
          own={own("autoBreak")}
        />
      </RuleSection>

      <RuleSection title="Erfassungswege" description="Wie darf an diesem Standort gestempelt werden?" {...sectionProps("methods")}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Erlaubte Erfassungswege">
          {STAMP_METHODS.map((m) => {
            const on = rules.methods.allowed.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = on ? rules.methods.allowed.filter((x) => x !== m) : [...rules.methods.allowed, m];
                  if (next.length === 0) {
                    toast("Mindestens ein Erfassungsweg muss erlaubt bleiben.");
                    return;
                  }
                  haptic("tick");
                  set("methods", { allowed: next });
                }}
                className={cn(
                  "h-10 rounded-full px-4 text-sm font-semibold transition-[background-color,color,transform] active:scale-95",
                  on ? "bg-inverse text-inverse-fg" : "bg-surface-2 text-fg-2 hover:text-fg",
                )}
              >
                {METHOD_LABEL[m]}
              </button>
            );
          })}
        </div>
        <ToggleRow
          label="Einchecken per App nur am Arbeitsort (Geofence)"
          hint="Standort wird nur im Moment des Stempelns geprüft – nie getrackt – und nur mit Einwilligung."
          checked={rules.methods.requireGeofence}
          onChange={(v) => set("methods", { requireGeofence: v })}
          own={own("methods", "requireGeofence")}
        />
      </RuleSection>

      <RuleSection title="Korrekturen & Überstunden" {...sectionProps("overtime")}>
        <Row label="Zeitkorrekturen von Mitarbeitern" own={own("corrections")}>
          <Segmented
            label="Korrekturen"
            value={rules.corrections.mode}
            onChange={(v) => set("corrections", { mode: v })}
            options={[
              { value: "approval", label: "Mit Freigabe" },
              { value: "self", label: "Selbst" },
            ]}
          />
        </Row>
        {rules.corrections.mode === "self" && <Note>Auch Selbstkorrekturen werden lückenlos im Audit-Log protokolliert.</Note>}
        <Divider />
        <Sentence own={own("overtime", "approvalAboveMin")}>
          Mehrarbeit über{" "}
          <Stepper label="Minuten pro Tag" value={rules.overtime.approvalAboveMin} step={15} max={600} onChange={(v) => set("overtime", { approvalAboveMin: v })} />{" "}
          Minuten am Tag braucht eine Freigabe {rules.overtime.approvalAboveMin === 0 && <span className="text-fg-3">(0 = aus)</span>}.
        </Sentence>
        <Sentence own={own("overtime", "balanceCapMin")}>
          Das Stundenkonto wird bei{" "}
          <Stepper label="Stunden Kappungsgrenze" value={rules.overtime.balanceCapMin / 60} step={5} max={500} onChange={(v) => set("overtime", { balanceCapMin: v * 60 })} />{" "}
          Stunden gekappt {rules.overtime.balanceCapMin === 0 && <span className="text-fg-3">(0 = keine Kappung)</span>}.
        </Sentence>
      </RuleSection>

      <RuleSection title="Zuschläge" description="Werden im Lohnexport ausgewiesen (Phase 8)." {...sectionProps("surcharges")}>
        <Sentence own={own("surcharges", "nightPct")}>
          Nachtarbeit von{" "}
          <Stepper label="Nacht ab Uhr" value={rules.surcharges.nightFromHour} min={18} max={24} onChange={(v) => set("surcharges", { nightFromHour: v })} /> bis{" "}
          <Stepper label="Nacht bis Uhr" value={rules.surcharges.nightToHour} min={0} max={8} onChange={(v) => set("surcharges", { nightToHour: v })} /> Uhr:{" "}
          <Stepper label="Prozent Nachtzuschlag" value={rules.surcharges.nightPct} step={5} max={100} onChange={(v) => set("surcharges", { nightPct: v })} /> %
        </Sentence>
        <Sentence own={own("surcharges", "sundayPct")}>
          Sonntagsarbeit:{" "}
          <Stepper label="Prozent Sonntagszuschlag" value={rules.surcharges.sundayPct} step={5} max={100} onChange={(v) => set("surcharges", { sundayPct: v })} /> %
        </Sentence>
        <Sentence own={own("surcharges", "holidayPct")}>
          Feiertagsarbeit:{" "}
          <Stepper label="Prozent Feiertagszuschlag" value={rules.surcharges.holidayPct} step={5} max={200} onChange={(v) => set("surcharges", { holidayPct: v })} /> %
        </Sentence>
      </RuleSection>

      <RuleSection
        title="Arbeitsschutz"
        description="Das Arbeitszeitgesetz gilt immer. Hier legst du fest, ob die App nur warnt oder das Einchecken verhindert."
        {...sectionProps("enforcement")}
      >
        <EnforcementRow
          label="Ruhezeit unter 11 h (§ 5 ArbZG)"
          hint="Für Jugendliche (12 h) wird immer blockiert."
          value={rules.enforcement.restPeriod}
          onChange={(v) => set("enforcement", { restPeriod: v })}
          own={own("enforcement", "restPeriod")}
          allowOff={false}
        />
        <EnforcementRow
          label="Tageshöchstgrenze erreicht (§ 3 ArbZG)"
          value={rules.enforcement.dailyMax}
          onChange={(v) => set("enforcement", { dailyMax: v })}
          own={own("enforcement", "dailyMax")}
          allowOff={false}
        />
        <EnforcementRow
          label="Nachtruhe Jugendliche 20–6 Uhr (§ 14 JArbSchG)"
          hint="Ausnahmen gelten z. B. in Gastronomie und Bäckereien."
          value={rules.enforcement.minorsNightRest}
          onChange={(v) => set("enforcement", { minorsNightRest: v })}
          own={own("enforcement", "minorsNightRest")}
          allowOff={false}
        />
        <Divider />
        <ToggleRow
          label="Vertrauensarbeitszeit"
          hint="Zeiten werden erfasst (Pflicht), aber Beginn und Ende werden nicht kontrolliert."
          checked={rules.trustBasedHours}
          onChange={(v) => set("trustBasedHours", v)}
          own={own("trustBasedHours")}
        />
        <ToggleRow
          label="Aufzeichnungsfrist (§ 17 MiLoG) für alle prüfen"
          hint="Standard: nur Minijobs. Gilt in bestimmten Branchen für alle Beschäftigten."
          checked={rules.milogAllEmployees}
          onChange={(v) => set("milogAllEmployees", v)}
          own={own("milogAllEmployees")}
        />
      </RuleSection>

      <p className="px-1 text-sm text-fg-3">
        Hinweis: Gibt es einen Betriebsrat, sind Regeln zur Arbeitszeit und technische Zeiterfassung nach § 87 Abs. 1 Nr. 2 und 6 BetrVG mitbestimmungspflichtig.
      </p>

      <AnimatePresence>
        {dirty && canEdit && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={spring.gentle}
            className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-[min(560px,calc(100%-32px))] items-center justify-between gap-3 rounded-full border border-line bg-surface-2 py-2 shadow-[0_12px_40px_rgb(0_0_0/0.35)] pl-5 pr-2 lg:ml-[calc(50%+130px-280px)]"
          >
            <span className="text-sm font-medium">Ungespeicherte Änderungen · {scopeLabel}</span>
            <span className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRules(saved)}>
                Verwerfen
              </Button>
              <Button size="sm" loading={pending} onClick={save}>
                Speichern
              </Button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------
function RuleSection({
  title,
  description,
  children,
  showReset,
  onReset,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  showReset?: boolean;
  onReset?: () => void;
}) {
  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-fg-2">{description}</p>}
        </div>
        {showReset && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Firmenregel
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
}

function OwnBadge({ own }: { own?: boolean }) {
  return own ? <Badge className="ml-2 align-middle">eigene Regel</Badge> : null;
}

function Sentence({ children, own }: { children: React.ReactNode; own?: boolean }) {
  return (
    <p className="text-[16px] leading-[2.6] text-fg">
      {children}
      <OwnBadge own={own} />
    </p>
  );
}

function Row({ label, children, own, hint }: { label: string; children: React.ReactNode; own?: boolean; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">
          {label}
          <OwnBadge own={own} />
        </p>
        {hint && <p className="mt-0.5 text-sm text-fg-2">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, own }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; own?: boolean }) {
  return (
    <Row label={label} hint={hint} own={own}>
      <Toggle checked={checked} onCheckedChange={onChange} label={label} />
    </Row>
  );
}

function EnforcementRow({
  label,
  hint,
  value,
  onChange,
  own,
  allowOff = true,
}: {
  label: string;
  hint?: string;
  value: Enforcement;
  onChange: (v: Enforcement) => void;
  own?: boolean;
  allowOff?: boolean;
}) {
  const options = [
    ...(allowOff ? [{ value: "off" as const, label: "Aus" }] : []),
    { value: "warn" as const, label: "Warnen" },
    { value: "block" as const, label: "Blockieren" },
  ];
  return (
    <Row label={label} hint={hint} own={own}>
      <Segmented label={label} value={value} onChange={onChange} options={options} />
    </Row>
  );
}

function Divider() {
  return <hr className="border-0 border-t border-line" />;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[16px] bg-pause-soft px-4 py-3 text-sm text-fg">{children}</p>;
}

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={spring.gentle}
          className="space-y-5 overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
