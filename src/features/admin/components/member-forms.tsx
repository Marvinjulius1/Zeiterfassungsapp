"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, FileText, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader } from "@/design-system/components/card";
import { Input } from "@/design-system/components/input";
import { Segmented } from "@/design-system/components/segmented";
import { Sheet } from "@/design-system/components/sheet";
import { toast } from "@/design-system/components/toaster";
import { Toggle } from "@/design-system/components/toggle";
import { haptic } from "@/lib/haptics";
import { createClient } from "@/lib/supabase/client";
import { berlinDateKey } from "@/lib/time/berlin";
import type { MemberRole } from "@/lib/auth/roles";
import { acknowledgeViolation, documentDownloadUrl, registerDocument, reissueInvitation, saveContract, updateMember } from "../actions";
import type { MemberDetail, Option } from "../members";
import { ContractFields, type ContractState } from "./contract-fields";
import { InviteResult } from "./invite-sheet";

const select = "h-14 w-full rounded-[18px] border border-line bg-surface-2 px-4 text-base text-fg outline-none focus:border-line-strong disabled:opacity-60";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        haptic("error");
        toast.error(res.error ?? "Fehlgeschlagen");
        return;
      }
      haptic("success");
      toast.success(success);
      router.refresh();
    });
  return { pending, run };
}

// ---------------------------------------------------------------------------
export function ProfileForm({ member, locations, teams, canEdit, canSetOwner }: { member: MemberDetail; locations: Option[]; teams: Option[]; canEdit: boolean; canSetOwner: boolean }) {
  const { pending, run } = useAction();
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<MemberRole>(member.role);
  const [locationId, setLocationId] = useState(member.locationId ?? "");
  const [teamId, setTeamId] = useState(member.teamId ?? "");
  const [employeeNo, setEmployeeNo] = useState(member.employeeNo ?? "");
  const [birthDate, setBirthDate] = useState(member.birthDate ?? "");
  const [maternity, setMaternity] = useState(member.maternity);

  const roles = [
    { value: "employee" as const, label: "Mitarbeiter" },
    { value: "team_lead" as const, label: "Teamleiter" },
    { value: "admin" as const, label: "Admin" },
    ...(canSetOwner || member.role === "owner" ? [{ value: "owner" as const, label: "Owner" }] : []),
  ];

  return (
    <Card>
      <CardHeader title="Stammdaten" />
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => updateMember(member.id, { displayName: name, role, locationId: locationId || null, teamId: teamId || null, employeeNo, birthDate, maternityProtection: maternity }),
            "Gespeichert",
          );
        }}
      >
        <fieldset disabled={!canEdit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Personalnummer" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-fg-2">Rolle</p>
            <Segmented label="Rolle" value={role} onChange={setRole} options={roles} className="flex-wrap" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
              Standort
              <select className={select} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">–</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
              Team
              <select className={select} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">–</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>
          <Input label="Geburtsdatum" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} hint="Nur für Jugendarbeitsschutz nötig." />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-medium">Mutterschutz</p>
              <p className="text-sm text-fg-2">Max. 8,5 h/Tag, keine Nacht- und Sonntagsarbeit (MuSchG).</p>
            </div>
            <Toggle checked={maternity} onCheckedChange={setMaternity} label="Mutterschutz" />
          </div>
        </fieldset>
        {canEdit && (
          <Button type="submit" loading={pending}>
            Speichern
          </Button>
        )}
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function ContractForm({ member, canEdit }: { member: MemberDetail; canEdit: boolean }) {
  const { pending, run } = useAction();
  const c = member.contract;
  const [value, setValue] = useState<ContractState>({
    type: c?.type ?? "full_time",
    weeklyHours: Math.round((c?.weeklyMinutes ?? 2400) / 60),
    workDays: c ? Object.entries(c.dailyTargets).filter(([, v]) => v > 0).map(([k]) => Number(k)).sort() : [1, 2, 3, 4, 5],
    vacationDays: c?.vacationDays ?? 28,
    schoolDays: c?.schoolDays ?? [],
    trustBased: c?.trustBased ?? false,
  });
  const [validFrom, setValidFrom] = useState(berlinDateKey());

  return (
    <Card>
      <CardHeader title="Vertrag" subtitle={c ? `Gültig seit ${c.validFrom.split("-").reverse().join(".")}` : "Noch kein Vertrag hinterlegt"} />
      <fieldset disabled={!canEdit} className="space-y-6">
        <ContractFields value={value} onChange={setValue} />
        {canEdit && (
          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-5">
            <div className="w-48">
              <Input label="Gilt ab" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <Button loading={pending} onClick={() => run(() => saveContract(member.id, validFrom, value), "Vertrag gespeichert")}>
              Vertrag speichern
            </Button>
          </div>
        )}
      </fieldset>
      {member.contractHistory.length > 1 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-sm font-medium text-fg-2">Verlauf</p>
          <ul className="space-y-1 text-sm text-fg-2">
            {member.contractHistory.map((h) => (
              <li key={h.validFrom} className="tabular">
                {h.validFrom.split("-").reverse().join(".")} – {h.validTo ? h.validTo.split("-").reverse().join(".") : "heute"} · {h.weeklyMinutes / 60} h/Woche
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
const CATEGORY = [
  { value: "contract" as const, label: "Vertrag" },
  { value: "sick_note" as const, label: "AU" },
  { value: "certificate" as const, label: "Zertifikat" },
  { value: "other" as const, label: "Sonstiges" },
];
const CATEGORY_LABEL: Record<string, string> = { contract: "Vertrag", sick_note: "AU", certificate: "Zertifikat", payslip: "Lohnabrechnung", other: "Sonstiges" };

export function DocumentsPanel({ member, orgId, canEdit }: { member: MemberDetail; orgId: string; canEdit: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<(typeof CATEGORY)[number]["value"]>("contract");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Datei ist größer als 20 MB.");
      return;
    }
    setBusy(true);
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${orgId}/${member.id}/${crypto.randomUUID()}-${safe}`;
    const { error } = await createClient().storage.from("documents").upload(path, file, { contentType: file.type });
    if (error) {
      setBusy(false);
      toast.error("Upload fehlgeschlagen", { description: error.message });
      return;
    }
    const res = await registerDocument({ membershipId: member.id, category, title: file.name, storagePath: path, mimeType: file.type, sizeBytes: file.size });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    haptic("success");
    toast.success("Dokument abgelegt");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Personalakte" subtitle="Verträge, AUs, Zertifikate – nur für Admins und die Person selbst sichtbar." />
      {member.documents.length === 0 ? (
        <p className="pb-2 text-sm text-fg-2">Noch keine Dokumente.</p>
      ) : (
        <ul className="divide-y divide-line">
          {member.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <FileText className="h-5 w-5 shrink-0 text-fg-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{d.title}</p>
                <p className="text-sm text-fg-2">
                  {CATEGORY_LABEL[d.category]} · {new Date(d.createdAt).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
                  {d.sizeBytes ? ` · ${Math.max(1, Math.round(d.sizeBytes / 1024))} KB` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${d.title} herunterladen`}
                onClick={async () => {
                  const res = await documentDownloadUrl(d.id);
                  if (res.ok && res.data) window.open(res.data.url, "_blank", "noopener");
                  else toast.error(res.ok ? "Fehler" : res.error);
                }}
              >
                <Download className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Segmented label="Kategorie" value={category} onChange={setCategory} options={CATEGORY} />
          <input
            ref={input}
            type="file"
            className="sr-only"
            accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
            aria-label="Dokument auswählen"
          />
          <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden /> Hochladen
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function ReissueInvite({ membershipId, name }: { membershipId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ url: string; expiresAt: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Neuer Einladungslink"
      description="Der alte Link wird dabei ungültig."
      trigger={
        <Button
          variant="secondary"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await reissueInvitation(membershipId);
              if (!res.ok || !res.data) {
                toast.error(res.ok ? "Fehler" : res.error);
                return;
              }
              setResult(res.data);
              setOpen(true);
            })
          }
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Neuen Link erzeugen
        </Button>
      }
    >
      {result ? <InviteResult name={name} url={result.url} expiresAt={result.expiresAt} /> : <div className="h-64 skeleton rounded-2xl" />}
    </Sheet>
  );
}

export function AcknowledgeButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => acknowledgeViolation(id), "Quittiert")} aria-label="Hinweis quittieren">
      <Check className="h-4 w-4" aria-hidden /> Quittieren
    </Button>
  );
}
