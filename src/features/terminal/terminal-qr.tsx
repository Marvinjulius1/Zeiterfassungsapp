"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ProgressRing } from "@/design-system/components/progress-ring";
import { makeCode, secondsLeft, WINDOW_SECONDS, windowOf } from "./crypto";

/**
 * Rotierender, signierter QR-Code. Wird lokal berechnet – funktioniert also
 * auch, wenn das Terminal kurz offline ist. `offsetMs` gleicht die Uhr mit dem Server ab.
 */
export function TerminalQr({ terminalId, secret, offsetMs }: { terminalId: string; secret: string; offsetMs: number }) {
  const [svg, setSvg] = useState("");
  const [left, setLeft] = useState(WINDOW_SECONDS);

  useEffect(() => {
    let lastWindow = -1;
    let cancelled = false;
    const tick = async () => {
      const now = Date.now() + offsetMs;
      setLeft(secondsLeft(now));
      const w = windowOf(now);
      if (w === lastWindow) return;
      lastWindow = w;
      const code = await makeCode("T1", terminalId, secret, now);
      const url = `${window.location.origin}/scan?c=${code}`;
      const out = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
      if (!cancelled) setSvg(out);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [terminalId, secret, offsetMs]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative rounded-[28px] bg-white p-5" role="img" aria-label="Wechselnder QR-Code zum Stempeln mit dem Handy">
        <div className="h-[min(42vh,340px)] w-[min(42vh,340px)] [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <div className="flex items-center gap-3 text-fg-2">
        <ProgressRing size={28} stroke={3} value={left / WINDOW_SECONDS} tone="fg" label={`Neuer Code in ${left} Sekunden`} />
        <span className="tabular text-sm">Neuer Code in {left} s</span>
      </div>
    </div>
  );
}
