import type { Metadata } from "next";
import { Suspense } from "react";
import { Lock, MapPinOff, Server, UserX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";
import { OrgSettingsForm } from "@/features/admin/components/org-settings-form";
import { isOrgAdmin } from "@/lib/auth/roles";
import { requireAdminArea } from "@/lib/auth/session";
import type { GermanState } from "@/lib/germany";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Einstellungen" };

const PRIVACY = [
  { icon: Server, title: "Hosting in Frankfurt", text: "Alle Daten liegen in der EU (Supabase, Region eu-central-1)." },
  { icon: MapPinOff, title: "Kein Tracking", text: "Der Standort wird – nur mit Einwilligung – ausschließlich im Moment des Stempelns geprüft." },
  { icon: Lock, title: "Datenminimierung", text: "Geburtsdatum nur für Jugendschutz, Löhne nur für Admins sichtbar, Stempel-Geheimnisse für niemanden lesbar." },
  { icon: UserX, title: "Auskunft & Löschung", text: "Mitarbeitende können ihre Daten exportieren. Löschung erfolgt nach Ablauf der Aufbewahrungsfrist." },
];

async function Content() {
  const viewer = await requireAdminArea();
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, default_state, retention_months, has_works_council")
    .eq("id", viewer.active.orgId)
    .single();
  if (!org) return null;
  return (
    <>
      <OrgSettingsForm
        initial={{ name: org.name, defaultState: org.default_state as GermanState, retentionMonths: org.retention_months, hasWorksCouncil: org.has_works_council }}
        canEdit={isOrgAdmin(viewer.active.role)}
      />
      <Card>
        <CardHeader title="Datenschutz (DSGVO)" />
        <ul className="grid gap-4 sm:grid-cols-2">
          {PRIVACY.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-fg-2" aria-hidden />
              <div>
                <p className="text-[15px] font-medium">{title}</p>
                <p className="mt-0.5 text-sm text-fg-2">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Einstellungen" />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[24px]" />}>
        <Content />
      </Suspense>
    </div>
  );
}
