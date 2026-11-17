# zeitgeist.

Zeiterfassung, die Spaß macht – für Unternehmen in Deutschland.
Mitarbeiter-App (mobile first), Verwaltung (Desktop/Tablet) und Terminal-Modus in einer Next.js-App mit Supabase.

> Stand: **Phase 9 – Feinschliff (alle Phasen abgeschlossen)** (siehe [docs/PLAN.md](docs/PLAN.md) für Datenmodell, Screens und Roadmap)

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
| sara@zeitgeist.demo | Mitarbeiterin (Lager) | Tausch mit Lukas wartet auf Freigabe |
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

**Abwesenheiten & Schichten:**

- **Anträge** (als Marvin): Resturlaub live, „Urlaub“ öffnet einen Kalender (Feiertage markiert, Berufsschul- und freie Tage kosten keinen Urlaub, halbe Tage möglich), „Krank“ mit AU-Foto. Offene Anträge lassen sich zurückziehen.
- **Plan** (als Marvin): eigene Schichten mit „Tauschen“, Tauschanfragen an dich (z. B. als Lena zustimmen), Schichtbörse mit „Übernehmen“
- **Verwaltung → Schichtplan:** Wochenraster, Drag-and-drop zwischen Personen und Tagen, Klick auf eine Zelle legt eine Schicht an (mit Vorlagen Früh/Normal/Spät). Konflikte (Ruhezeit, Höchstarbeitszeit, Jugendschutz, Urlaub/Krankheit, Doppelbuchung) erscheinen rot mit Begründung. Neue Schichten sind Entwürfe, bis du die Woche veröffentlichst; das Team wird benachrichtigt. „Vorwoche kopieren“ spart Zeit.
- **Verwaltung → Abwesenheiten:** Monatskalender des Teams mit Feiertagen; Klick auf einen Tag trägt z. B. eine telefonische Krankmeldung ein
- **Freigaben** enthält jetzt auch Schichtbörse und Schichttausch, inklusive Konfliktvorschau **vor** der Genehmigung
- **Stundenkonto** rechnet jetzt richtig: Urlaub, Krankheit, Sonderurlaub und Berufsschule gelten als erfüllt, unbezahlte Abwesenheit hat kein Soll, Überstundenabbau zieht ab, Feiertage haben kein Soll, und fehlende Tage zählen als Minus. Gerechnet wird ab dem ersten erfassten Tag.
- **Vergessenes Ausstempeln:** Ein offener Block, der vor mehr als 16 h begann, läuft nicht weiter. Der Tag wird als unvollständig markiert, und man kann am nächsten Tag ganz normal einchecken. Die App zeigt einen Hinweis zum Nachtragen.

**Terminal** (Tablet am Eingang, im Browser einfach ein zweites Fenster):

- http://localhost:3000/terminal öffnen und den Demo-Kopplungscode **111111** (Köln) bzw. **222222** (Hamburg) eingeben. Eigene Codes erzeugst du unter Verwaltung → Standorte.
- **PIN eingeben:** Marvin `482915`, Lena `731406`, Noah `590327`. Wer ausgecheckt ist, wird eingecheckt; wer da ist, wählt „Pause“ oder „Gehen“.
- **RFID:** Ein USB-Leser tippt die Chip-Nummer plus Enter. Zum Testen `04A2BC11` schnell eintippen und Enter drücken (Lena).
- **Handy:** Den wechselnden QR-Code mit der Kamera scannen oder in der App unter Heute → „QR scannen“. Das Tablet begrüßt dich.
- **Eigener QR:** In der App unter Heute → „Mein QR“, dann am Terminal „Eigenen QR zeigen“.
- **Offline:** Netz am Tablet trennen, stempeln, Netz wieder an → wird nachgereicht und als offline markiert.
- **Kiosk-Menü:** Logo 1,5 s gedrückt halten, Kiosk-PIN `246810` → Vollbild, Neu laden, Entkoppeln.

**Verwaltung** (als Admin Sophie, am besten am Desktop):

- **Live:** Wer ist da, in Pause, erwartet, ohne Buchung, abwesend oder im Feierabend. Das Board aktualisiert sich in Echtzeit. Zum Ausprobieren in einem zweiten Fenster als Marvin einchecken.
- **Freigaben:** Korrekturen und Urlaub mit Vorher/Nachher. Tastatur: `J`/`K` wechseln, `A` genehmigen, `R` ablehnen. Auf dem Handy wischen.
- **Mitarbeiter:** Suchen mit `/`, einladen mit `N`, per Link, QR-Code oder E-Mail. Mehrfachauswahl für Standort, Team und Archiv. Detailseite mit Stammdaten, versioniertem Vertrag, Personalakte (Upload), Hinweisen und Verlauf.
- **Zeiten:** alle Personen pro Tag oder eine Person über 14 Tage. Ein Klick öffnet den Editor. Jede Korrektur braucht eine Begründung, alte Buchungen werden nur als ungültig markiert.
- **Audit-Log:** alle Änderungen mit Begründung und der Prüfung, ob die Hash-Kette unverändert ist
- **Einstellungen:** Firma, Aufbewahrung (≥ 24 Monate), Betriebsrat (§ 87 BetrVG), DSGVO
- **Standorte:** Geofence (inkl. „aktuellen Standort übernehmen“), Terminals anlegen, koppeln, entkoppeln, Online-Status. RFID-Chips weist du auf der Mitarbeiter-Detailseite zu.
- **⌘K** öffnet die Befehlspalette (Navigation, Aktionen, Personensuche). `G` + Buchstabe springt direkt, z. B. `G F` zu Freigaben, `G M` zu Mitarbeitern.
- Als **Teamleiter Jonas** siehst du nur dein Team und kein Audit-Log.

**Regeln & Arbeitsschutz** (als Admin Sophie):

- **Verwaltung → Regeln:** Regeln in Klartext, für die ganze Firma oder je Standort (Abweichungen sind als „eigene Regel“ markiert)
- Das **Dashboard** zeigt offene Verstöße der letzten 30 Tage. Die Demo enthält bewusst einen Tag über 10 h (Lena), eine zu kurze Ruhezeit (Lukas) und Nachtarbeit eines 17-Jährigen (Noah).
- Als **Noah** zwischen 20 und 6 Uhr einchecken → wird wegen der Nachtruhe blockiert (§ 14 JArbSchG)
- In „Meine Zeiten“ → Tag stehen die Hinweise des Tages mit Rechtsgrundlage
- Alle Regeln und Annahmen: [docs/COMPLIANCE.md](docs/COMPLIANCE.md)

**Berichte & Monatsabschluss** (Phase 8):

- Als **Marvin** → Zeiten → *Monat* → September: **„Monat bestätigen“** und **Stundenzettel (PDF)**. Oktober ist in der Demo schon abgeschlossen, der laufende Monat lässt sich erst nach Monatsende bestätigen.
- Als **Sophie** → **Verwaltung → Berichte**: Standard ist der Vormonat. Du siehst Ist, Soll, Saldo, Konto, Urlaub/Krank und den Status (offen, bestätigt, abgeschlossen) je Person. Offene Punkte wie fehlendes Ausstempeln oder offene Korrekturen werden markiert.
  - Exporte: **CSV** (Semikolon, für deutsches Excel), **Excel** (Übersicht + Tage) und **DATEV LODAS** (Bewegungsdaten je Lohnart).
  - Personen anhaken → **„Monat abschließen“**. Danach können nur noch Admins mit Begründung ändern. **Wieder öffnen** geht nur mit Begründung und wird im Audit-Log protokolliert.
  - ⚙️ neben DATEV: Berater- und Mandantennummer sowie Lohnarten.
- Als **Jonas** (Teamleiter): Berichte und CSV/Excel nur für das eigene Team, kein DATEV und kein Abschließen.
- Jeder Export fremder Daten wird im **Audit-Log** festgehalten.

> **DATEV-Hinweis:** Die Lohnarten-Nummern (100, 200, 300 …) sind Platzhalter. Bitte vor dem ersten echten Import mit eurem Steuerbüro abstimmen. Die Personalnummer muss der in LODAS entsprechen (nur Ziffern, max. 5 Stellen, z. B. „Z-003“ → 3). Erst eine Test-Datei importieren lassen.

**App, Offline & Benachrichtigungen** (Phase 9):

- **Glocke** oben rechts (App) bzw. neben dem Logo (Verwaltung): Genehmigungen, Tauschanfragen und neue Schichtpläne erscheinen **live**, ohne Neuladen. Zum Ausprobieren: als Sophie Saras Urlaub genehmigen, während Sara eingeloggt ist.
- **Push aufs Handy:** Profil → „Push auf diesem Gerät“ → „Testnachricht senden“. Lokal funktioniert das in Chrome/Edge/Firefox. Auf dem iPhone geht Push nur, wenn Zeitgeist zum Home-Bildschirm hinzugefügt ist (iOS 16.4+).
- **Installieren:** Im Browser „App installieren“ bzw. auf dem iPhone Teilen → „Zum Home-Bildschirm“.
- **Offline:** Im Production-Modus (`pnpm build && pnpm start`) startet „Heute“ auch ganz ohne Netz. Offline gestempelt wird gepuffert und automatisch nachgesendet, oben erscheint ein Offline-Hinweis. Beim Abmelden werden offline gespeicherte Seiten vom Gerät gelöscht.
- Im Entwicklungsmodus (`pnpm dev`) wird absichtlich nichts gecacht, damit Änderungen sofort sichtbar sind.

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
- **Terminals haben kein Benutzerkonto.** Sie werden per einmaligem Code gekoppelt und bekommen ein Geräte-Token (gespeichert nur als Hash). Gestempelt wird über `public.terminal_stamp()`, das nur der Server aufrufen darf.
- **Rotierende QR-Codes** (alle 30 s, HMAC-signiert, ±1 Fenster Toleranz): Das Terminal erzeugt sie lokal, also auch offline. Ein Foto ist nach spätestens 90 s wertlos. Persönliche QR-Codes berechnet nur der Server.
- **PIN & RFID:** Gespeichert wird nur ein HMAC je Firma. PINs vergibt das System (6-stellig, eindeutig), damit niemand über „schon vergeben“ fremde PINs erraten kann. Nach 5 Fehlversuchen sperrt das Terminal 5 Minuten.
- **Geofence:** Der Standort wird nur beim Einchecken per App geprüft und nur mit Einwilligung gespeichert; ohne Einwilligung verwirft die Datenbank die Koordinaten.
- **Doppel-Scan-Schutz:** Eine automatische Buchung innerhalb von 60 s nach der letzten wird abgewiesen.
- Zeitgesteuerte Jobs: `GET /api/cron/auto-checkout` (stündlich) und `GET /api/cron/nightly` (täglich), geschützt per `Authorization: Bearer $CRON_SECRET`.

**Bewusst getroffene Entscheidungen**

- Next.js 16 mit *Cache Components*: Session-abhängige Inhalte stehen hinter `<Suspense>` und zeigen Skeletons.
- Middleware heißt in Next 16 `proxy.ts`.
- Haptik nutzt die Vibration API – auf iPhones (Safari) gibt es sie nicht, dort bleibt es beim visuellen Feedback.

## Bekannte Grenzen

- **Sprache:** Die Oberfläche ist nur auf Deutsch, passend zum deutschen Arbeitsrecht. Eine englische Version wäre ein eigenes Projekt.
- **DATEV:** Export als LODAS-Importdatei, keine Direktschnittstelle (dafür braucht es eine DATEV-Partnerschaft). „Lohn und Gehalt“ (LuG) wird noch nicht unterstützt.
- **NFC** ist bewusst nicht umgesetzt: Statische NFC-Tags lassen sich kopieren, und Web NFC gibt es nur auf Android. RFID am Terminal deckt den Anwendungsfall sicherer ab.
- **Einladung per E-Mail** öffnet dein Mailprogramm mit vorbereitetem Text. Ein eigener Mailversand folgt mit der Produktionseinrichtung.
- **Offline** sind nur Seiten verfügbar, die auf dem Gerät schon einmal geöffnet wurden (Mitarbeiter-App und Terminal). Die Verwaltung braucht Netz.

## Produktion

1. **Supabase-Projekt** in der Region **eu-central-1 (Frankfurt)** anlegen (DSGVO: Daten bleiben in der EU). Einen Auftragsverarbeitungsvertrag (AVV) mit Supabase und dem Hoster abschließen.
2. Datenbank einspielen: `pnpm exec supabase link --project-ref <ref>` und `pnpm exec supabase db push`. **Kein** `seed.sql` in Produktion!
3. **Auth:** In Supabase → Authentication eigenes SMTP eintragen (z. B. Postmark, Brevo), die Site-URL setzen und die Vorlage aus `supabase/templates/` übernehmen.
4. **Hosting** (z. B. Vercel, Region Frankfurt `fra1`), dort die Umgebungsvariablen setzen:

   | Variable | Wert |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | aus Supabase → Settings → API |
   | `SUPABASE_SECRET_KEY` | Secret Key, **nur** serverseitig |
   | `CRON_SECRET` | langer Zufallswert |
   | `ZEITGEIST_PEPPER` | ≥ 32 Zeichen Zufall, **nie wieder ändern** |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `pnpm dlx web-push generate-vapid-keys` |
   | `NEXT_PUBLIC_DEMO_MODE` | **nicht setzen** |

5. **Zeitgesteuerte Jobs** mit Header `Authorization: Bearer $CRON_SECRET` einrichten:
   - `/api/cron/auto-checkout` stündlich
   - `/api/cron/nightly` täglich nachts
   - `/api/cron/push` optional alle 5 Minuten
6. **Erste Firma:** Mit der eigenen E-Mail anmelden → `/onboarding`.
7. Vor dem Start: Regeln mit Betriebsrat bzw. Datenschutzbeauftragtem abstimmen (§ 87 BetrVG) und DATEV-Lohnarten mit dem Steuerbüro.
