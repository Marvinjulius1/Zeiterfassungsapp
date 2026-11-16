"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Mail, Share2, UserPlus } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";
import { Segmented } from "@/design-system/components/segmented";
import { Sheet } from "@/design-system/components/sheet";
import { toast } from "@/design-system/components/toaster";
import { haptic } from "@/lib/haptics";
import { inviteMember } from "../actions";
import type { Option } from "../members-shared";
import { ContractFields, DEFAULT_CONTRACT, type ContractState } from "./contract-fields";

export function InviteResult({ name, url, expiresAt }: { name: string; url: string; expiresAt: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    void QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then(setSvg);
  }, [url]);
  const mail = `mailto:?subject=${encodeURIComponent("Deine Einladung zu Zeitgeist")}&body=${encodeURIComponent(
    `Hallo ${name.split(" ")[0]},\n\nhier ist dein persönlicher Link zur Zeiterfassung:\n${url}\n\nEinfach öffnen, mit deiner E-Mail anmelden – fertig.\n`,
  )}`;
  const until = new Date(expiresAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" });

  return (
    <div className="space-y-5">
      <div className="mx-auto w-52 overflow-hidden rounded-[20px] bg-white p-3" aria-label="QR-Code der Einladung" role="img">
        {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="aspect-square skeleton rounded-xl" />}
      </div>
      <p className="text-center text-sm text-fg-2">
        QR-Code mit dem Handy scannen – oder den Link teilen. Gültig bis {until}.
      </p>
      <div className="flex items-center gap-2 rounded-[18px] bg-surface-2 p-2 pl-4">
        <code className="min-w-0 flex-1 truncate text-sm text-fg-2">{url}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            haptic("success");
            toast.success("Link kopiert");
          }}
        >
          <Copy className="h-4 w-4" aria-hidden /> Kopieren
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={mail} className="flex h-12 items-center justify-center gap-2 rounded-full bg-surface-2 text-sm font-semibold hover:bg-surface-3">
          <Mail className="h-4 w-4" aria-hidden /> Per E-Mail
        </a>
        <Button
          variant="secondary"
          className="h-12"
          onClick={() => {
            if (navigator.share) void navigator.share({ title: "Einladung zu Zeitgeist", url });
            else void navigator.clipboard.writeText(url).then(() => toast.success("Link kopiert"));
          }}
        >
          <Share2 className="h-4 w-4" aria-hidden /> Teilen
        </Button>
      </div>
    </div>
  );
}

export function InviteSheet({
  locations,
  teams,
  open,
  onOpenChange,
}: {
  locations: Option[];
  teams: Option[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"employee" | "team_lead" | "admin">("employee");
  const [locationId, setLocationId] = useState<string | null>(locations[0]?.id ?? null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [contract, setContract] = useState<ContractState>(DEFAULT_CONTRACT);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; expiresAt: string; membershipId: string } | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setRole("employee");
    setTeamId(null);
    setBirthDate("");
    setContract(DEFAULT_CONTRACT);
    setResult(null);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await inviteMember({ displayName: name, email, role, locationId, teamId, birthDate, contract });
      if (!res.ok || !res.data) {
        haptic("error");
        setError(res.ok ? "Unbekannter Fehler" : res.error);
        return;
      }
      haptic("success");
      setResult(res.data);
      router.refresh();
    });
  }

  const select = "h-14 w-full rounded-[18px] border border-line bg-surface-2 px-4 text-base text-fg outline-none focus:border-line-strong";

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 300);
      }}
      title={result ? `${name.split(" ")[0]} ist eingeladen 🎉` : "Mitarbeiter einladen"}
      description={result ? undefined : "Dauert 30 Sekunden. Die Person bekommt einen persönlichen Link."}
      trigger={
        <Button>
          <UserPlus className="h-4 w-4" aria-hidden /> Einladen
        </Button>
      }
    >
      {result ? (
        <div className="space-y-4">
          <InviteResult name={name} url={result.url} expiresAt={result.expiresAt} />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="ghost" onClick={reset}>Weitere Person</Button>
            <Button onClick={() => router.push(`/admin/mitarbeiter/${result.membershipId}`)}>Zum Profil</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <Input label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" required />
          <Input
            label="E-Mail (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@firma.de"
            hint="Wenn angegeben, kann nur diese Adresse die Einladung annehmen."
          />
          <div className="space-y-3">
            <p className="text-sm font-medium text-fg-2">Rolle</p>
            <Segmented
              className="w-full"
              label="Rolle"
              value={role}
              onChange={setRole}
              options={[
                { value: "employee", label: "Mitarbeiter" },
                { value: "team_lead", label: "Teamleiter" },
                { value: "admin", label: "Admin" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
              Standort
              <select className={select} value={locationId ?? ""} onChange={(e) => setLocationId(e.target.value || null)}>
                <option value="">–</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
              Team
              <select className={select} value={teamId ?? ""} onChange={(e) => setTeamId(e.target.value || null)}>
                <option value="">–</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          </div>
          <ContractFields value={contract} onChange={setContract} />
          <Input
            label="Geburtsdatum (optional)"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            hint="Nur nötig bei unter 18-Jährigen – dann gelten automatisch die Regeln des Jugendarbeitsschutzes."
          />
          {error && <p role="alert" className="text-sm text-alert">{error}</p>}
          <Button type="submit" size="lg" block loading={pending} disabled={name.trim().length < 2}>
            Einladung erstellen
          </Button>
        </form>
      )}
    </Sheet>
  );
}
