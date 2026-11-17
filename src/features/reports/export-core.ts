/**
 * Reine Export-Funktionen (CSV, DATEV) – ohne Datenbank, gut testbar.
 */
import type { PayrollSettings } from "./payroll-settings";

/** Minuten → Dezimalstunden mit Komma, 2 Nachkommastellen („7,50") */
export function hoursDe(minutes: number): string {
  return (Math.round((minutes / 60) * 100) / 100).toFixed(2).replace(".", ",");
}

/** Minuten → „7:52" */
export function hhmm(minutes: number): string {
  const neg = minutes < 0;
  const m = Math.abs(Math.round(minutes));
  return `${neg ? "-" : ""}${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** yyyy-MM-dd → TT.MM.JJJJ */
export function dateDe(key: string): string {
  return `${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`;
}

/** CSV für deutsches Excel: Semikolon, UTF-8 mit BOM, Werte bei Bedarf in Anführungszeichen */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Formel-Injection in Excel verhindern (=, +, -, @ am Anfang)
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s;
    return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// DATEV LODAS (ASCII-Import, Bewegungsdaten)
// ---------------------------------------------------------------------------
export interface PayrollLine {
  personnelNo: string; // numerisch, max. 5 Stellen
  name: string;
  minutes: Partial<Record<keyof PayrollSettings["lohnarten"], number>>;
}

/** Personalnummer für DATEV: nur Ziffern, max. 5 Stellen („Z-004" → „4") */
export function datevPnr(employeeNo: string | null | undefined): string | null {
  const digits = (employeeNo ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits && digits.length <= 5 ? digits : null;
}

/**
 * Erzeugt eine LODAS-Importdatei. Je Person und Lohnart eine Zeile mit Stunden.
 * Hinweis: Feldnamen/Lohnarten vor dem Produktivbetrieb mit dem Steuerbüro abstimmen.
 */
export function datevLodas(settings: PayrollSettings, month: string, lines: readonly PayrollLine[]): string {
  const header = [
    "[Allgemein]",
    "Ziel=LODAS",
    "Version_SST=1.0",
    `BeraterNr=${settings.beraterNr}`,
    `MandantenNr=${settings.mandantNr}`,
    "Datumsformat=TT.MM.JJJJ",
    "Feldtrennzeichen=;",
    "Zahlenkomma=,",
    "Stringbegrenzer=\"",
    "",
    "[Satzbeschreibung]",
    "1;u_lod_bwd_buchung_standard;abrechnung_zeitraum#bwd;pnr#bwd;la_eigene#bwd;bs_wert_butab#bwd;",
    "",
    "[Bewegungsdaten]",
  ];
  const period = dateDe(month);
  const body: string[] = [];
  for (const l of lines) {
    for (const [key, la] of Object.entries(settings.lohnarten) as [keyof PayrollSettings["lohnarten"], number][]) {
      const min = l.minutes[key] ?? 0;
      if (min > 0 && la > 0) body.push(`1;${period};${l.personnelNo};${la};${hoursDe(min)};`);
    }
  }
  return [...header, ...body, ""].join("\r\n");
}
