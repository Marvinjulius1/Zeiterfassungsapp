"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { QrCode, ScanLine } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { ProgressRing } from "@/design-system/components/progress-ring";
import { Sheet } from "@/design-system/components/sheet";
import { haptic } from "@/lib/haptics";
import { extractCode, WINDOW_SECONDS } from "./crypto";
import { QrScanner } from "./qr-scanner";

/** Zwei weitere Erfassungswege auf dem Heute-Screen: Terminal-QR scannen · eigenen QR zeigen */
export function AppStampMethods() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ScanSheet />
      <MyQrSheet />
    </div>
  );
}

function ScanSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="QR-Code am Terminal scannen"
      description="Halte die Kamera auf den Code am Eingang."
      trigger={
        <Button variant="secondary" size="lg" block>
          <ScanLine className="h-5 w-5" aria-hidden /> QR scannen
        </Button>
      }
    >
      {open && (
        <div className="space-y-4">
          <QrScanner
            className="aspect-square w-full"
            onResult={(text) => {
              const code = extractCode(text);
              if (code?.startsWith("T1.")) {
                haptic("success");
                setOpen(false);
                router.push(`/scan?c=${encodeURIComponent(code)}`);
              } else setHint("Das ist kein Zeitgeist-Terminal-Code.");
            }}
          />
          <p className="text-center text-sm text-fg-2" aria-live="polite">
            {hint ?? "Tipp: Du kannst den Code auch einfach mit der normalen Kamera-App scannen."}
          </p>
        </div>
      )}
    </Sheet>
  );
}

function MyQrSheet() {
  const [open, setOpen] = useState(false);
  const [svg, setSvg] = useState("");
  const [left, setLeft] = useState(WINDOW_SECONDS);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let refresh: number | undefined;
    let countdown: number | undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/me/qr", { cache: "no-store" }).then((r) => r.json());
        if (cancelled || !res.ok) throw new Error();
        setSvg(await QRCode.toString(res.code, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }));
        setError(false);
        let s = res.secondsLeft as number;
        setLeft(s);
        window.clearInterval(countdown);
        countdown = window.setInterval(() => setLeft(Math.max(0, --s)), 1000);
        refresh = window.setTimeout(load, s * 1000 + 300);
      } catch {
        if (!cancelled) setError(true);
        refresh = window.setTimeout(load, 5000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      window.clearTimeout(refresh);
      window.clearInterval(countdown);
    };
  }, [open]);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Mein QR-Code"
      description="Halte ihn in die Kamera des Terminals."
      trigger={
        <Button variant="secondary" size="lg" block>
          <QrCode className="h-5 w-5" aria-hidden /> Mein QR
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-5 pb-2">
        <div className="w-full max-w-72 rounded-[24px] bg-white p-5" role="img" aria-label="Persönlicher QR-Code">
          {svg && !error ? <div className="[&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="aspect-square skeleton rounded-xl" />}
        </div>
        <div className="flex items-center gap-3 text-sm text-fg-2">
          <ProgressRing size={24} stroke={3} value={left / WINDOW_SECONDS} label={`Neuer Code in ${left} Sekunden`} />
          {error ? "Keine Verbindung – versuche es gleich erneut." : `Wechselt in ${left} s – Screenshots sind zwecklos.`}
        </div>
        <p className="text-center text-xs text-fg-3">Tipp: Bildschirmhelligkeit hoch, dann klappt es am schnellsten.</p>
      </div>
    </Sheet>
  );
}
