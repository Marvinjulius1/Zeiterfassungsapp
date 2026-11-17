import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Zeitgeist – Zeiterfassung",
    short_name: "Zeitgeist",
    description: "Zeiterfassung, die Spaß macht. Für Teams in Deutschland.",
    lang: "de-DE",
    dir: "ltr",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Heute", url: "/app", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Meine Zeiten", url: "/app/zeiten", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Anträge", url: "/app/antraege", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
