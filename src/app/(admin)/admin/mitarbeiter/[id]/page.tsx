import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock4 } from "lucide-react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { buttonVariants } from "@/design-system/components/button-variants";
import { Card, CardHeader } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";
import { ViolationList } from "@/features/compliance/components/violation-list";
import { AcknowledgeButton, ContractForm, DocumentsPanel, ProfileForm, ReissueInvite } from "@/features/admin/components/member-forms";
import { CONTRACT_LABEL, getMemberDetail, getMemberOptions } from "@/features/admin/members";
import { ROLE_LABEL, isOrgAdmin } from "@/lib/auth/roles";
import { RfidCard } from "@/features/terminal/rfid-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminArea } from "@/lib/auth/session";
import { formatDayShort } from "@/lib/time/berlin";
import { formatHours } from "@/lib/time/format";

export const metadata: Metadata = { title: "Mitarbeiter" };

const ACTION: Record<string, string> = { insert: "angelegt", update: "geändert", delete: "gelöscht", void: "ungültig markiert" };

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireAdminArea();
  const [member, options] = await Promise.all([getMemberDetail(viewer.active.orgId, id), getMemberOptions(viewer.active.orgId)]);
  if (!member) notFound();
  const canEdit = isOrgAdmin(viewer.active.role);
  const { data: cred } = await createAdminClient().from("member_credentials").select("rfid_uid_hash").eq("membership_id", member.id).single();

  return (
    <div className="space-y-6">
      <Link href="/admin/mitarbeiter" className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-2 hover:text-fg">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Alle Mitarbeiter
      </Link>

      <header className="flex flex-wrap items-center gap-5">
        <Avatar name={member.name} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em]">{member.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] text-fg-2">
            <Badge>{ROLE_LABEL[member.role]}</Badge>
            {member.status === "invited" && <Badge tone="pause">Einladung offen</Badge>}
            {member.status === "archived" && <Badge>Archiviert</Badge>}
            {[member.contractType && CONTRACT_LABEL[member.contractType], member.locationName, member.teamName, member.email].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          {member.status === "invited" && canEdit && <ReissueInvite membershipId={member.id} name={member.name} />}
          <Link href={`/admin/zeiten?person=${member.id}`} className={buttonVariants({ variant: "secondary" })}>
            <Clock4 className="h-4 w-4" aria-hidden /> Zeiten
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-fg-2">Diese Woche</p>
          <p className="tabular mt-1 text-2xl font-semibold">{formatHours(member.weekMinutes)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-fg-2">Stundenkonto</p>
          <p className="tabular mt-1 text-2xl font-semibold">{formatHours(member.balanceMinutes, { sign: true })}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-fg-2">Offene Hinweise</p>
          <p className="tabular mt-1 text-2xl font-semibold">{member.violations.length}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <ProfileForm
            key={JSON.stringify([member.role, member.locationId, member.teamId, member.name])}
            member={member}
            locations={options.locations}
            teams={options.teams}
            canEdit={canEdit}
            canSetOwner={viewer.active.role === "owner"}
          />
          <ContractForm key={member.contract?.validFrom ?? "none"} member={member} canEdit={canEdit} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Arbeitsschutz" subtitle="Offene Verstöße und Warnungen" />
            {member.violations.length === 0 ? (
              <p className="text-sm text-fg-2">Alles im grünen Bereich. ✓</p>
            ) : (
              <ViolationList
                items={member.violations.map((v) => ({
                  ...v,
                  title: formatDayShort(v.workDate),
                  action: <AcknowledgeButton id={v.id} />,
                }))}
              />
            )}
          </Card>
          <DocumentsPanel member={member} orgId={viewer.active.orgId} canEdit={canEdit} />
          <RfidCard membershipId={member.id} hasChip={!!cred?.rfid_uid_hash} canEdit={canEdit} />
          <Card>
            <CardHeader title="Verlauf" subtitle="Änderungen an diesem Profil (Audit-Log)" />
            <ol className="space-y-3">
              {member.history.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="text-fg">
                    <span className="font-medium">{ACTION[h.action] ?? h.action}</span>{" "}
                    <span className="text-fg-3">· {new Date(h.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" })}</span>
                  </p>
                  {h.changes && <p className="mt-0.5 break-words text-fg-2">{h.changes}</p>}
                  {h.reason && <p className="mt-0.5 text-fg-3">„{h.reason}“</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function MemberPage({ params }: PageProps<"/admin/mitarbeiter/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6" aria-busy aria-label="Wird geladen">
          <Skeleton className="h-20 w-96" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96 w-full rounded-[24px]" />
        </div>
      }
    >
      <Detail params={params} />
    </Suspense>
  );
}
