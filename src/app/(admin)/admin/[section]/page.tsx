import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";

/** Platzhalter für Verwaltungsbereiche späterer Phasen. */
const sections = {
  freigaben: { title: "Freigaben", phase: 5, text: "Inbox für Korrekturen, Urlaub und Schichttausch – mit 1-Klick-Genehmigung." },
  mitarbeiter: { title: "Mitarbeiter", phase: 5, text: "Anlegen, einladen per Link/QR, Verträge und digitale Personalakte." },
  zeiten: { title: "Zeiten", phase: 5, text: "Alle Buchungen einsehen und mit Begründung korrigieren – lückenlos protokolliert." },
  schichtplan: { title: "Schichtplan", phase: 7, text: "Drag-and-drop-Wochenplaner mit Konfliktprüfung." },
  abwesenheiten: { title: "Abwesenheiten", phase: 7, text: "Teamkalender mit Feiertagen je Bundesland." },
  berichte: { title: "Berichte & Export", phase: 8, text: "PDF, CSV/Excel und DATEV-Lohnexport." },
  standorte: { title: "Standorte & Terminals", phase: 6, text: "Standorte, Geofence und Terminal-Kopplung." },
  audit: { title: "Audit-Log", phase: 5, text: "Wer hat wann was geändert – manipulationssicher per Hash-Kette." },
  einstellungen: { title: "Einstellungen", phase: 5, text: "Firma, Aufbewahrungsfristen, DSGVO und Betriebsrat-Hinweis." },
} as const;

type Section = keyof typeof sections;

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

export async function generateMetadata({ params }: PageProps<"/admin/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: sections[section as Section]?.title ?? "Verwaltung" };
}

export default async function AdminPlaceholder({ params }: PageProps<"/admin/[section]">) {
  const { section } = await params;
  const s = sections[section as Section];
  if (!s) notFound();
  return (
    <div className="space-y-8">
      <PageHeader title={s.title} />
      <Card className="p-0">
        <EmptyState title={`Kommt in Phase ${s.phase}.`} description={s.text} />
      </Card>
    </div>
  );
}
