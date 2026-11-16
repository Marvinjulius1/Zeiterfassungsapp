import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("erlaubt interne Pfade", () => {
    expect(safeNext("/app/zeiten")).toBe("/app/zeiten");
  });
  it("blockt externe Ziele", () => {
    expect(safeNext("https://evil.example")).toBe("/start");
    expect(safeNext("//evil.example")).toBe("/start");
    expect(safeNext("/\\evil.example")).toBe("/start");
    expect(safeNext(null)).toBe("/start");
  });
});
