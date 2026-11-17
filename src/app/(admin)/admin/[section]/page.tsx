import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";

/** Platzhalter für Verwaltungsbereiche späterer Phasen. */
const sections = {
  berichte: { title: "Berichte & Export", phase: 8, text: "PDF, CSV/Excel und DATEV-Lohnexport." },
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
