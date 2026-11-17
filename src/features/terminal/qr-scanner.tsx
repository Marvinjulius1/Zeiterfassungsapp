"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kamera-Scanner für QR-Codes (jsQR, läuft in jedem Browser mit Kamera).
 * Ruft onResult höchstens einmal pro erkanntem Code auf.
 */
export function QrScanner({
  onResult,
  facingMode = "environment",
  paused = false,
  className,
  mirrored,
}: {
  onResult: (text: string) => void;
  facingMode?: "environment" | "user";
  paused?: boolean;
  className?: string;
  mirrored?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const cb = useRef(onResult);
  const pausedRef = useRef(paused);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cb.current = onResult;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Diese Kamera wird vom Browser nicht unterstützt.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch {
        setError("Kein Kamerazugriff. Bitte erlaube die Kamera in den Browser-Einstellungen.");
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      tick();
    }

    function tick() {
      if (stopped) return;
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA && !pausedRef.current) {
        const w = 480;
        const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            const now = Date.now();
            if (code.data !== last.current.text || now - last.current.at > 4000) {
              last.current = { text: code.data, at: now };
              cb.current(code.data);
            }
          }
        }
      }
      raf = window.setTimeout(() => requestAnimationFrame(tick), 120) as unknown as number;
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  return (
    <div className={cn("relative overflow-hidden rounded-[24px] bg-surface-2", className)}>
      {error ? (
        <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-fg-2">
          <CameraOff className="h-6 w-6" aria-hidden />
          {error}
        </div>
      ) : (
        <>
          <video ref={video} playsInline muted className={cn("h-full w-full object-cover", mirrored && "-scale-x-100")} aria-label="Kamerabild" />
          <div className="pointer-events-none absolute inset-[18%] rounded-[24px] border-2 border-white/80" aria-hidden />
        </>
      )}
      <canvas ref={canvas} className="hidden" aria-hidden />
    </div>
  );
}
