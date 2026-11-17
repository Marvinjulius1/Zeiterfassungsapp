import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNativeApp } from "./platform";

function filenameFrom(res: Response, fallback: string) {
  const cd = res.headers.get("content-disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="([^"]+)"/i.exec(cd);
  return plain?.[1] ?? fallback;
}

function toBase64(buf: ArrayBuffer) {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Datei „herunterladen“.
 * Browser: normaler Download. Native App: Datei in den Cache legen und das Teilen-Menü öffnen
 * (Vorschau, In Dateien sichern, Drucken, per Mail senden) – WebViews können keine Downloads.
 * Gibt false zurück, wenn der Browser den Link selbst behandeln soll.
 */
export async function downloadInApp(url: string, fallbackName = "Zeitgeist-Datei"): Promise<boolean> {
  if (!isNativeApp()) return false;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(res.status === 403 ? "Keine Berechtigung" : "Download fehlgeschlagen");
  const name = filenameFrom(res, fallbackName).replace(/[\\/:*?"<>|]/g, "-");
  const file = await Filesystem.writeFile({ path: name, data: toBase64(await res.arrayBuffer()), directory: Directory.Cache });
  await Share.share({ title: name, files: [file.uri] });
  return true;
}
