"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { toast } from "@/design-system/components/toaster";
import { Toggle } from "@/design-system/components/toggle";
import { isNativeApp } from "@/lib/native/platform";
import { ensureServiceWorker } from "@/lib/pwa/service-worker-registration";
import { removePushSubscription, savePushSubscription, sendTestPush } from "../actions";

type State = "loading" | "unsupported" | "ios-install" | "native" | "denied" | "off" | "on";

function base64UrlToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Push-Benachrichtigungen für dieses Gerät an/aus (+ Testnachricht) */
export function PushToggle({ showTest = false }: { showTest?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      // Native App: Push läuft dort über Apple/Google (APNs/FCM), nicht über den Browser
      if (isNativeApp()) return setState("native");
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !VAPID) {
        return setState(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = () =>
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await ensureServiceWorker();
        if (!reg) return setState("unsupported");
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID!) }));
        const res = await savePushSubscription(sub.toJSON());
        if (!res.ok) throw new Error(res.error);
        setState("on");
        toast.success("Push ist an", { description: "Du bekommst Bescheid, wenn etwas genehmigt wird oder der Schichtplan da ist." });
      } catch (e) {
        console.error(e);
        toast.error("Push konnte nicht aktiviert werden.");
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });

  const hint =
    state === "native"
      ? "Push-Nachrichten in der App werden aktiviert, sobald das Apple-Developer-Konto bzw. Firebase eingerichtet ist. Bis dahin zeigt die Glocke alles live."
      : state === "ios-install"
      ? "Auf dem iPhone geht Push nur, wenn Zeitgeist zum Home-Bildschirm hinzugefügt ist (Teilen → „Zum Home-Bildschirm“)."
      : state === "denied"
        ? "Benachrichtigungen sind im Browser blockiert. Du kannst sie in den Website-Einstellungen wieder erlauben."
        : state === "unsupported"
          ? "Dieser Browser unterstützt keine Push-Nachrichten."
          : "Genehmigungen, Tauschanfragen und neue Schichtpläne direkt aufs Gerät.";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-fg-2" aria-hidden />
          <div className="min-w-0">
            <p id="push-label" className="text-[15px] font-medium">
              Push auf diesem Gerät
            </p>
            <p className="text-sm text-fg-2">{hint}</p>
          </div>
        </div>
        {(state === "on" || state === "off" || state === "loading") && (
          <Toggle
            checked={state === "on"}
            disabled={pending || state === "loading"}
            onCheckedChange={(v) => (v ? enable() : disable())}
            label="Push auf diesem Gerät"
          />
        )}
      </div>
      {showTest && state === "on" && (
        <Button
          variant="secondary"
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await sendTestPush();
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.data?.sent ? "Testnachricht gesendet" : "Gesendet – aber kein Gerät erreicht");
            })
          }
        >
          Testnachricht senden
        </Button>
      )}
    </div>
  );
}
