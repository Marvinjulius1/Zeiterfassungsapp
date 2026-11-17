"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Check, Coffee, Expand, KeyRound, LogOut, Lock, Play, RefreshCw, Unlink, Wifi, WifiOff, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/design-system/components/button";
import { LoadingDots } from "@/design-system/components/button";
import { spring } from "@/design-system/motion";
import type { EventKind } from "@/compliance";
import { cn } from "@/lib/cn";
import { greeting } from "@/lib/greeting";
import { formatTime } from "@/lib/time/berlin";
import { useNow } from "@/lib/use-now";
import { parseCode } from "./crypto";
import { PinPad } from "./pin-pad";
import { QrScanner } from "./qr-scanner";
import { playSound } from "./sound";
import { TerminalQr } from "./terminal-qr";
import { dropFromTerminalQueue, pushTerminalQueue, readTerminalQueue } from "./terminal-queue";

const SECRET_KEY = "zg_terminal_secret";

interface TerminalInfo {
  id: string;
  name: string;
  orgName: string;
  locationName: string;
  allowedMethods: string[];
}

type Method = "personal_qr" | "pin" | "rfid";
type Person = { membershipId: string; name: string; firstName: string; state: "out" | "in" | "break" };

type Overlay =
  | { t: "none" }
  | { t: "pin" }
  | { t: "camera" }
  | { t: "busy" }
  | { t: "choose"; person: Person; ticket: string }
  | { t: "done"; firstName: string; kind: EventKind; at: string; note?: string }
  | { t: "queued"; label: string }
  | { t: "error"; message: string }
  | { t: "kiosk" };

const DONE_TEXT: Record<EventKind, string> = {
  check_in: "eingecheckt",
  break_start: "Pause gestartet",
  break_end: "zurück aus der Pause",
  check_out: "ausgecheckt",
};

async function postJson<T>(url: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

// ===========================================================================
export function TerminalApp() {
  const [phase, setPhase] = useState<"loading" | "pair" | "ready" | "repair">("loading");
  const [terminal, setTerminal] = useState<TerminalInfo | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  type Loaded =
    | { phase: "pair" }
    | { phase: "ready" | "repair"; terminal: TerminalInfo; secret: string | null; offset: number };

  const fetchSession = useCallback(async (): Promise<Loaded> => {
    const s = localStorage.getItem(SECRET_KEY);
    try {
      const res = await fetch("/api/terminal/session", { cache: "no-store" });
      if (res.status === 401) return { phase: "pair" };
      const data = await res.json();
      return { phase: s ? "ready" : "repair", terminal: data.terminal, secret: s, offset: data.serverNow - Date.now() };
    } catch {
      // offline beim Start: mit gespeicherten Daten weitermachen
      const cached = localStorage.getItem("zg_terminal_info");
      return s && cached ? { phase: "ready", terminal: JSON.parse(cached), secret: s, offset: 0 } : { phase: "pair" };
    }
  }, []);

  const apply = useCallback((l: Loaded) => {
    setPhase(l.phase);
    if (l.phase !== "pair") {
      setTerminal(l.terminal);
      setSecret(l.secret);
      setOffset(l.offset);
    }
  }, []);

  const load = useCallback(() => fetchSession().then(apply), [fetchSession, apply]);

  useEffect(() => {
    void fetchSession().then(apply);
  }, [fetchSession, apply]);

  useEffect(() => {
    if (terminal) localStorage.setItem("zg_terminal_info", JSON.stringify(terminal));
  }, [terminal]);

  if (phase === "loading") return <Centered><LoadingDots className="text-fg-2" /></Centered>;
  if (phase === "pair" || phase === "repair")
    return (
      <Pairing
        repair={phase === "repair"}
        onPaired={(s) => {
          localStorage.setItem(SECRET_KEY, s);
          void load();
        }}
      />
    );
  return <Kiosk terminal={terminal!} secret={secret!} offset={offset} onOffset={setOffset} onUnpaired={() => {
    localStorage.removeItem(SECRET_KEY);
    localStorage.removeItem("zg_terminal_info");
    setPhase("pair");
  }} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main id="main" className="flex min-h-dvh items-center justify-center p-8">{children}</main>;
}

// ===========================================================================
// Kopplung
// ===========================================================================
function Pairing({ onPaired, repair }: { onPaired: (secret: string) => void; repair: boolean }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(c: string) {
    setBusy(true);
    setError(null);
    const { data } = await postJson<{ ok: boolean; error?: string; signingSecret?: string }>("/api/terminal/pair", { code: c }).catch(() => ({
      data: { ok: false, error: "Keine Verbindung." } as { ok: boolean; error?: string; signingSecret?: string },
      status: 0,
    }));
    setBusy(false);
    if (!data.ok || !data.signingSecret) {
      setError(data.error ?? "Kopplung fehlgeschlagen.");
      setCode("");
      playSound("error");
      return;
    }
    playSound("success");
    onPaired(data.signingSecret);
  }

  return (
    <Centered>
      <div className="w-full max-w-md text-center">
        <Logo size={28} />
        <h1 className="mt-10 text-[34px] font-semibold tracking-[-0.03em]">{repair ? "Bitte neu koppeln" : "Terminal einrichten"}</h1>
        <p className="mt-3 text-lg text-fg-2">
          Gib den 6-stelligen Code ein, den du in der Verwaltung unter <strong className="text-fg">Standorte → Terminal hinzufügen</strong> erhältst.
        </p>
        <label htmlFor="pair-code" className="sr-only">Kopplungscode</label>
        <input
          id="pair-code"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={code}
          disabled={busy}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            if (v.length === 6) void submit(v);
          }}
          placeholder="000000"
          className="tabular mt-10 h-24 w-full rounded-[24px] border border-line bg-surface-2 text-center text-5xl font-semibold tracking-[0.35em] text-fg outline-none placeholder:text-fg-3/40 focus:border-line-strong"
        />
        {error && <p role="alert" className="mt-4 text-alert">{error}</p>}
      </div>
    </Centered>
  );
}

// ===========================================================================
// Kiosk
// ===========================================================================
function Kiosk({
  terminal,
  secret,
  offset,
  onOffset,
  onUnpaired,
}: {
  terminal: TerminalInfo;
  secret: string;
  offset: number;
  onOffset: (ms: number) => void;
  onUnpaired: () => void;
}) {
  const now = useNow();
  const [overlay, setOverlay] = useState<Overlay>({ t: "none" });
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const overlayRef = useRef(overlay);
  const lastFeed = useRef(new Date().toISOString());
  const rfid = useRef<{ buf: string; last: number }>({ buf: "", last: 0 });
  const dismiss = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);

  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  const show = useCallback((o: Overlay, autoCloseMs?: number) => {
    window.clearTimeout(dismiss.current);
    setOverlay(o);
    if (autoCloseMs) dismiss.current = window.setTimeout(() => setOverlay({ t: "none" }), autoCloseMs);
  }, []);

  const refreshQueue = useCallback(async () => setQueued((await readTerminalQueue()).length), []);

  // --- Ergebnis anzeigen -----------------------------------------------------
  const celebrate = useCallback(
    (firstName: string, kind: EventKind, at: string, note?: string) => {
      playSound(kind === "break_start" ? "pause" : "success");
      show({ t: "done", firstName, kind, at, note }, 4500);
    },
    [show],
  );

  const fail = useCallback(
    (message: string) => {
      playSound("error");
      show({ t: "error", message }, 4000);
    },
    [show],
  );

  // --- Stempeln mit Ticket ---------------------------------------------------
  const stamp = useCallback(
    async (ticket: string, kind: EventKind | null, firstName: string) => {
      show({ t: "busy" });
      try {
        const { data } = await postJson<{ ok: boolean; kind: EventKind; occurredAt: string; error?: string; warnings?: string[] }>(
          "/api/terminal/stamp",
          { ticket, kind, eventId: crypto.randomUUID() },
        );
        if (!data.ok) return fail(data.error ?? "Stempeln fehlgeschlagen.");
        celebrate(firstName, data.kind, data.occurredAt, data.warnings?.[0]);
      } catch {
        fail("Keine Verbindung. Bitte erneut versuchen.");
      }
    },
    [show, fail, celebrate],
  );

  // --- Identifizieren (eigener QR, PIN, RFID) --------------------------------
  const handleIdentity = useCallback(
    async (method: Method, value: string) => {
      if (!terminal.allowedMethods.includes(method)) return fail("Dieser Weg ist an diesem Terminal nicht aktiviert.");
      if (inFlight.current) return; // Doppelte Eingaben (z. B. prellender RFID-Leser) ignorieren
      inFlight.current = true;
      window.setTimeout(() => (inFlight.current = false), 1500);
      show({ t: "busy" });
      const occurredAt = new Date(Date.now() + offset).toISOString();
      try {
        const { status, data } = await postJson<{ ok: boolean; error?: string; person: Person; ticket: string }>("/api/terminal/identify", { method, value });
        setOnline(true);
        if (!data.ok) return fail(data.error ?? (status === 429 ? "Zu viele Fehlversuche." : "Nicht erkannt."));
        const p = data.person;
        if (p.state === "in") show({ t: "choose", person: p, ticket: data.ticket }, 10000);
        else await stamp(data.ticket, null, p.firstName);
      } catch {
        // Offline: Identifikation + Zeitpunkt puffern, Prüfung beim Sync
        setOnline(false);
        await pushTerminalQueue({ eventId: crypto.randomUUID(), method, value, occurredAt });
        await refreshQueue();
        playSound("success");
        show({ t: "queued", label: `Gespeichert um ${formatTime(occurredAt)}` }, 4000);
      }
    },
    [terminal.allowedMethods, offset, show, fail, stamp, refreshQueue],
  );

  // --- Feed: Handy-Scans am Terminal begrüßen + Uhr abgleichen ---------------
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/terminal/feed?since=${encodeURIComponent(lastFeed.current)}`, { cache: "no-store" });
        if (res.status === 401) return onUnpaired();
        const data = (await res.json()) as { serverNow: number; events: { kind: EventKind; occurredAt: string; receivedAt: string; firstName: string }[] };
        setOnline(true);
        onOffset(data.serverNow - Date.now());
        for (const e of data.events) {
          lastFeed.current = e.receivedAt;
          if (overlayRef.current.t === "none" || overlayRef.current.t === "done") celebrate(e.firstName, e.kind, e.occurredAt);
        }
      } catch {
        setOnline(false);
      }
      if (!stop) window.setTimeout(poll, 2500);
    };
    void poll();
    return () => {
      stop = true;
    };
  }, [celebrate, onOffset, onUnpaired]);

  // --- Offline-Puffer synchronisieren ----------------------------------------
  useEffect(() => {
    void readTerminalQueue().then((q) => setQueued(q.length));
    const sync = async () => {
      const q = await readTerminalQueue();
      if (q.length === 0) return;
      try {
        const { data } = await postJson<{ ok: boolean; results: { eventId: string; ok: boolean; retry?: boolean }[] }>("/api/terminal/offline", { items: q });
        if (data.ok) {
          // Erfolgreiche und endgültig abgelehnte entfernen; „retry" (z. B. Sperre) bleibt im Puffer
          await dropFromTerminalQueue(data.results.filter((r) => !r.retry).map((r) => r.eventId));
          await refreshQueue();
        }
      } catch {
        /* weiter offline */
      }
    };
    const id = window.setInterval(() => void sync(), 15000);
    window.addEventListener("online", sync);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", sync);
    };
  }, [refreshQueue]);

  // --- RFID-Leser (Tastatur-Emulation: schnelle Zeichen + Enter) -------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlayRef.current.t !== "none") return;
      const t = Date.now();
      if (e.key === "Enter") {
        const code = rfid.current.buf;
        rfid.current = { buf: "", last: 0 };
        if (code.length >= 6) void handleIdentity("rfid", code);
        return;
      }
      if (/^[0-9a-fA-F]$/.test(e.key)) {
        // Menschen tippen langsamer als 50 ms pro Zeichen – Leser nicht
        rfid.current = { buf: t - rfid.current.last < 50 || !rfid.current.buf ? rfid.current.buf + e.key : e.key, last: t };
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleIdentity]);

  // --- Bildschirm wach halten -------------------------------------------------
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const req = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        /* nicht unterstützt */
      }
    };
    void req();
    const vis = () => document.visibilityState === "visible" && void req();
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      void lock?.release();
    };
  }, []);

  // --- Kiosk-Menü per langem Druck auf das Logo -------------------------------
  const press = useRef<number | undefined>(undefined);
  const longPress = {
    onPointerDown: () => (press.current = window.setTimeout(() => show({ t: "kiosk" }), 1500)),
    onPointerUp: () => window.clearTimeout(press.current),
    onPointerLeave: () => window.clearTimeout(press.current),
  };

  const local = new Date(now.getTime() + offset);
  const allowed = (m: string) => terminal.allowedMethods.includes(m);

  return (
    <main id="main" className="relative flex min-h-dvh select-none flex-col overflow-hidden p-6 sm:p-10">
      <header className="flex items-center justify-between">
        <button type="button" aria-label="Kiosk-Menü (lange drücken)" className="touch-none" {...longPress}>
          <Logo size={24} />
        </button>
        <div className="flex items-center gap-3 text-sm">
          {queued > 0 && <span className="rounded-full bg-pause-soft px-3 py-1.5 font-semibold text-pause">{queued} gepuffert</span>}
          <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold", online ? "text-ok" : "bg-alert-soft text-alert")}>
            {online ? <Wifi className="h-4 w-4" aria-hidden /> : <WifiOff className="h-4 w-4" aria-hidden />}
            {online ? "Online" : "Offline"}
          </span>
        </div>
      </header>

      <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1fr_auto]">
        <section aria-label="Uhrzeit">
          <p className="text-xl text-fg-2">{terminal.orgName} · {terminal.locationName}</p>
          <p className="tabular mt-4 text-[96px] font-semibold leading-none tracking-[-0.05em] sm:text-[140px]" aria-live="off">
            {formatTime(local)}
          </p>
          <p className="mt-4 text-3xl font-medium text-fg-2">{greeting(local)}!</p>
          <p className="mt-2 text-lg text-fg-3">{local.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" })}</p>
        </section>

        {allowed("terminal_qr") && (
          <section aria-label="Mit dem Handy stempeln" className="flex flex-col items-center gap-3">
            <TerminalQr terminalId={terminal.id} secret={secret} offsetMs={offset} />
            <p className="text-lg font-medium">Mit dem Handy scannen</p>
          </section>
        )}
      </div>

      <footer className="grid gap-3 sm:grid-cols-3">
        {allowed("personal_qr") && (
          <Button size="xl" variant="secondary" onClick={() => show({ t: "camera" })}>
            <Camera className="h-6 w-6" aria-hidden /> Eigenen QR zeigen
          </Button>
        )}
        {allowed("pin") && (
          <Button size="xl" variant="secondary" onClick={() => show({ t: "pin" })}>
            <KeyRound className="h-6 w-6" aria-hidden /> PIN eingeben
          </Button>
        )}
        {allowed("rfid") && (
          <div className="flex h-16 items-center justify-center rounded-[22px] border border-dashed border-line-strong text-fg-2">
            Chip an den Leser halten
          </div>
        )}
      </footer>

      {/* ------------------------------------------------------------ Overlays */}
      <AnimatePresence>
        {overlay.t !== "none" && (
          <motion.div
            key={overlay.t}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 p-8 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Stempeln"
          >
            {overlay.t !== "busy" && overlay.t !== "done" && overlay.t !== "queued" && (
              <button type="button" aria-label="Schließen" className="absolute right-6 top-6 rounded-full p-3 text-fg-2 hover:bg-surface-2" onClick={() => show({ t: "none" })}>
                <X className="h-7 w-7" aria-hidden />
              </button>
            )}
            <OverlayContent overlay={overlay} show={show} handleIdentity={handleIdentity} stamp={stamp} onUnpaired={onUnpaired} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ===========================================================================
function OverlayContent({
  overlay,
  show,
  handleIdentity,
  stamp,
  onUnpaired,
}: {
  overlay: Overlay;
  show: (o: Overlay, ms?: number) => void;
  handleIdentity: (m: Method, v: string) => Promise<void>;
  stamp: (ticket: string, kind: EventKind | null, firstName: string) => Promise<void>;
  onUnpaired: () => void;
}) {
  switch (overlay.t) {
    case "pin":
      return (
        <div className="w-full">
          <h2 className="mb-10 text-center text-3xl font-semibold">Deine PIN</h2>
          <PinPad onSubmit={(pin) => void handleIdentity("pin", pin)} onCancel={() => show({ t: "none" })} />
        </div>
      );
    case "camera":
      return (
        <div className="w-full max-w-xl text-center">
          <h2 className="text-3xl font-semibold">Halte deinen QR-Code in die Kamera</h2>
          <p className="mt-2 text-lg text-fg-2">In der App unter „Heute“ → „Mein QR“</p>
          <QrScanner
            facingMode="user"
            mirrored
            className="mx-auto mt-8 aspect-video w-full"
            onResult={(text) => {
              const p = parseCode(text);
              if (p?.kind === "P1") void handleIdentity("personal_qr", text);
            }}
          />
        </div>
      );
    case "busy":
      return <LoadingDots className="scale-150 text-fg-2" />;
    case "choose":
      return (
        <div className="w-full max-w-xl text-center">
          <h2 className="text-5xl font-semibold tracking-[-0.03em]">Hallo {overlay.person.firstName}!</h2>
          <p className="mt-3 text-xl text-fg-2">Du bist eingecheckt. Was möchtest du tun?</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <Button size="xl" variant="secondary" className="h-24 text-xl" onClick={() => void stamp(overlay.ticket, "break_start", overlay.person.firstName)}>
              <Coffee className="h-7 w-7" aria-hidden /> Pause
            </Button>
            <Button size="xl" className="h-24 text-xl" onClick={() => void stamp(overlay.ticket, "check_out", overlay.person.firstName)}>
              <LogOut className="h-7 w-7" aria-hidden /> Gehen
            </Button>
          </div>
        </div>
      );
    case "done": {
      const tone = overlay.kind === "break_start" ? "bg-pause" : overlay.kind === "check_out" ? "bg-inverse" : "bg-ok";
      const Icon = overlay.kind === "break_end" ? Play : Check;
      return (
        <div className="text-center" role="status">
          <motion.span
            className={cn("mx-auto flex h-36 w-36 items-center justify-center rounded-full", tone)}
            initial={{ scale: 0.3, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 14 }}
          >
            <Icon className={cn("h-20 w-20", overlay.kind === "check_out" ? "text-inverse-fg" : "text-bg")} strokeWidth={3} aria-hidden />
          </motion.span>
          <motion.h2 initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring.gentle, delay: 0.08 }} className="mt-10 text-6xl font-semibold tracking-[-0.04em]">
            {overlay.kind === "check_out" ? `Tschüss, ${overlay.firstName}` : `${greeting()}, ${overlay.firstName} 👋`}
          </motion.h2>
          <motion.p initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring.gentle, delay: 0.16 }} className="mt-4 text-2xl text-fg-2">
            {DONE_TEXT[overlay.kind].replace(/^./, (c) => c.toUpperCase())} um {formatTime(overlay.at)}
          </motion.p>
          {overlay.note && <p className="mx-auto mt-6 max-w-lg rounded-[20px] bg-pause-soft px-5 py-3 text-lg">{overlay.note}</p>}
        </div>
      );
    }
    case "queued":
      return (
        <div className="text-center" role="status">
          <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-surface-3">
            <WifiOff className="h-12 w-12" aria-hidden />
          </span>
          <h2 className="mt-8 text-4xl font-semibold">{overlay.label}</h2>
          <p className="mt-3 text-xl text-fg-2">Das Terminal ist offline. Deine Buchung wird übertragen, sobald es wieder Netz hat.</p>
        </div>
      );
    case "error":
      return (
        <div className="text-center" role="alert">
          <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-alert-soft">
            <X className="h-14 w-14 text-alert" aria-hidden />
          </span>
          <h2 className="mt-8 text-4xl font-semibold">{overlay.message}</h2>
        </div>
      );
    case "kiosk":
      return <KioskMenu onClose={() => show({ t: "none" })} onUnpaired={onUnpaired} />;
    default:
      return null;
  }
}

function KioskMenu({ onClose, onUnpaired }: { onClose: () => void; onUnpaired: () => void }) {
  const [unlocked, setUnlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!unlocked) {
    return (
      <div className="w-full">
        <h2 className="mb-2 flex items-center justify-center gap-2 text-center text-3xl font-semibold">
          <Lock className="h-7 w-7" aria-hidden /> Kiosk-PIN
        </h2>
        <p className="mb-8 text-center text-fg-2">{error ?? "Nur für Admins"}</p>
        <PinPad
          length={6}
          onCancel={onClose}
          onSubmit={async (pin) => {
            const { data } = await postJson<{ ok: boolean; error?: string }>("/api/terminal/session", { action: "unlock", pin }).catch(() => ({
              data: { ok: false, error: "Keine Verbindung" },
              status: 0,
            }));
            if (data.ok) setUnlocked(pin);
            else {
              playSound("error");
              setError(data.error ?? "Falsche PIN");
            }
          }}
        />
      </div>
    );
  }
  return (
    <div className="grid w-full max-w-md gap-3">
      <h2 className="mb-4 text-center text-3xl font-semibold">Terminal</h2>
      <Button size="xl" variant="secondary" onClick={() => void document.documentElement.requestFullscreen?.().then(onClose)}>
        <Expand className="h-6 w-6" aria-hidden /> Vollbild
      </Button>
      <Button size="xl" variant="secondary" onClick={() => window.location.reload()}>
        <RefreshCw className="h-6 w-6" aria-hidden /> Neu laden
      </Button>
      <Button
        size="xl"
        variant="danger"
        onClick={async () => {
          await postJson("/api/terminal/session", { action: "unpair", pin: unlocked });
          onUnpaired();
        }}
      >
        <Unlink className="h-6 w-6" aria-hidden /> Entkoppeln
      </Button>
      <Button size="lg" variant="ghost" onClick={onClose}>Schließen</Button>
    </div>
  );
}
