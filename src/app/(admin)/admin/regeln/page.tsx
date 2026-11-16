import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { DEFAULT_RULES, resolveRules } from "@/compliance";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { RulesEditor } from "@/features/rules/components/rules-editor";
import { isOrgAdmin } from "@/lib/auth/roles";
import { requireAdminArea } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Regeln" };

async function Rules({ searchParams }: { searchParams: PageProps<"/admin/regeln">["searchParams"] }) {
  const viewer = await requireAdminArea();
  const sp = await searchParams;
  const supabase = await createClient();
  const orgId = viewer.active.orgId;

  const [{ data: locations }, { data: sets }] = await Promise.all([
    supabase.from("locations").select("id, name").eq("org_id", orgId).is("archived_at", null).order("name"),
    supabase.from("rule_sets").select("scope, scope_id, settings").eq("org_id", orgId),
  ]);
  const settingsFor = (scope: string, id: string) => sets?.find((s) => s.scope === scope && s.scope_id === id)?.settings ?? {};

  const location = locations?.find((l) => l.id === sp.standort);
  const orgRules = resolveRules(settingsFor("org", orgId));
  const parent = location ? orgRules : DEFAULT_RULES;
  const initial = location ? resolveRules(settingsFor("org", orgId), settingsFor("location", location.id)) : orgRules;

  const tabs = [{ id: null, name: "Ganze Firma" }, ...(locations ?? []).map((l) => ({ id: l.id, name: l.name }))];

  return (
    <>
      <nav aria-label="Geltungsbereich" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => {
          const active = (t.id ?? null) === (location?.id ?? null);
          return (
            <Link
              key={t.id ?? "org"}
              href={t.id ? `/admin/regeln?standort=${t.id}` : "/admin/regeln"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                active ? "bg-inverse text-inverse-fg" : "bg-surface-2 text-fg-2 hover:text-fg",
              )}
            >
              {t.name}
            </Link>
          );
        })}
      </nav>
      <p className="text-sm text-fg-2">
        {location
          ? `Regeln für ${location.name}. Alles, was du hier nicht änderst, folgt automatisch den Firmenregeln.`
          : "Gilt für alle Standorte, sofern ein Standort nichts Eigenes festlegt."}
      </p>
      <RulesEditor
        key={location?.id ?? "org"}
        scope={location ? "location" : "org"}
        scopeId={location?.id ?? orgId}
        scopeLabel={location?.name ?? "Ganze Firma"}
        parent={parent}
        initial={initial}
        canEdit={isOrgAdmin(viewer.active.role)}
      />
    </>
  );
}

export default function RulesPage(props: PageProps<"/admin/regeln">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Regeln" description="Wie streng soll Zeitgeist sein? Alles in Klartext – und jederzeit änderbar." />
      <Suspense
        fallback={
          <div className="space-y-5" aria-busy aria-label="Wird geladen">
            <Skeleton className="h-10 w-72 rounded-full" />
            <Skeleton className="h-64 w-full rounded-[24px]" />
            <Skeleton className="h-48 w-full rounded-[24px]" />
          </div>
        }
      >
        <Rules searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
