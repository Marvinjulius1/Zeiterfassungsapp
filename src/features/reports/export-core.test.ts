import { describe, expect, it } from "vitest";
import { dateDe, datevLodas, datevPnr, hhmm, hoursDe, toCsv } from "./export-core";
import { resolvePayrollSettings } from "./payroll-settings";

describe("Formate", () => {
  it("Dezimalstunden mit Komma", () => {
    expect(hoursDe(450)).toBe("7,50");
    expect(hoursDe(472)).toBe("7,87");
    expect(hoursDe(0)).toBe("0,00");
  });
  it("Stunden:Minuten auch negativ", () => {
    expect(hhmm(472)).toBe("7:52");
    expect(hhmm(-75)).toBe("-1:15");
  });
  it("Datum", () => expect(dateDe("2026-11-01")).toBe("01.11.2026"));
});

describe("CSV", () => {
  it("Semikolon, BOM, Quoting", () => {
    const csv = toCsv([["Name", "Notiz"], ["Lena", 'sagt "hallo"; tschüss']]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('Lena;"sagt ""hallo""; tschüss"');
  });
  it("verhindert Excel-Formel-Injection, lässt negative Zahlen in Ruhe", () => {
    const csv = toCsv([["=HYPERLINK(\"evil\")", "-1,50", "@SUM(A1)"]]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain(";-1,50;");
    expect(csv).toContain("'@SUM");
  });
});

describe("DATEV LODAS", () => {
  it("Personalnummern", () => {
    expect(datevPnr("Z-004")).toBe("4");
    expect(datevPnr("00123")).toBe("123");
    expect(datevPnr("ABC")).toBeNull();
    expect(datevPnr("1234567")).toBeNull();
  });
  it("Kopf und eine Zeile je Lohnart mit Wert", () => {
    const s = resolvePayrollSettings({ beraterNr: "1234567", mandantNr: "12345" });
    const out = datevLodas(s, "2026-11-01", [{ personnelNo: "4", name: "Marvin", minutes: { worked: 9600, night: 90, sick: 0 } }]);
    expect(out).toContain("BeraterNr=1234567");
    expect(out).toContain("MandantenNr=12345");
    expect(out).toContain("1;01.11.2026;4;100;160,00;");
    expect(out).toContain("1;01.11.2026;4;300;1,50;");
    expect(out).not.toContain(";500;"); // 0 Stunden Krankheit → keine Zeile
    expect(out.split("\r\n")).toContain("[Bewegungsdaten]");
  });
  it("ungültige Einstellungen fallen auf Standard zurück", () => {
    expect(resolvePayrollSettings({ beraterNr: "abc" }).lohnarten.worked).toBe(100);
  });
});
