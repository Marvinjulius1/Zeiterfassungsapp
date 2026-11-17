"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, KeyRound, MapPin, Monitor, Plus, Unlink } from "lucide-react";
import { STAMP_METHODS, type StampMethod } from "@/compliance";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Input } from "@/design-system/components/input";
import { Sheet } from "@/design-system/components/sheet";
import { Stepper } from "@/design-system/components/stepper";
import { toast } from "@/design-system/components/toaster";
import { Toggle } from "@/design-system/components/toggle";
import { Chips } from "@/features/admin/components/contract-fields";
import { GERMAN_STATES, type GermanState } from "@/lib/germany";
import { haptic } from "@/lib/haptics";
import { createTerminal, newPairingCode, revokeTerminal, saveLocation } from "./actions";

export interface LocationRow {
  id: string;
  name: string;
  address: string | null;
  state: GermanState;
  geofence: { lat: number; lng: number; radiusM: number } | null;
  terminals: {
    id: string;
    name: string;
    paired: boolean;
    lastSeenAt: string | null;
    methods: string[];
  }[];
}

const METHOD_LABEL: Partial<Record<StampMethod, string>> = {
  terminal_qr: "QR am Terminal",
  personal_qr: "Eigener QR",
  pin: "PIN",
  rfid: "RFID-Chip",
};
const TERMINAL_METHODS = STAMP_METHODS.filter((m) => m in METHOD_LABEL);

function online(lastSeenAt: string | null) {
  return !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 2 * 60000;
}

export function LocationsManager({ locations, canEdit }: { locations: LocationRow[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<LocationRow | "new" | null>(null);
  const [addingTerminal, setAddingTerminal] = useState<LocationRow | null>(null);
  const [code, setCode] = useState<{ code: string; terminal: string } | null>(null);
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      {canEdit && (
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden /> Standort hinzufügen
        </Button>
      )}
      {locations.length === 0 && <EmptyState title="Noch keine Standorte." />}

      {locations.map((l) => (
        <Card key={l.id} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{l.name}</h2>
              <p className="mt-1 text-sm text-fg-2">
                {[l.address, GERMAN_STATES.find((s) => s.code === l.state)?.name].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-2">
                <MapPin className="h-4 w-4" aria-hidden />
                {l.geofence ? (
                  <>
                    Geofence {l.geofence.radiusM} m ·{" "}
                    <a
                      className="underline underline-offset-2 hover:text-fg"
                      href={`https://www.openstreetmap.org/?mlat=${l.geofence.lat}&mlon=${l.geofence.lng}#map=17/${l.geofence.lat}/${l.geofence.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Karte
                    </a>
                  </>
                ) : (
                  "Kein Geofence"
                )}
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(l)}>Bearbeiten</Button>
                <Button variant="secondary" size="sm" onClick={() => setAddingTerminal(l)}>
                  <Monitor className="h-4 w-4" aria-hidden /> Terminal hinzufügen
                </Button>
              </div>
            )}
          </div>

          {l.terminals.length > 0 && (
            <ul className="divide-y divide-line rounded-[20px] border border-line">
              {l.terminals.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Monitor className="h-5 w-5 text-fg-3" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[15px] font-medium">
                      {t.name}
                      {!t.paired ? <Badge tone="pause">nicht gekoppelt</Badge> : online(t.lastSeenAt) ? <Badge tone="ok">online</Badge> : <Badge>offline</Badge>}
                    </p>
                    <p className="text-sm text-fg-2">
                      {t.methods.map((m) => METHOD_LABEL[m as StampMethod] ?? m).join(" · ")}
                      {t.lastSeenAt && ` · zuletzt ${new Date(t.lastSeenAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" })}`}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await newPairingCode(t.id);
                            if (!res.ok || !res.data) return void toast.error(res.ok ? "Fehler" : res.error);
                            setCode({ code: res.data.code, terminal: t.name });
                          })
                        }
                      >
                        <KeyRound className="h-4 w-4" aria-hidden /> Kopplungscode
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            if (!window.confirm(`„${t.name}“ wirklich entkoppeln? Das Tablet kann danach nicht mehr stempeln.`)) return;
                            const res = await revokeTerminal(t.id);
                            if (!res.ok) return void toast.error(res.error);
                            toast.success("Terminal entkoppelt");
                            router.refresh();
                          })
                        }
                      >
                        <Unlink className="h-4 w-4" aria-hidden /> Entkoppeln
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      {editing && <LocationSheet location={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {addingTerminal && (
        <TerminalSheet
          location={addingTerminal}
          onClose={() => setAddingTerminal(null)}
          onCreated={(c, name) => {
            setAddingTerminal(null);
            setCode({ code: c, terminal: name });
          }}
        />
      )}
      {code && (
        <Sheet open onOpenChange={(v) => !v && setCode(null)} title={`Kopplungscode für „${code.terminal}“`} description="Gültig für 15 Minuten.">
          <div className="space-y-6 text-center">
            <p className="tabular text-6xl font-semibold tracking-[0.25em]">{code.code}</p>
            <ol className="space-y-2 text-left text-[15px] text-fg-2">
              <li>1. Auf dem Tablet <strong className="text-fg">{typeof window !== "undefined" ? window.location.origin : ""}/terminal</strong> öffnen</li>
              <li>2. Code eingeben – fertig</li>
              <li>3. Tipp: Seite zum Home-Bildschirm hinzufügen und Vollbild aktivieren (Logo lange drücken)</li>
            </ol>
            <Button size="lg" block onClick={() => { setCode(null); router.refresh(); }}>Fertig</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function LocationSheet({ location, onClose }: { location: LocationRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(location?.name ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [state, setState] = useState<GermanState>(location?.state ?? "NW");
  const [geo, setGeo] = useState(!!location?.geofence);
  const [lat, setLat] = useState(String(location?.geofence?.lat ?? ""));
  const [lng, setLng] = useState(String(location?.geofence?.lng ?? ""));
  const [radius, setRadius] = useState(location?.geofence?.radiusM ?? 150);

  const valid = name.trim().length > 0 && (!geo || (!Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng))));

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title={location ? "Standort bearbeiten" : "Neuer Standort"}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveLocation({
              id: location?.id,
              name,
              address,
              state,
              geofence: geo ? { lat: parseFloat(lat), lng: parseFloat(lng), radiusM: radius } : null,
            });
            if (!res.ok) return void toast.error(res.error);
            haptic("success");
            toast.success("Standort gespeichert");
            onClose();
            router.refresh();
          });
        }}
      >
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Input label="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} />
        <label className="flex flex-col gap-2 text-sm font-medium text-fg-2">
          Bundesland (für Feiertage)
          <select className="h-14 rounded-[18px] border border-line bg-surface-2 px-4 text-base text-fg" value={state} onChange={(e) => setState(e.target.value as GermanState)}>
            {GERMAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-medium">Geofence</p>
            <p className="text-sm text-fg-2">Für „Einchecken per App nur vor Ort“. Geprüft wird nur beim Stempeln.</p>
          </div>
          <Toggle checked={geo} onCheckedChange={setGeo} label="Geofence" />
        </div>
        {geo && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Breitengrad" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="50.9375" />
              <Input label="Längengrad" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="6.9403" />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                navigator.geolocation.getCurrentPosition(
                  (p) => {
                    setLat(p.coords.latitude.toFixed(6));
                    setLng(p.coords.longitude.toFixed(6));
                  },
                  () => toast.error("Standort nicht verfügbar"),
                  { enableHighAccuracy: true, timeout: 10000 },
                )
              }
            >
              <Crosshair className="h-4 w-4" aria-hidden /> Meinen aktuellen Standort übernehmen
            </Button>
            <p className="text-[16px] leading-[2.6]">
              Radius <Stepper label="Radius in Metern" value={radius} min={25} max={2000} step={25} onChange={setRadius} /> Meter
            </p>
          </div>
        )}
        <Button type="submit" size="lg" block loading={pending} disabled={!valid}>Speichern</Button>
      </form>
    </Sheet>
  );
}

function TerminalSheet({ location, onClose, onCreated }: { location: LocationRow; onClose: () => void; onCreated: (code: string, name: string) => void }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(`Eingang ${location.name}`);
  const [kioskPin, setKioskPin] = useState("");
  const [methods, setMethods] = useState<StampMethod[]>(["terminal_qr", "personal_qr", "pin", "rfid"]);

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()} title="Terminal hinzufügen" description={location.name}>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createTerminal({ locationId: location.id, name, kioskPin, methods });
            if (!res.ok || !res.data) return void toast.error(res.ok ? "Fehler" : res.error);
            haptic("success");
            onCreated(res.data.code, name);
          });
        }}
      >
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="space-y-3">
          <p className="text-sm font-medium text-fg-2">Erfassungswege an diesem Terminal</p>
          <Chips
            label="Erfassungswege"
            options={TERMINAL_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m]! }))}
            selected={methods}
            onToggle={(m) => setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))}
          />
        </div>
        <Input
          label="Kiosk-PIN (6 Ziffern)"
          inputMode="numeric"
          maxLength={6}
          value={kioskPin}
          onChange={(e) => setKioskPin(e.target.value.replace(/\D/g, ""))}
          hint="Schützt das Kiosk-Menü (Vollbild verlassen, Entkoppeln). Lange auf das Logo drücken."
        />
        <Button type="submit" size="lg" block loading={pending} disabled={kioskPin.length !== 6 || methods.length === 0 || !name.trim()}>
          Terminal anlegen
        </Button>
      </form>
    </Sheet>
  );
}
