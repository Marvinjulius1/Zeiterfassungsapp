import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/design-system/components/badge";
import { buttonVariants } from "@/design-system/components/button-variants";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/skeleton";
import { describeChange } from "@/features/admin/members";
import { isOrgAdmin } from "@/lib/auth/roles";
import { requireAdminArea } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time/berlin";

export const metadata: Metadata = { title: "Audit-Log" };

const PAGE = 50;
const FILTERS = [
  { id: "alle", label: "Alle", entities: null },
  { id: "zeiten", label: "Zeiten", entities: ["time_events"] },
  { id: "antraege", label: "Anträge", entities: ["correction_requests", "absences"] },
  { id: "personal", label: "Personal", entities: ["memberships", "employment_contracts", "compensations", "invitations", "documents"] },
  { id: "regeln", label: "Regeln & Firma", entities: ["rule_sets", "organizations", "locations", "teams", "terminals"] },
] as const;

const ENTITY: Record<string, string> = {
  time_events: "Buchung", memberships: "Mitarbeiter", employment_contracts: "Vertrag", compensations: "Vergütung",
  rule_sets: "Regeln", correction_requests: "Korrekturantrag", absences: "Abwesenheit", documents: "Dokument",
  organizations: "Firma", invitations: "Einladung", locations: "Standort", teams: "Team", terminals: "Terminal",
  vacation_entitlements: "Urlaubsanspruch", absence_types: "Abwesenheitsart", shifts: "Schicht", month_closings: "Monatsabschluss",
  geo_consents: "Standort-Einwilligung", projects: "Projekt", time_account_adjustments: "Stundenkonto", shift_swap_requests: "Schichttausch",
  shift_claims: "Schichtbörse", data_requests: "DSGVO-Anfrage",
};
const ACTION: Record<string, { label: string; tone: "neutral" | "ok" | "pause" | "alert" }> = {
  insert: { label: "angelegt", tone: "ok" },
  update: { label: "geändert", tone: "neutral" },
  delete: { label: "gelöscht", tone: "alert" },
  void: { label: "ungültig", tone: "pause" },
};
const KIND: Record<string, string> = { check_in: "Eingecheckt", break_start: "Pause ab", break_end: "Pause bis", check_out: "Ausgecheckt" };

function summary(entity: string, action: string, oldV: unknown, newV: unknown, names: Map<string, string>): string {
  const n = (newV ?? {}) as Record<string, unknown>;
  const o = (oldV ?? {}) as Record<string, unknown>;
  const who = names.get(String(n.membership_id ?? o.membership_id ?? "")) ?? "";
  if (entity === "time_events") {
    if (action === "insert") return `${who}: ${KIND[String(n.kind)] ?? n.kind} ${formatTime(String(n.occurred_at))} (${n.work_date})`;
    if (action === "void") return `${who}: Buchung ungültig markiert`;
  }
  const base = action === "insert" ? (n.display_name ? String(n.display_name) : "") : describeChange(oldV, newV);
  return [who, base].filter(Boolean).join(": ") || "–";
}

async function Chain({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data: broken, error } = await supabase.rpc("verify_audit_chain", { p_org: orgId });
  const ok = !error && broken === null;
  return (
    <Card className={cn("flex items-center gap-4", ok ? "bg-ok-soft" : "bg-alert-soft")}>
      {ok ? <ShieldCheck className="h-7 w-7 shrink-0 text-ok" aria-hidden /> : <ShieldX className="h-7 w-7 shrink-0 text-alert" aria-hidden />}
      <div>
        <p className="text-[15px] font-semibold">{ok ? "Lückenlos und unverändert" : "Achtung: Kette unterbrochen"}</p>
        <p className="text-sm text-fg-2">
          {ok
            ? "Jeder Eintrag ist per SHA-256 mit dem vorherigen verkettet. Nachträgliche Änderungen würden sofort auffallen."
            : `Eintrag #${broken} passt nicht zur Kette. Bitte den Support kontaktieren.`}
        </p>
      </div>
    </Card>
  );
}

async function Log({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  const viewer = await requireAdminArea();
  if (!isOrgAdmin(viewer.active.role)) {
    return <EmptyState title="Nur für Admins" description="Das Audit-Log können Owner und Admins einsehen." />;
  }
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.id === sp.filter) ?? FILTERS[0];
  const page = Math.max(0, Number(sp.seite ?? 0) || 0);
  const orgId = viewer.active.orgId;
  const supabase = await createClient();

  let q = supabase
    .from("audit_log")
    .select("id, created_at, actor_id, actor_kind, entity, entity_id, action, old_value, new_value, reason")
    .eq("org_id", orgId)
    .order("id", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE);
  if (filter.entities) q = q.in("entity", [...filter.entities]);
  const [{ data: rows }, { data: members }] = await Promise.all([
    q,
    supabase.from("memberships").select("id, user_id, display_name").eq("org_id", orgId),
  ]);
  const byUser = new Map((members ?? []).filter((m) => m.user_id).map((m) => [m.user_id!, m.display_name]));
  const byMember = new Map((members ?? []).map((m) => [m.id, m.display_name]));
  const list = (rows ?? []).slice(0, PAGE);
  const hasMore = (rows?.length ?? 0) > PAGE;
  const href = (f: string, p = 0) => `/admin/audit?filter=${f}${p ? `&seite=${p}` : ""}`;

  return (
    <div className="space-y-5">
      <Suspense fallback={<Skeleton className="h-20 w-full rounded-[24px]" />}>
        <Chain orgId={orgId} />
      </Suspense>
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={href(f.id)}
            aria-current={f.id === filter.id ? "page" : undefined}
            className={cn(
              "flex h-9 items-center rounded-full px-4 text-sm font-semibold",
              f.id === filter.id ? "bg-inverse text-inverse-fg" : "bg-surface-2 text-fg-2 hover:text-fg",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <div className="overflow-hidden rounded-[24px] border border-line bg-surface">
        <ol className="divide-y divide-line">
          {list.map((r) => {
            const a = ACTION[r.action] ?? { label: r.action, tone: "neutral" as const };
            const actor = r.actor_id ? byUser.get(r.actor_id) ?? "Unbekannt" : r.actor_kind === "terminal" ? "Terminal" : "System";
            return (
              <li key={r.id} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[150px_1fr] sm:gap-4">
                <span className="tabular text-sm text-fg-3">
                  {new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Berlin" })}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-[15px]">
                    <span className="font-semibold">{ENTITY[r.entity] ?? r.entity}</span>
                    <Badge tone={a.tone}>{a.label}</Badge>
                    <span className="text-fg-2">von {actor}</span>
                    <span className="text-xs text-fg-3">#{r.id}</span>
                  </span>
                  <span className="mt-0.5 block break-words text-sm text-fg-2">{summary(r.entity, r.action, r.old_value, r.new_value, byMember)}</span>
                  {r.reason && <span className="mt-0.5 block text-sm text-fg-3">Begründung: „{r.reason}“</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex justify-between">
        {page > 0 ? <Link href={href(filter.id, page - 1)} className={buttonVariants({ variant: "secondary", size: "sm" })}>Neuere</Link> : <span />}
        {hasMore && <Link href={href(filter.id, page + 1)} className={buttonVariants({ variant: "secondary", size: "sm" })}>Ältere</Link>}
      </div>
    </div>
  );
}

export default function AuditPage(props: PageProps<"/admin/audit">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Audit-Log" description="Wer hat wann was geändert – unveränderlich und manipulationssicher." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[24px]" />}>
        <Log searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
