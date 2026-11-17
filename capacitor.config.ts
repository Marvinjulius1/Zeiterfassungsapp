import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native Zeitgeist-App (iOS + Android).
 *
 * Die Oberfläche kommt vom Zeitgeist-Server (Server-Rendering, Server Actions, zentrale Daten).
 * Lokal ist das dein Mac (`pnpm dev`), später die Online-Adresse:
 *   CAP_SERVER_URL=https://app.deine-firma.de pnpm cap sync
 *
 * Ohne Verbindung zeigt die App die mitgelieferte Seite native-shell/offline.html.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "http://localhost:3000";
const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)/.test(serverUrl);

const config: CapacitorConfig = {
  // Eindeutige App-Kennung – vor der ersten Veröffentlichung auf deine eigene Domain ändern
  appId: "de.zeitgeist.app",
  appName: "Zeitgeist",
  webDir: "native-shell",
  backgroundColor: "#000000",
  appendUserAgent: "ZeitgeistApp",
  server: {
    url: serverUrl,
    appStartPath: "/start",
    // HTTP nur für die lokale Entwicklung; online immer HTTPS
    cleartext: isLocal,
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "never",
    preferredContentMode: "mobile",
    scheme: "Zeitgeist",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#000000",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
