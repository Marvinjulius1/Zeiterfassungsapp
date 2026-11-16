import { describe, expect, it } from "vitest";
import { firstName, greeting } from "./greeting";

describe("greeting", () => {
  it("richtet sich nach Berliner Zeit, nicht nach Server-Zeit", () => {
    // 06:30 UTC im Winter = 07:30 in Berlin
    expect(greeting(new Date("2026-11-16T06:30:00Z"))).toBe("Guten Morgen");
    expect(greeting(new Date("2026-11-16T12:00:00Z"))).toBe("Hallo");
    expect(greeting(new Date("2026-11-16T19:00:00Z"))).toBe("Guten Abend");
    expect(greeting(new Date("2026-11-16T02:00:00Z"))).toBe("Gute Nacht");
  });
  it("Vorname", () => {
    expect(firstName("Marvin Julius")).toBe("Marvin");
  });
});
