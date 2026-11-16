# zeitgeist.

Zeiterfassung, die Spaß macht – für Unternehmen in Deutschland.
Mitarbeiter-App (mobile first), Verwaltung (Desktop/Tablet) und Terminal-Modus in einer Next.js-App mit Supabase.

> Stand: **Phase 4 – Regel-Engine & Compliance** (siehe [docs/PLAN.md](docs/PLAN.md) für Datenmodell, Screens und Roadmap)

---

## Voraussetzungen

| Tool | Version |
|---|---|
| Node.js | ≥ 22 |
| pnpm | ≥ 10 (`corepack enable`) |
| Docker | läuft (für lokales Supabase) |

## Setup in 4 Schritten

```bash
pnpm install
```

```bash
pnpm db:start
```

Startet Postgres, Auth, Storage, Realtime und das Mail-Postfach lokal in Docker. Beim ersten Mal dauert das ein paar Minuten (Images werden geladen). Migrationen und Demo-Daten werden automatisch eingespielt.

```bash
cp .env.example .env.local
```

Trag in `.env.local` den `PUBLISHABLE_KEY` und den `SECRET_KEY` (als `SUPABASE_SECRET_KEY`) ein, die `pnpm exec supabase status` anzeigt, und setze ein beliebiges `CRON_SECRET`.

```bash
pnpm dev
```

→ http://localhost:3000

## Anmelden

**Schnell-Login (nur lokal):** Auf `/login` gibt es Demo-Zugänge mit einem Tipp (aktiv, solange `NEXT_PUBLIC_DEMO_MODE=true`).

**Wie in echt:** E-Mail eingeben → Mail mit 6-stelligem Code und Magic Link landet im lokalen Postfach **Mailpit**: http://127.0.0.1:54324

| Login | Rolle | Besonderheit |
|---|---|---|
| owner@zeitgeist.demo | Owner | darf alles |
| admin@zeitgeist.demo | Admin | |
| teamlead@zeitgeist.demo | Teamleiter | sieht nur Team „Service" (6 Personen) |
| marvin@zeitgeist.demo | Mitarbeiter, Azubi | Berufsschule dienstags |
| noah@zeitgeist.demo | Mitarbeiter, Azubi, 17 J. | Jugendarbeitsschutz |
| anna@zeitgeist.demo | Mitarbeiterin | Mutterschutz-Flag |
| tim@ / mia@zeitgeist.demo | Minijob | MiLoG-Dokumentation |
| lena@, mehmet@, sara@, lukas@, emilia@ | Mitarbeiter | |

Demo-Passwort für alle: `zeitgeist-demo`. Die Demo-Firma heißt *Zeitgeist Demo GmbH* (Standorte Köln + Hamburg) und hat 8 Wochen Buchungshistorie, offene Anträge und einen abgeschlossenen Vormonat.

## Was du ausprobieren kannst

**Mitarbeiter-App** (z. B. als Marvin, am besten in der Handy-Ansicht der Browser-Entwicklertools):

- **Heute:** großen Button gedrückt halten → eingecheckt, Live-Uhr läuft, Ring füllt sich
- „Pause starten" → orange Pausen-Uhr; „Weiter" gedrückt halten → zurück an die Arbeit
- Hinweise erscheinen automatisch, z. B. „Gesetzliche Pause fällig in 12 Min." (§ 4 ArbZG) oder für Noah (17) schon nach 4,5 h
- **Offline:** In den DevTools „Offline" wählen und stempeln → „1 Buchung wartet" → wieder online → wird automatisch synchronisiert
- **Zeiten:** Stundenkonto, Woche als Chart, Monat als Liste, Tagesdetail mit Zeitstrahl → „Korrektur beantragen"
- **Anträge:** Status deiner Korrekturen

**Regeln & Arbeitsschutz** (als Admin Sophie):

- **Verwaltung → Regeln:** Regeln in Klartext, für die ganze Firma oder je Standort (Abweichungen sind als „eigene Regel“ markiert)
- Das **Dashboard** zeigt offene Verstöße der letzten 30 Tage. Die Demo enthält bewusst einen Tag über 10 h (Lena), eine zu kurze Ruhezeit (Lukas) und Nachtarbeit eines 17-Jährigen (Noah).
- Als **Noah** zwischen 20 und 6 Uhr einchecken → wird wegen der Nachtruhe blockiert (§ 14 JArbSchG)
- In „Meine Zeiten“ → Tag stehen die Hinweise des Tages mit Rechtsgrundlage
- Alle Regeln und Annahmen: [docs/COMPLIANCE.md](docs/COMPLIANCE.md)

**Allgemein:**

- `/` – Startseite mit Live-Uhr
- `/design` – **Komponenten-Showcase**: alle Bausteine, Hell/Dunkel, Hold-to-check-in
- `/login` → Mitarbeiter landen in `/app`, Owner/Admin/Teamleiter in `/admin`
- Als Mitarbeiter `/admin` öffnen → „Kein Zugriff"
- Mit einer neuen E-Mail anmelden → `/onboarding` (Firma in 3 Schritten anlegen)
- Supabase Studio (Datenbank ansehen): http://127.0.0.1:54323

## Befehle

| Befehl | Zweck |
|---|---|
| `pnpm dev` | Entwicklungsserver |
| `pnpm build && pnpm start` | Produktions-Build |
| `pnpm test` | Unit-Tests (Vitest) |
| `pnpm db:test` | Datenbank-Tests: RLS, Unveränderlichkeit, Audit-Kette (pgTAP) |
| `pnpm db:reset` | Datenbank neu aufsetzen inkl. Demo-Daten und Compliance-Bewertung |
| `pnpm compliance:run` | alle Personen neu bewerten (Standard: letzte 50 Tage) |
| `pnpm db:types` | TypeScript-Typen aus dem Schema erzeugen |
| `pnpm check` | Typecheck + Lint + alle Tests |
| `pnpm db:stop` | Supabase-Container stoppen |

## Architektur in Kürze

```
src/
├─ app/                Routen (App Router)
│  ├─ (employee)/app   Mitarbeiter-App, Bottom-Tabs
│  ├─ (admin)/admin    Verwaltung, Sidebar
│  ├─ login, onboarding, invite/[token], design
│  └─ auth/callback, start   Magic-Link-Ziel, Verteiler nach Rolle
├─ design-system/      Tokens + Komponenten (Button, Card, Sheet, Toggle, BigNumber,
│                      RollingNumber, StatusPill, ProgressRing, HoldButton, WeekChart …)
├─ lib/                supabase/ (Clients, Typen), auth/ (Session, Rollen), time/, haptics
└─ proxy.ts            Session-Refresh + Schutz privater Routen
supabase/
├─ migrations/         Schema, RLS, Audit-Log, RPCs
├─ seed.sql            Demo-Daten
├─ templates/          deutsche Login-Mail
└─ tests/              pgTAP-Tests
```

**Sicherheitsprinzipien**

- Row Level Security auf **jeder** Tabelle; Mitarbeiter sehen nur sich, Teamleiter ihr Team, Admins die Firma.
- Zeitbuchungen sind **append-only**: kein Löschen, kein Überschreiben – Korrekturen sind neue Einträge.
- Jede Änderung landet automatisch im **Audit-Log** mit SHA-256-Hash-Kette (`verify_audit_chain()`).
- Gesperrte Monate lassen sich nur über protokollierte Korrekturen ändern.
- Stempel-Geheimnisse (PIN, QR-Secret, RFID) liegen in eigenen Tabellen ohne Lese-Policy.
- Gestempelt wird nur über `public.stamp()`: Online zählt immer die **Serverzeit** (kein Zurückdatieren). Offline-Buchungen behalten die Gerätezeit, höchstens 72 h alt, und werden als `was_offline` markiert. Jede Buchung hat eine Client-UUID, deshalb legt ein doppelter Sync nichts doppelt an.
- `work_days` wird bei jeder Buchung automatisch per Trigger neu berechnet.
- **Regeln an genau einer Stelle:** `src/compliance` (reines TypeScript, 160+ Tests). Vor dem Stempeln prüft `/api/stamp` (warnen oder blockieren je nach Firmenregel), danach wird der Tag bewertet und die Verstöße werden gespeichert. Blockiert wird nur das Einchecken, nie Pause oder Auschecken. Offline-Nachträge werden nie blockiert.
- Zeitgesteuerte Jobs: `GET /api/cron/auto-checkout` (stündlich) und `GET /api/cron/nightly` (täglich), geschützt per `Authorization: Bearer $CRON_SECRET`.

**Bewusst getroffene Entscheidungen**

- Next.js 16 mit *Cache Components*: Session-abhängige Inhalte stehen hinter `<Suspense>` und zeigen Skeletons.
- Middleware heißt in Next 16 `proxy.ts`.
- Haptik nutzt die Vibration API – auf iPhones (Safari) gibt es sie nicht, dort bleibt es beim visuellen Feedback.

## Bekannte Grenzen (werden in späteren Phasen gelöst)

- **Stundenkonto:** Es zählt nur Tage mit Buchungen. Urlaub und Krankheit fließen ab Phase 7 ein. Rundung und Pausenabzug wirken bereits.
- **Verstöße quittieren** und Benachrichtigungen an Teamleiter kommen mit der Verwaltung (Phase 5), Push-Nachrichten in Phase 9.
- **Geofence-Pflicht** lässt sich einstellen. Die Standortabfrage in der App kommt mit Phase 6.
- **Korrekturanträge:** Sie werden gespeichert, Freigabe und Übernahme folgen mit der Verwaltung in Phase 5.
- **Offline:** Der Puffer greift, solange die App geöffnet ist. Das Öffnen der App ganz ohne Netz (Service Worker) folgt in Phase 9.

## Produktion (später)

Supabase-Projekt in **eu-central-1 (Frankfurt)** anlegen, `supabase link` + `supabase db push`, Auth-SMTP konfigurieren, `NEXT_PUBLIC_DEMO_MODE` **nicht** setzen. Details folgen in Phase 9.
