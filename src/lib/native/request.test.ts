import { describe, expect, it } from "vitest";
import { isBrowserOnlyPath, isNativeUserAgent, nativeHomeFor } from "./request";

describe("native App-Erkennung", () => {
  it("erkennt die App am User-Agent", () => {
    expect(isNativeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Mobile/15E148 ZeitgeistApp")).toBe(true);
    expect(isNativeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1")).toBe(false);
    expect(isNativeUserAgent(null)).toBe(false);
  });

  it("Verwaltung und Firmen-Anlage gibt es nur im Browser", () => {
    expect(isBrowserOnlyPath("/admin")).toBe(true);
    expect(isBrowserOnlyPath("/admin/berichte")).toBe(true);
    expect(isBrowserOnlyPath("/onboarding")).toBe(true);
    expect(isBrowserOnlyPath("/app")).toBe(false);
    expect(isBrowserOnlyPath("/administration-x")).toBe(false);
  });

  it("in der App landen alle in der Zeiterfassung", () => {
    expect(nativeHomeFor(true)).toBe("/app");
    expect(nativeHomeFor(false)).toBe("/nur-im-browser");
  });
});
