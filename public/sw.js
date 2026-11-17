/* Zeitgeist Service Worker
 *
 * - App-Hülle offline: Seiten der Mitarbeiter-App und des Terminals werden nach jedem
 *   erfolgreichen Laden gespeichert ("network first") und ohne Netz aus dem Cache gezeigt.
 * - Next-Assets (/_next/static) sind unveränderlich → "cache first".
 * - Nie gecacht: API, Auth, Server Actions, RSC-Anfragen (Next prüft darüber die Verbindung).
 * - Beim Abmelden löscht die App den Seiten-Cache (Nachricht "logout").
 * - Push-Benachrichtigungen + Klick öffnet die passende Seite.
 */
const VERSION = "zg-v3";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/badge-96.png"];
/** Seiten, die offline verfügbar sein sollen */
const OFFLINE_PAGES = ["/app", "/terminal"];

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

/** Hülle + alle Skripte/Styles der Offline-Seite, damit sie ohne Netz auch hydrieren kann */
async function precache() {
  const shell = await caches.open(SHELL);
  await shell.addAll(PRECACHE);
  const html = await (await shell.match("/offline")).text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]))];
  const statics = await caches.open(STATIC);
  await Promise.all(assets.map((a) => statics.add(a).catch(() => undefined)));
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Entwicklungsmodus: nur Push, kein Caching (sonst stören gespeicherte Dev-Chunks den Hot Reload) */
const NO_CACHE = new URL(self.location.href).searchParams.has("nocache");

const isOfflinePage = (path) => OFFLINE_PAGES.some((p) => path === p || path.startsWith(`${p}/`));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (NO_CACHE || req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  // RSC-Payloads, Prefetches und Next' Verbindungsprüfung nie aus dem Cache beantworten
  if (req.headers.get("RSC") || url.searchParams.has("_rsc") || req.headers.get("Next-Router-Prefetch")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req, url));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) (await caches.open(STATIC)).put(req, res.clone());
  return res;
}

async function networkFirstPage(req, url) {
  try {
    const res = await fetch(req);
    // Nur echte Seiten (keine Weiterleitung zum Login) offline merken
    if (res.ok && !res.redirected && isOfflinePage(url.pathname)) {
      (await caches.open(PAGES)).put(url.pathname + url.search, res.clone());
    }
    return res;
  } catch {
    // Nur exakt diese Seite aus dem Cache – fremdes HTML unter falscher Adresse verwirrt den Router
    const pages = await caches.open(PAGES);
    const cached = (await pages.match(url.pathname + url.search)) || (await pages.match(url.pathname));
    if (cached) return cached;
    if (url.pathname === "/offline") return (await caches.match("/offline")) || Response.error();
    return Response.redirect(`/offline?von=${encodeURIComponent(url.pathname + url.search)}`, 302);
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "logout") event.waitUntil(caches.delete(PAGES));
});

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Zeitgeist", body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Zeitgeist", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      lang: "de",
      data: { url: data.url || "/start" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/start", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) return open.navigate(target).then((c) => (c || open).focus());
      return self.clients.openWindow(target);
    }),
  );
});
