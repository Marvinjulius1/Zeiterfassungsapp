import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { PageHeader } from "@/components/page-header";

/** Platzhalter für Tabs, die in späteren Phasen gebaut werden. */
const tabs = {
  zeiten: { title: "Meine Zeiten", text: "Tag-, Wochen- und Monatsansicht mit Stundenkonto kommen in Phase 3.", phase: 3 },
  plan: { title: "Schichtplan", text: "Deine Schichten, Schichtbörse und Tausch kommen in Phase 7.", phase: 7 },
  antraege: { title: "Anträge", text: "Urlaub, Krankmeldung und Korrekturen kommen in Phase 3 und 7.", phase: 7 },
} as const;

type Tab = keyof typeof tabs;

export function generateStaticParams() {
  return Object.keys(tabs).map((tab) => ({ tab }));
}

export async function generateMetadata({ params }: PageProps<"/app/[tab]">): Promise<Metadata> {
  const { tab } = await params;
  return { title: tabs[tab as Tab]?.title ?? "Zeitgeist" };
}

export default async function PlaceholderTab({ params }: PageProps<"/app/[tab]">) {
  const { tab } = await params;
  const t = tabs[tab as Tab];
  if (!t) notFound();
  return (
    <div className="space-y-8">
      <PageHeader title={t.title} />
      <Card className="p-0">
        <EmptyState title="Noch ein bisschen Geduld." description={t.text} />
      </Card>
    </div>
  );
}
