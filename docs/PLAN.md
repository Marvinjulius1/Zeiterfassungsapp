# Zeitgeist – Phase 1: Plan

> Status: **Entwurf, wartet auf Freigabe.** Nach dem OK startet Phase 2 (Fundament).

---

## 0. Leitentscheidungen (Kurzfassung)

| Thema | Entscheidung | Warum |
|---|---|---|
| Repo-Form | **Eine** Next.js-App + `supabase/`-Ordner, Compliance als reines TS-Modul (`src/compliance`) | Einfach zu starten, kein Monorepo-Overhead. Compliance hat **keine** Abhängigkeit zu React/Supabase → später als Paket extrahierbar und in Edge Functions wiederverwendbar. |
| Paketmanager | pnpm | schnell, strikt |
| Stack | Next.js (App Router, aktuelle stabile Version), TypeScript strict, Tailwind v4, Framer Motion, shadcn/ui (umgestylt), Recharts, date-fns + `@date-fns/tz` (Europe/Berlin), Zod | wie gewünscht |
| Backend | Supabase (Postgres, Auth, RLS, Realtime, Storage, Edge Functions), Region **eu-central-1 (Frankfurt)** | DSGVO |
| Zeit-Datenmodell | **Append-only Ereignis-Log** (`time_events`) als Wahrheit + abgeleitete Tageswerte (`work_days`) | Manipulationssicher, offline-tauglich (Client-UUIDs, idempotent), Korrekturen = neue Ereignisse statt Überschreiben |
| Rohzeit vs. Lohnzeit | Rohzeit wird **immer unverändert** gespeichert; Rundung/Pausenabzug wirken nur auf die *bewertete* Zeit | Erfassungspflicht verlangt echte Zeiten; Rundung zulasten des MA ist rechtlich heikel |
| Audit | Eigene Tabelle, nur INSERT erlaubt (Trigger blockt UPDATE/DELETE), **Hash-Kette** (`prev_hash` → `hash`) | Nachweisbar manipulationssicher |
| Tests | Vitest (Unit, v. a. `compliance/`), Playwright (E2E-Kernflows), pgTAP-ähnliche SQL-Tests für RLS | |
| i18n | `next-intl`, DE Standard, EN zweitsprachig; Du-Form in der MA-App, Sie-neutral in der Verwaltung | |

### Ehrliche technische Grenzen (wichtig für Erwartungen)
- **Haptik:** Die Vibration API funktioniert auf Android, **nicht in iOS Safari**. Auf dem iPhone ersetzen wir Haptik durch eine visuelle/akustische Bestätigung.
- **NFC in der App:** Web NFC gibt es nur in Chrome auf Android. Für das **Terminal** nutzen wir stattdessen handelsübliche USB/Bluetooth-RFID-Leser, die sich wie eine Tastatur verhalten – das funktioniert auf jedem Tablet.
- **Geofencing:** Eine PWA kann (und soll) nicht im Hintergrund orten. Wir prüfen den Standort **nur im Moment des Stempelns** – genau das ist datenschutzrechtlich gewollt.
- **Push auf iPhone:** Web Push klappt ab iOS 16.4, aber nur wenn die PWA zum Home-Bildschirm hinzugefügt wurde. Das Onboarding weist darauf hin.
- **Recht:** Ich setze die Regeln sorgfältig nach Gesetzeswortlaut um, ersetze aber keine Rechtsberatung. Alle Grenzwerte liegen zentral in `compliance/` und sind dokumentiert.

---

## 1. Ordnerstruktur

```
zeitgeist/
├─ README.md                       Setup-Anleitung
├─ docs/
│  ├─ PLAN.md                      dieses Dokument
│  ├─ COMPLIANCE.md                Regel-für-Regel-Doku mit Paragraphen
│  └─ ARCHITECTURE.md
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                  0001_core.sql, 0002_time.sql, 0003_rls.sql, …
│  ├─ seed.sql                     Demo-Firma, Admin, 10 MA, 8 Wochen Historie
│  ├─ tests/                       RLS-Tests (SQL)
│  └─ functions/                   Edge Functions (Deno)
│     ├─ terminal-token/           signiert rotierende QR-Tokens
│     ├─ stamp/                    zentrale Stempel-Logik (alle Wege)
│     ├─ recompute-day/            work_days + Verstöße neu berechnen
│     ├─ auto-checkout/            Cron: vergessenes Ausstempeln
│     ├─ milog-check/              Cron: fehlende Tage > 7 Tage
│     ├─ push-dispatch/            Web-Push versenden
│     └─ export-datev/             Lohnexport
├─ public/                         Icons, Manifest-Assets, Sounds
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login, /invite/[token], /onboarding
│  │  ├─ (employee)/app/…          Mitarbeiter-App (Bottom-Tabs)
│  │  ├─ (admin)/admin/…           Verwaltung (Sidebar)
│  │  ├─ terminal/[terminalId]/    Kiosk-Modus
│  │  ├─ design/                   Komponenten-Showcase
│  │  ├─ api/                      Route Handler (z. B. Export-Downloads)
│  │  ├─ manifest.ts, sw.ts        PWA
│  │  └─ layout.tsx
│  ├─ design-system/
│  │  ├─ tokens.css                Farben, Radien, Spacing, Motion (CSS-Variablen)
│  │  ├─ motion.ts                 Spring-Presets, reduced-motion-Helper
│  │  └─ components/               Button, Card, Sheet, Toggle, Slider, BigNumber,
│  │                               RollingNumber, StatusPill, ProgressRing, HoldButton,
│  │                               Skeleton, EmptyState, ListRow, Segmented, Avatar,
│  │                               Tabs, Sidebar, BottomBar, CommandPalette, Toast …
│  ├─ compliance/                  ★ reines TypeScript, keine UI/DB-Abhängigkeit
│  │  ├─ types.ts                  WorkDay, Interval, EmployeeProfile, Violation …
│  │  ├─ arbzg/                    max-daily, breaks, rest-period, sunday-holiday, averaging
│  │  ├─ jarbschg/                 Jugendarbeitsschutz
│  │  ├─ muschg/                   Mutterschutz
│  │  ├─ milog/                    Dokumentationsfrist
│  │  ├─ holidays/                 Feiertage je Bundesland (inkl. Ostern-Berechnung)
│  │  ├─ rules-engine/             Firmenregeln: Rundung, Auto-Pause, Fenster, Zuschläge
│  │  ├─ evaluate.ts               Einstieg: evaluateDay(), evaluateWeek(), canStamp()
│  │  └─ __tests__/
│  ├─ features/                    fachliche Module (Hooks, Server Actions, UI-Teile)
│  │  ├─ stamping/  breaks/  timesheet/  corrections/  absences/
│  │  ├─ shifts/  approvals/  employees/  reports/  month-close/
│  │  ├─ terminal/  rules/  audit/  notifications/  onboarding/
│  ├─ lib/
│  │  ├─ supabase/                 server/client/middleware Clients, generierte Typen
│  │  ├─ offline/                  IndexedDB-Queue (Dexie), Sync-Worker
│  │  ├─ time/                     Berlin-TZ-Helfer, Formatter (6:42:18, 7,5 h)
│  │  ├─ haptics.ts, sound.ts
│  │  └─ auth/                     Rollen-Guards
│  ├─ i18n/  de.json, en.json
│  └─ middleware.ts
├─ tests/e2e/                      Playwright
└─ package.json, tsconfig.json, vitest.config.ts, playwright.config.ts
```

---

## 2. Datenmodell

### 2.1 Überblick (Beziehungen)

```
organizations ─┬─< locations ─┬─< terminals
               │              └─< teams
               ├─< memberships >── profiles (= auth.users)
               │      ├─< employment_contracts   (zeitlich versioniert)
               │      ├─< time_events            (append-only)
               │      ├─< work_days              (abgeleitet)
               │      ├─< compliance_violations
               │      ├─< correction_requests
               │      ├─< absences ── absence_types
               │      ├─< shifts ─< shift_swap_requests / shift_claims
               │      ├─< documents (Storage)
               │      ├─< month_closings
               │      └─< time_account_adjustments
               ├─< rule_sets      (Firma → Standort → Mitarbeiter, überschreibend)
               ├─< projects
               ├─< invitations
               └─< audit_log      (append-only, Hash-Kette)
```

Alle fachlichen Tabellen tragen `org_id` → einheitliche RLS. Keine Tabelle mit Zeitbezug wird hart gelöscht (`archived_at` / `voided_by`).

### 2.2 Tabellen

**Mandanten & Personen**

| Tabelle | Wichtige Spalten |
|---|---|
| `organizations` | id, name, slug, default_state (Bundesland, z. B. `NW`), timezone (`Europe/Berlin`), retention_months (≥ 24), has_works_council, created_at |
| `locations` | id, org_id, name, address, state (Bundesland für Feiertage), geofence (lat, lng, radius_m, nullable), timezone |
| `teams` | id, org_id, location_id, name, lead_membership_id, parent_team_id (Organigramm) |
| `profiles` | id (= auth.users.id), full_name, avatar_path, locale, theme |
| `memberships` | id, org_id, user_id (nullable bis Einladung angenommen), role (`owner`/`admin`/`team_lead`/`employee`), location_id, team_id, employee_no, birth_date (nur für JArbSchG), maternity_protection bool, status (`invited`/`active`/`archived`), pin_hash, personal_qr_secret, rfid_uid_hash |
| `employment_contracts` | id, membership_id, valid_from, valid_to, type (`minijob`/`part_time`/`full_time`/`apprentice`/`working_student`), weekly_hours, daily_targets (jsonb Mo–So), vacation_days_per_year, school_days (jsonb, Azubis), hourly_wage_cents (optional, MiLoG) |
| `invitations` | id, org_id, email (nullable bei QR), role, location_id, token_hash, expires_at, accepted_at |

**Zeiterfassung**

| Tabelle | Wichtige Spalten |
|---|---|
| `time_events` | id (**Client-UUID** → idempotent), org_id, membership_id, kind (`check_in`/`break_start`/`break_end`/`check_out`), occurred_at, received_at (Server), source (`app`/`terminal_qr`/`personal_qr`/`pin`/`rfid`/`nfc`/`admin`/`system_auto`), terminal_id, project_id, geo (lat/lng/accuracy, nur mit Einwilligung), was_offline, supersedes_id, voided_at, voided_by, void_reason |
| `work_days` | membership_id, date, first_in, last_out, gross_minutes, break_minutes, net_minutes, valued_minutes (nach Rundung/Auto-Pause), target_minutes, surcharges (jsonb), status (`open`/`complete`/`incomplete`), recomputed_at – **nur vom System geschrieben** |
| `compliance_violations` | id, org_id, membership_id, date, code (`ARBZG_MAX_DAILY`, `ARBZG_BREAK`, `ARBZG_REST`, `JARBSCHG_NIGHT`, `MILOG_LATE` …), severity (`info`/`warning`/`violation`), details jsonb, acknowledged_by/at |
| `correction_requests` | id, membership_id, kind (`missing_check_in`/`wrong_time`/`missing_break`/…), proposed (jsonb Ereignisse), reason, status (`pending`/`approved`/`rejected`), reviewed_by/at, review_note |
| `time_account_adjustments` | id, membership_id, minutes (+/–), reason (`payout`/`carry_over`/`manual`), effective_date, created_by |
| `projects` | id, org_id, name, cost_center, active |

**Regeln, Terminals**

| Tabelle | Wichtige Spalten |
|---|---|
| `rule_sets` | id, org_id, scope (`org`/`location`/`membership`), scope_id, settings (jsonb, per Zod typisiert & versioniert), version, updated_by – effektive Regeln = Firma ⊕ Standort ⊕ Person |
| `terminals` | id, org_id, location_id, name, secret (in Supabase Vault), kiosk_pin_hash, allowed_methods, last_seen_at, revoked_at |
| `geo_consents` | membership_id, granted_at, revoked_at, text_version |

**Abwesenheiten & Schichten**

| Tabelle | Wichtige Spalten |
|---|---|
| `absence_types` | id, org_id, key (`vacation`/`sick`/`school`/`special`/`unpaid`/`comp_time`), label, counts_as_work, deducts_vacation |
| `absences` | id, membership_id, type_id, start_date, end_date, half_day_start/end, status, attachment_path (AU), substitute_membership_id, reviewed_by/at |
| `vacation_entitlements` | membership_id, year, days, carried_over, expires_on |
| `shift_templates` | id, org_id, location_id, name, start_time, end_time, break_minutes, color_token |
| `shifts` | id, org_id, location_id, membership_id (**null = offene Schicht/Schichtbörse**), starts_at, ends_at, break_minutes, project_id, status (`draft`/`published`), template_id |
| `shift_swap_requests` | id, shift_id, requester_id, target_membership_id (nullable), offered_shift_id, status, decided_by |
| `shift_claims` | id, shift_id, membership_id, status |

**Abschluss, Akte, Protokoll, Benachrichtigung**

| Tabelle | Wichtige Spalten |
|---|---|
| `month_closings` | id, org_id, membership_id, month, employee_confirmed_at, locked_at, locked_by, snapshot (jsonb), pdf_path |
| `documents` | id, membership_id, category (`contract`/`sick_note`/`certificate`/`other`), storage_path, uploaded_by, retain_until |
| `audit_log` | id (bigserial), org_id, actor_id, actor_kind (`user`/`system`/`terminal`), entity, entity_id, action, old_value, new_value, reason, created_at, prev_hash, hash |
| `notifications` | id, user_id, kind, payload, read_at |
| `push_subscriptions` | id, user_id, endpoint, p256dh, auth |
| `data_requests` | DSGVO-Export/Löschung: membership_id, kind, status, file_path |

### 2.3 Schutzmechanismen in der Datenbank
- `time_events`, `audit_log`: Trigger verhindert UPDATE/DELETE (Ausnahme bei `time_events`: Setzen von `voided_*` einmalig, über Funktion mit Audit-Eintrag).
- Gesperrter Monat (`month_closings.locked_at`): Trigger blockt neue/ungültig gemachte Ereignisse in diesem Monat, außer über `admin_correct_locked()` mit Pflicht-Begründung → Audit.
- Jede schreibende Admin-Aktion läuft über `SECURITY DEFINER`-Funktionen, die **automatisch** in `audit_log` schreiben – kein Weg am Protokoll vorbei.
- Löschfristen: Cron löscht/anonymisiert erst nach `retention_months`; Audit-Einträge bleiben pseudonymisiert erhalten.

### 2.4 RLS-Policies (Prinzip)

Hilfsfunktionen (`SECURITY DEFINER`, `stable`):
`my_membership_ids()`, `my_role(org_id)`, `is_org_admin(org_id)` (owner|admin), `leads_membership(membership_id)` (Team-Lead des Teams inkl. Unterteams).

| Tabelle | Mitarbeiter | Teamleiter | Admin/Owner |
|---|---|---|---|
| organizations, locations | lesen (eigene Firma) | lesen | lesen/schreiben (Owner: löschen/Abrechnung) |
| memberships | eigene lesen | eigenes Team lesen | alle der Firma |
| employment_contracts | eigene lesen | Team lesen (ohne Lohn) | alle |
| time_events | eigene lesen; **INSERT nur via `stamp`-Funktion** | Team lesen | alle lesen; Korrektur via Funktion |
| work_days, violations | eigene | Team | alle |
| correction_requests, absences, swaps | eigene anlegen/lesen | Team freigeben | alle |
| shifts | eigene + offene lesen | Team planen | alle |
| documents (+ Storage-Bucket) | eigene lesen, AU hochladen | – | alle |
| audit_log | – | Team lesen | lesen (nie schreiben) |
| rule_sets, terminals, projects | effektive Regeln lesen | lesen | schreiben |

Storage-Buckets privat, Pfad `org_id/membership_id/…`, Policies analog. Terminals authentifizieren sich mit eigenem, eingeschränktem JWT (Rolle `terminal`, nur `stamp` + Namensgruß).

### 2.5 Rotierender Terminal-QR
Token = `base64url(terminalId | zeitfenster | HMAC_SHA256(secret, terminalId|zeitfenster))`, Fenster 30 s, akzeptiert aktuelles ± 1 Fenster (Uhren-Toleranz). Der Server prüft Signatur, Fenster und dass das Token nicht schon von dieser Person benutzt wurde. Ein Foto von zu Hause ist nach max. 60 s wertlos. Funktioniert am Tablet auch offline (Secret liegt im Terminal, Prüfung erst beim Sync – Zeitstempel kommt dann vom Gerät des MA *und* wird gegen das Fenster geprüft).

### 2.6 Offline
Client erzeugt `time_events` mit UUID + Gerätezeit → IndexedDB-Queue → Sync, sobald online (Background Sync wo verfügbar, sonst beim nächsten Öffnen). Server speichert `received_at`; große Abweichungen werden markiert, nicht verworfen.

---

## 3. Compliance-Service (`src/compliance`) – was getestet wird

| Regel | Quelle | Verhalten |
|---|---|---|
| Höchstarbeitszeit 8 h / bis 10 h | § 3 ArbZG | Warnung > 8 h, Verstoß > 10 h; 6-Monats-/24-Wochen-Durchschnitt (≤ 8 h je Werktag Mo–Sa) wird berechnet & angezeigt |
| Ruhepausen 30/45 Min., Blöcke ≥ 15 Min., max. 6 h am Stück | § 4 ArbZG | Live-Countdown „Pause fällig in 12 Min.", Auto-Abzug optional |
| Ruhezeit 11 h | § 5 ArbZG | Warnung/Block beim Einstempeln, Konflikt im Schichtplaner |
| Sonn-/Feiertagsarbeit, Ersatzruhetag (2 bzw. 8 Wochen), 15 freie Sonntage/Jahr | §§ 9–11 ArbZG | kennzeichnen, Ersatzruhetag tracken |
| Jugendliche: 8 h/Tag, 40 h/Woche, 5-Tage-Woche, Pausen 30/60 Min. (> 4,5 h / > 6 h), 12 h Ruhe, Nachtruhe 20–6 Uhr, Berufsschultage anrechnen | §§ 8–16 JArbSchG | Alter aus `birth_date` je Arbeitstag |
| Mutterschutz: max. 8,5 h/Tag, 90 h/Doppelwoche, keine Nacht 20–6, kein Sonntag (Ausnahmen konfigurierbar) | §§ 4–6 MuSchG | Flag am MA |
| Aufzeichnung spätestens 7 Tage nach dem Arbeitstag | § 17 MiLoG | Cron-Warnung, Fokus Minijob |
| Aufbewahrung ≥ 2 Jahre | § 16 ArbZG | Mindestwert, nicht unterschreitbar |
| Feiertage je Bundesland | Landesrecht | eigene Berechnung inkl. Ostern, Buß- und Bettag, Fronleichnam, Reformationstag usw. |
| Firmenregeln | Regel-Engine | Check-in-Fenster, Rundung (5/15, zugunsten MA), Auto-Pause, Auto-Checkout, Toleranz, Überstunden-Freigabe/Kappung, Zuschläge, Vertrauensarbeitszeit |

Einstieg: `canStamp(state, action, rules, now)` → `{ allowed, warnings[], blockReason? }` und `evaluateDay(events, profile, rules)` → `{ net, valued, breaks, violations[], surcharges }`. Ziel: ≥ 95 % Testabdeckung in `compliance/`.

---

## 4. Screens

### A) Mitarbeiter-App (`/app`, Bottom-Tabs: Heute · Zeiten · Plan · Anträge · Profil)
1. **Heute** – Live-Uhr (BigNumber, rollende Ziffern), StatusPill, HoldButton (Check-in → Pause/Ende), ProgressRing Soll/Ist, nächste Schicht, smarte Hinweise, Abend-Zusammenfassung
2. **Stempel-Sheet** – Weg wählen: Button · QR scannen · Mein QR zeigen · NFC (Android); Projekt wählen (optional)
3. **QR-Scanner** (Vollbild-Kamera) · **Mein QR** (persönlicher, ebenfalls rotierender Code)
4. **Zeiten** – Segmented Tag/Woche/Monat, Wochen-Chart, Stundenkonto, Tagesdetail mit Timeline
5. **Korrektur beantragen** (Sheet, 2 Schritte)
6. **Anträge** – Urlaub (Kalender + Resturlaub live), Krank (AU-Foto), Status-Liste
7. **Plan** – meine Schichten, Schichtbörse, Tausch anfragen
8. **Monatsabschluss** – Übersicht + „Bestätigen" mit Erfolgs-Animation
9. **Profil** – Daten, Theme, Sprache, Push, Standort-Einwilligung, PIN, DSGVO-Datenexport

### B) Verwaltung (`/admin`, Sidebar + ⌘K)
1. **Live-Dashboard** – Anwesend/Pause/Abwesend (Realtime), Stunden heute, offene Anträge, ArbZG-Warnungen
2. **Mitarbeiter** – Liste (Karten/Listenansicht, Bulk-Aktionen) · Detail mit Tabs: Übersicht, Vertrag, Zeiten, Abwesenheiten, Akte, Protokoll · Einladen (Link/QR/E-Mail)
3. **Zeiten** – Tages-/Wochen-Grid aller MA, Inline-Bearbeitung mit Begründungspflicht
4. **Freigaben** – Inbox (Korrektur, Urlaub, Tausch), Swipe/1-Klick, Tastatur `A`/`R`/`J`/`K`
5. **Schichtplaner** – Drag & Drop Woche, Vorlagen, Schichtbörse, Konflikt-Badges
6. **Abwesenheitskalender** – Team-Zeitleiste, Feiertage, Vertretungen
7. **Regeln** – Klartext-Sätze mit Inline-Steppern/Toggles, je Firma/Standort/Person
8. **Standorte & Terminals** – Geofence-Karte, Terminal koppeln (Pairing-Code)
9. **Organigramm & Rollen**
10. **Projekte/Kostenstellen**
11. **Berichte & Export** – PDF-Monatsbericht, CSV/Excel, DATEV-Lohnexport, Stundenzettel
12. **Monatsabschluss** – Status je MA, Monat sperren
13. **Audit-Log** – filterbar, Hash-Kette verifizierbar
14. **Einstellungen** – Firma, Aufbewahrung, Betriebsrat-Hinweis (§ 87 BetrVG), DSGVO
15. **Onboarding-Wizard** – Firma → Standort → Mitarbeiter einladen (< 2 Min.)

### C) Terminal (`/terminal/[id]`)
1. **Pairing** (einmalig, Admin-Code) · 2. **Idle** – großer rotierender QR + Uhr + Ring für die 30 s · 3. **Erkennung** – Kamera für persönlichen QR, PIN-Pad, RFID-Eingabe · 4. **Begrüßung** – „Guten Morgen, Marvin 👋 – eingecheckt um 07:58" mit Animation & Ton · 5. **Admin-Entsperren** (Kiosk-PIN) · Offline-Badge mit Anzahl gepufferter Buchungen

### Weitere
`/login` (Magic Link + 6-stelliger Code), `/invite/[token]`, `/design` (Showcase aller Komponenten, Hell/Dunkel, Motion an/aus)

---

## 5. Design-System (Kurz)

- **Tokens:** `--bg #000`, `--surface #0A0A0A`, `--surface-2 #141414`, `--line rgba(255,255,255,.08)`, `--text #FFF`, `--text-2 #A1A1A1` (AA-geprüft), Status `--ok`, `--pause`, `--alert` – Light-Theme spiegelt die Werte. Radien 20/24/28. Spacing-Skala 4er-Raster.
- **Typo:** Inter (variable, `font-feature-settings: "tnum"` für alle Zahlen); BigNumber 72–120 px, Gewicht 600–700, leichtes negatives Tracking.
- **Motion:** zentrale Spring-Presets (`snappy`, `gentle`, `ring`), alle Komponenten respektieren `prefers-reduced-motion` (Fallback: Fade ohne Bewegung).

---

## 6. Demo-Seed
Firma „Nordlicht Coffee GmbH" (fiktiv), 2 Standorte (Hamburg, Köln), Admin + Owner, 1 Teamleiter, 10 Mitarbeiter (Vollzeit, Teilzeit, 2 Minijobber, 1 minderjährige Azubi mit Berufsschultag, 1 Mutterschutz-Flag), 8 Wochen realistische Historie inkl. einiger Verstöße, offener Anträge und eines gesperrten Vormonats, 1 Terminal pro Standort.

---

## 7. Phasen & Lieferumfang

| Phase | Ergebnis |
|---|---|
| 2 Fundament | Projekt-Setup, Tokens, ~20 Komponenten, `/design`, Supabase-Migrationen Kern + RLS, Auth (Magic Link/Code), Rollen-Guards, Seed, README |
| 3 MA-App | Heute-Screen, Hold-to-check-in, Pausen, Live-Uhr, Meine Zeiten + Chart, Offline-Queue (Basis) |
| 4 Compliance | `compliance/` komplett mit Tests, Regel-Engine-UI, Live-Warnungen |
| 5 Verwaltung | Dashboard (Realtime), Mitarbeiter, Freigaben, Zeiten bearbeiten, Audit-Log, ⌘K |
| 6 Terminal | Kiosk, rotierender QR, persönlicher QR, PIN, RFID, Offline-Puffer |
| 7 Abwesenheit & Schichten | Urlaub/Krank, Kalender, Feiertage, Schichtplaner D&D, Börse, Tausch |
| 8 Berichte | PDF, CSV/Excel, DATEV, Monatsabschluss & Sperre |
| 9 Feinschliff | PWA/Offline komplett, Push, A11y-Audit, Performance, Animationen |
