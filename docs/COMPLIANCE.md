# Compliance-Service

`src/compliance/` enthält **alle** arbeitsrechtlichen Regeln und Firmenregeln von Zeitgeist. Das Modul ist reines TypeScript ohne Abhängigkeit zu React, Next.js oder Supabase. Es ist vollständig getestet: `pnpm test` (Abdeckung des Moduls ≥ 95 %).

> **Wichtig:** Die Umsetzung folgt dem Gesetzeswortlaut nach bestem Wissen. Sie ersetzt keine Rechtsberatung. Branchen- und Tarifausnahmen (z. B. § 7 ArbZG, § 14 Abs. 2 ff. JArbSchG) sind nicht automatisch abgebildet.

## Wo die Regeln laufen

| Zeitpunkt | Ort | Was passiert |
|---|---|---|
| **Vor** dem Stempeln | `POST /api/stamp` → `canStamp()` | Warnen oder blockieren, je nach Firmenregel. Pause, Pausenende und Auschecken werden **nie** blockiert. Offline-Nachträge werden nie blockiert. |
| **Nach** jeder Buchung | `evaluateMemberRange()` | Tageswerte (bewertete Minuten, Pausenabzug, Zuschlagsminuten) und Verstöße werden gespeichert. |
| Stündlich | `GET /api/cron/auto-checkout` | Vergessene Check-outs werden nach Firmenregel automatisch beendet, die Person wird benachrichtigt. |
| Nächtlich | `GET /api/cron/nightly` | Nachbewertung der letzten 16 Tage, u. a. MiLoG-Frist und abgelaufene Ersatzruhetage. |
| Nach `pnpm db:reset` | `pnpm compliance:run` | Bewertet die Demo-Daten. |

Die Cron-Routen erwarten `Authorization: Bearer $CRON_SECRET`. Sie lassen sich z. B. über Vercel Cron oder Supabase `pg_cron` + `pg_net` aufrufen.

## Gesetzliche Regeln

| Code | Regel | Rechtsgrundlage | Schwere |
|---|---|---|---|
| `ARBZG_DAILY_OVER_8` | mehr als 8 h am Tag (zulässig mit Ausgleich) | § 3 ArbZG | Hinweis |
| `ARBZG_DAILY_OVER_10` | mehr als 10 h am Tag | § 3 ArbZG | Verstoß |
| `ARBZG_AVERAGE_EXCEEDED` | Ø über 8 h je Werktag in 6 Kalendermonaten | § 3 Satz 2 ArbZG | Verstoß |
| `ARBZG_BREAK_TOO_SHORT` | > 6 h → 30 Min., > 9 h → 45 Min.; nur Blöcke ≥ 15 Min. zählen | § 4 ArbZG | Verstoß |
| `ARBZG_CONTINUOUS_WORK` | mehr als 6 h am Stück ohne Pause | § 4 Satz 3 ArbZG | Verstoß |
| `ARBZG_REST_PERIOD` | weniger als 11 h Ruhezeit | § 5 ArbZG | Verstoß |
| `ARBZG_SUNDAY_WORK` / `ARBZG_HOLIDAY_WORK` | Kennzeichnung | §§ 9–11 ArbZG | Hinweis |
| `ARBZG_REPLACEMENT_REST_MISSING` | kein arbeitsfreier Werktag binnen 2 Wochen (Sonntag) bzw. 8 Wochen (Feiertag) | § 11 Abs. 3 ArbZG | Verstoß |
| `ARBZG_SUNDAYS_OFF` | weniger als 15 freie Sonntage im Jahr | § 11 Abs. 1 ArbZG | Verstoß |
| `JARBSCHG_DAILY_MAX` | Jugendliche: mehr als 8 h | § 8 JArbSchG | Verstoß |
| `JARBSCHG_WEEKLY_MAX` | mehr als 40 h/Woche; ein Berufsschultag zählt 8 h | §§ 8, 9 JArbSchG | Verstoß |
| `JARBSCHG_FIVE_DAY_WEEK` | mehr als 5 Arbeitstage/Woche | § 15 JArbSchG | Verstoß |
| `JARBSCHG_BREAK` | > 4,5 h → 30 Min., > 6 h → 60 Min.; max. 4,5 h am Stück | § 11 JArbSchG | Verstoß |
| `JARBSCHG_REST_PERIOD` | weniger als 12 h Ruhezeit | § 13 JArbSchG | Verstoß |
| `JARBSCHG_NIGHT_REST` | Arbeit zwischen 20 und 6 Uhr | § 14 JArbSchG | Verstoß |
| `JARBSCHG_WEEKEND` | Samstag, Sonntag, Feiertag | §§ 16–18 JArbSchG | Warnung |
| `JARBSCHG_SCHOOL_DAY` | Arbeit am Berufsschultag | § 9 JArbSchG | Warnung |
| `MUSCHG_DAILY_MAX` | mehr als 8,5 h | § 4 MuSchG | Verstoß |
| `MUSCHG_DOUBLE_WEEK_MAX` | mehr als 90 h in der Doppelwoche | § 4 MuSchG | Verstoß |
| `MUSCHG_NIGHT` | Arbeit zwischen 20 und 6 Uhr | § 5 MuSchG | Warnung |
| `MUSCHG_SUNDAY_HOLIDAY` | Sonn- und Feiertagsarbeit | § 6 MuSchG | Warnung |
| `MILOG_RECORD_MISSING` | Aufzeichnung fehlt mehr als 7 Tage nach dem Arbeitstag | § 17 MiLoG | Warnung |
| `MILOG_RECORD_LATE` | Aufzeichnung später als 7 Tage erfasst | § 17 MiLoG | Hinweis |

## Firmenregeln (einstellbar unter Verwaltung → Regeln)

Die Ebenen sind **Standard → Firma → Standort → Person**. Jede Ebene speichert nur ihre Abweichungen (`diffRules`). Ungültige gespeicherte Werte fallen sicher auf den Standard zurück (`resolveRules`).

- **Ein- und Auschecken:** frühestes Einchecken vor Schichtbeginn (aus, warnen oder blockieren), Verspätungstoleranz mit Benachrichtigung, Hinweis bei spätem Auschecken
- **Automatisch auschecken:** nach x Stunden und/oder um Mitternacht
- **Rundung:** aus, zugunsten der Mitarbeiter (Beginn ab-, Ende aufrunden) oder kaufmännisch. Wirkt **nur** auf die bewertete Zeit, Rohzeiten bleiben unverändert.
- **Automatischer Pausenabzug:** zieht die fehlende gesetzliche Pause von der bewerteten Zeit ab und vermerkt das als Hinweis
- **Erfassungswege:** App, QR am Terminal, persönlicher QR, PIN, RFID, NFC; optional Geofence-Pflicht
- **Korrekturen:** nur mit Freigabe oder selbst (protokolliert)
- **Überstunden:** Freigabe ab x Minuten pro Tag, Kappungsgrenze des Stundenkontos
- **Zuschläge:** Nacht (Zeitfenster einstellbar, Standard 23–6 Uhr nach § 2 Abs. 3 ArbZG), Sonntag, Feiertag
- **Arbeitsschutz:** Ruhezeit und Tageshöchstgrenze warnen oder blockieren. Für Jugendliche wird die Ruhezeit immer blockiert. Nachtruhe für Jugendliche lässt sich ebenfalls auf Warnen oder Blockieren stellen.
- **Vertrauensarbeitszeit:** Zeiten werden erfasst, Beginn und Ende aber nicht kontrolliert
- **MiLoG für alle:** prüft die Aufzeichnungsfrist auch bei Nicht-Minijobs

## Annahmen & Vereinfachungen

- **Arbeitstag:** Er gehört zum Datum des Check-ins (Berliner Zeit), Nachtschichten bleiben zusammen.
- **Werktage:** Montag bis Samstag ohne Feiertage. Urlaubs- und Krankheitstage gehen derzeit mit 0 h in den 6-Monats-Durchschnitt ein. Ab Phase 7 werden sie berücksichtigt.
- **Ersatzruhetag:** Er gilt als gewährt, wenn innerhalb der Frist ein Werktag ohne Arbeit liegt. Geprüft wird erst nach Fristablauf.
- **Berufsschultag:** Er wird pauschal mit 8 h auf die Wochenarbeitszeit angerechnet (§ 9 Abs. 2 Nr. 1 JArbSchG setzt mehr als 5 Unterrichtsstunden voraus). Das ist eine konservative Annahme.
- **Feiertage:** Nur landesweite Feiertage sind enthalten. Regionale (z. B. Mariä Himmelfahrt in Teilen Bayerns, Augsburger Friedensfest) kommen später je Standort dazu.
- **Mutterschutz:** Die 90-h-Grenze gilt für Erwachsene. Für Minderjährige in der Schwangerschaft (80 h) greift die strengere JArbSchG-Prüfung.
- **Jugendliche:** Das Alter wird je Arbeitstag aus dem Geburtsdatum berechnet. Ist keins hinterlegt, gelten die Erwachsenenregeln.
