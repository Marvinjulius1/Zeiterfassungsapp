"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coffee, LogIn, LogOut, Plus } from "lucide-react";
import { Logo } from "@/components/logo";
import {
  Avatar, Badge, BigNumber, Button, Card, CardHeader, Divider, EmptyState, HoldButton, Input,
  ListGroup, ListRow, ProgressRing, Segmented, Sheet, Skeleton, SkeletonText, Slider, StatusPill,
  Stepper, ThemeToggle, Toggle, WeekChart, toast, type WorkStatus,
} from "@/design-system/components";
import { formatClock, formatHours } from "@/lib/time/format";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <h2 id={id} className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-fg-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

const swatches = [
  ["bg", "--zg-bg"], ["surface", "--zg-surface"], ["surface-2", "--zg-surface-2"], ["surface-3", "--zg-surface-3"],
  ["fg", "--zg-fg"], ["fg-2", "--zg-fg-2"], ["fg-3", "--zg-fg-3"],
  ["ok", "--zg-ok"], ["pause", "--zg-pause"], ["alert", "--zg-alert"],
] as const;

const week = [
  { label: "Mo", minutes: 482, targetMinutes: 480 },
  { label: "Di", minutes: 455, targetMinutes: 480 },
  { label: "Mi", minutes: 531, targetMinutes: 480 },
  { label: "Do", minutes: 470, targetMinutes: 480 },
  { label: "Fr", minutes: 402, targetMinutes: 480, isToday: true },
  { label: "Sa", minutes: 0, targetMinutes: 0 },
  { label: "So", minutes: 0, targetMinutes: 0 },
];

export function Showcase() {
  const [seconds, setSeconds] = useState(6 * 3600 + 42 * 60 + 18);
  const [ring, setRing] = useState(84);
  const [toggle, setToggle] = useState(true);
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const [earliest, setEarliest] = useState(15);
  const [rounding, setRounding] = useState(5);
  const [status, setStatus] = useState<WorkStatus>("checked_in");
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--zg-bg)_85%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="Startseite">
            <Logo size={20} />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl space-y-16 px-5 py-12">
        <div>
          <h1 className="text-[44px] font-semibold tracking-[-0.04em]">Design-System</h1>
          <p className="mt-2 max-w-xl text-lg text-fg-2">
            Schwarz, Weiß, Graustufen. Farbe nur für Status. Alle Komponenten respektieren „Bewegung reduzieren“.
          </p>
        </div>

        <Section id="farben" title="Farben">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {swatches.map(([name, v]) => (
              <div key={name} className="overflow-hidden rounded-[20px] border border-line">
                <div className="h-16" style={{ background: `var(${v})` }} />
                <div className="bg-surface px-3 py-2.5">
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-fg-3">{v}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="zahlen" title="BigNumber & Live-Uhr">
          <Card className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <BigNumber
              label="Heute gearbeitet"
              value={formatClock(seconds)}
              caption="Ziffern rollen wie bei einem Depotwert."
              ariaLabel="Heute gearbeitet"
            />
            <div className="flex gap-8">
              <BigNumber size="md" label="Stundenkonto" value={formatHours(754, { sign: true })} rolling={false} />
              <BigNumber size="md" label="Resturlaub" value="17" />
            </div>
          </Card>
        </Section>

        <Section id="status" title="StatusPill">
          <div className="flex flex-wrap gap-3">
            <StatusPill status="checked_in" />
            <StatusPill status="on_break" label="Pause · 12 Min." />
            <StatusPill status="checked_out" />
            <StatusPill status="absent" label="Urlaub" />
            <StatusPill status="alert" label="Ruhezeit unterschritten" />
          </div>
        </Section>

        <Section id="ring" title="ProgressRing & Hold-to-check-in">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="flex flex-col items-center gap-6">
              <ProgressRing value={ring / 100} tone="ok" label="Tagesfortschritt">
                <span className="tabular text-[40px] font-semibold tracking-[-0.03em]">{ring}%</span>
                <span className="text-sm text-fg-2">von 8:00 h</span>
              </ProgressRing>
              <Slider label="Fortschritt" value={ring} onValueChange={setRing} max={130} />
              <p className="text-sm text-fg-3">Über 100 % zeigt eine zweite Runde für Mehrarbeit.</p>
            </Card>
            <Card className="flex flex-col items-center justify-center gap-6">
              <StatusPill status={status} />
              {status === "checked_out" ? (
                <HoldButton
                  label="Einchecken"
                  icon={<LogIn className="h-7 w-7" aria-hidden />}
                  onComplete={() => {
                    setStatus("checked_in");
                    toast.success("Eingecheckt um " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
                  }}
                />
              ) : (
                <HoldButton
                  label="Auschecken"
                  tone="alert"
                  icon={<LogOut className="h-7 w-7" aria-hidden />}
                  onComplete={() => {
                    setStatus("checked_out");
                    toast("Feierabend! 7:52 h gearbeitet, Pausen eingehalten ✓");
                  }}
                />
              )}
            </Card>
          </div>
        </Section>

        <Section id="buttons" title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primär</Button>
            <Button variant="secondary">Sekundär</Button>
            <Button variant="outline">Kontur</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Ablehnen</Button>
            <Button loading>Lädt</Button>
            <Button size="icon" variant="secondary" aria-label="Hinzufügen">
              <Plus className="h-5 w-5" aria-hidden />
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button size="lg">
              <Coffee className="h-5 w-5" aria-hidden /> Pause starten
            </Button>
            <Button size="xl" variant="secondary">
              Groß
            </Button>
          </div>
        </Section>

        <Section id="regeln" title="Regeln in Klartext (Stepper, Toggle, Segmented)">
          <Card className="space-y-6">
            <p className="text-[17px] leading-[2.4] text-fg">
              Mitarbeiter dürfen sich frühestens{" "}
              <Stepper label="Minuten vor Schichtbeginn" value={earliest} onChange={setEarliest} step={5} max={120} /> Minuten
              vor Schichtbeginn einchecken.
            </p>
            <Divider />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[15px] font-medium">Automatischer Pausenabzug</p>
                <p className="text-sm text-fg-2">Wenn keine Pause gebucht wurde – mit Hinweis an den Mitarbeiter.</p>
              </div>
              <Toggle checked={toggle} onCheckedChange={setToggle} label="Automatischer Pausenabzug" />
            </div>
            <Divider />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-[15px] font-medium">Runden auf</p>
              <Segmented
                label="Rundung"
                value={String(rounding) as "0" | "5" | "15"}
                onChange={(v) => setRounding(Number(v))}
                options={[
                  { value: "0", label: "Aus" },
                  { value: "5", label: "5 Min." },
                  { value: "15", label: "15 Min." },
                ]}
              />
            </div>
          </Card>
        </Section>

        <Section id="chart" title="Wochen-Chart">
          <Card>
            <CardHeader
              title="Diese Woche"
              subtitle="Gestrichelt = Soll"
              action={
                <Segmented
                  label="Zeitraum"
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: "day", label: "Tag" },
                    { value: "week", label: "Woche" },
                    { value: "month", label: "Monat" },
                  ]}
                />
              }
            />
            <WeekChart key={range} days={week} />
          </Card>
        </Section>

        <Section id="listen" title="Listen, Avatare, Badges">
          <Card>
            <ListGroup>
              <ListRow leading={<Avatar name="Lena Schmidt" />} title="Lena Schmidt" subtitle="Service · Köln" trailing={<StatusPill status="checked_in" label="07:52" />} />
              <ListRow leading={<Avatar name="Noah Klein" />} title="Noah Klein" subtitle="Azubi · 17 Jahre" trailing={<Badge tone="pause">JArbSchG</Badge>} />
              <ListRow leading={<Avatar name="Tim Neumann" />} title="Tim Neumann" subtitle="Minijob" trailing={<Badge tone="alert">Tag fehlt</Badge>} />
              <ListRow title="Urlaubsantrag · 12.–23. Dez." subtitle="Sara Fischer" onClick={() => setSheet(true)} chevron />
            </ListGroup>
          </Card>
        </Section>

        <Section id="sheet" title="Sheet">
          <Sheet
            open={sheet}
            onOpenChange={setSheet}
            title="Urlaubsantrag"
            description="Sara Fischer · 12.–23. Dezember · 8 Arbeitstage"
            trigger={<Button variant="secondary">Sheet öffnen</Button>}
          >
            <div className="space-y-3">
              <p className="text-fg-2">Resturlaub danach: 9 Tage. Keine Überschneidung im Team.</p>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" size="lg" block onClick={() => setSheet(false)}>
                  Ablehnen
                </Button>
                <Button size="lg" block onClick={() => { setSheet(false); toast.success("Genehmigt"); }}>
                  Genehmigen
                </Button>
              </div>
            </div>
          </Sheet>
        </Section>

        <Section id="formulare" title="Eingaben">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="E-Mail" placeholder="du@firma.de" hint="Wir schicken dir einen Code." />
            <Input label="Begründung" defaultValue="x" error="Bitte mindestens 3 Zeichen." />
          </div>
        </Section>

        <Section id="laden" title="Skeleton & Empty State">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="space-y-5">
              <Skeleton className="h-16 w-48" />
              <SkeletonText lines={3} />
            </Card>
            <Card className="p-0">
              <EmptyState
                title="Noch keine Anträge."
                description="Wenn jemand Urlaub beantragt, landet es hier."
                action={<Button variant="secondary" onClick={() => toast("Nichts zu tun – genieß den Tag.")}>Toast zeigen</Button>}
              />
            </Card>
          </div>
        </Section>
      </main>
    </div>
  );
}
