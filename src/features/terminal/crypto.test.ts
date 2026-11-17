import { describe, expect, it } from "vitest";
import {
  credentialHash, extractCode, isValidPin, makeCode, parseCode, safeEqual, secondsLeft, sha256Hex, signTicket, verifyCode,
  verifyTicket, windowOf,
} from "./crypto";

const ID = "6f1c2b9e-1d2a-4c3b-9f00-0123456789ab";
const SECRET = "a".repeat(64);
const T0 = Date.UTC(2026, 10, 17, 8, 0, 0); // auf ein Fenster ausgerichtet
const lookup = async (id: string) => (id === ID ? SECRET : null);

describe("rotierende Codes", () => {
  it("Fenster wechseln alle 30 Sekunden", () => {
    expect(windowOf(T0 + 29_999)).toBe(windowOf(T0));
    expect(windowOf(T0 + 30_000)).toBe(windowOf(T0) + 1);
    expect(secondsLeft(T0 + 10_000)).toBe(20);
  });

  it("gültig im selben und im Nachbarfenster", async () => {
    const code = await makeCode("T1", ID, SECRET, T0);
    expect(await verifyCode(code, "T1", lookup, T0)).toMatchObject({ ok: true, id: ID });
    expect(await verifyCode(code, "T1", lookup, T0 + 45_000)).toMatchObject({ ok: true });
    expect(await verifyCode(code, "T1", lookup, T0 - 20_000)).toMatchObject({ ok: true });
  });

  it("ein Foto von gestern (oder 2 Minuten später) ist wertlos", async () => {
    const code = await makeCode("T1", ID, SECRET, T0);
    expect(await verifyCode(code, "T1", lookup, T0 + 120_000)).toEqual({ ok: false, reason: "expired" });
  });

  it("gefälschte Signatur oder falscher Schlüssel", async () => {
    const code = await makeCode("T1", ID, "b".repeat(64), T0);
    expect(await verifyCode(code, "T1", lookup, T0)).toEqual({ ok: false, reason: "signature" });
    const tampered = (await makeCode("T1", ID, SECRET, T0)).replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect(await verifyCode(tampered, "T1", lookup, T0)).toEqual({ ok: false, reason: "signature" });
  });

  it("Terminal-Code ist kein persönlicher Code (und umgekehrt)", async () => {
    const code = await makeCode("P1", ID, SECRET, T0);
    expect(await verifyCode(code, "T1", lookup, T0)).toEqual({ ok: false, reason: "malformed" });
  });

  it("liest Codes aus URLs und lehnt Müll ab", async () => {
    const code = await makeCode("T1", ID, SECRET, T0);
    expect(extractCode(`https://app.example/scan?c=${code}`)).toBe(code);
    expect(parseCode("hallo welt")).toBeNull();
    expect(parseCode("T1.keine-uuid.1.x")).toBeNull();
  });
});

describe("PIN & RFID", () => {
  it("Hash ist deterministisch je Firma, aber firmenübergreifend verschieden", async () => {
    const a = await credentialHash("pepper", "org-a", "pin", "4711");
    expect(await credentialHash("pepper", "org-a", "pin", "4711")).toBe(a);
    expect(await credentialHash("pepper", "org-b", "pin", "4711")).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("RFID-Nummern werden normalisiert", async () => {
    expect(await credentialHash("p", "o", "rfid", "04:a2:bc:11")).toBe(await credentialHash("p", "o", "rfid", "04A2BC11"));
  });
  it("triviale PINs sind nicht erlaubt", () => {
    expect(isValidPin("4711")).toBe(true);
    expect(isValidPin("1111")).toBe(false);
    expect(isValidPin("1234")).toBe(false);
    expect(isValidPin("12")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });
});

describe("Tickets", () => {
  it("gültig bis Ablauf, danach nicht mehr", async () => {
    const t = await signTicket(SECRET, { m: ID }, 120, T0);
    expect(await verifyTicket<{ m: string }>(SECRET, t, T0 + 60_000)).toMatchObject({ m: ID });
    expect(await verifyTicket(SECRET, t, T0 + 121_000)).toBeNull();
  });
  it("manipulierte Tickets werden abgelehnt", async () => {
    const t = await signTicket(SECRET, { m: ID }, 120, T0);
    const [body, sig] = t.split(".");
    const forged = `${btoa(JSON.stringify({ m: "fremd", exp: 9e9 })).replace(/=+$/, "")}.${sig}`;
    expect(await verifyTicket(SECRET, forged, T0)).toBeNull();
    expect(await verifyTicket("anderer-schluessel", `${body}.${sig}`, T0)).toBeNull();
  });
});

describe("Helfer", () => {
  it("safeEqual & sha256", async () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(await sha256Hex("zeitgeist")).toMatch(/^[0-9a-f]{64}$/);
  });
});
