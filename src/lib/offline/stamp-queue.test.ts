import { describe, expect, it } from "vitest";
import { isNetworkError } from "./stamp-queue";

describe("isNetworkError", () => {
  it("erkennt Netzwerkfehler verschiedener Browser", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch", code: "" })).toBe(true);
    expect(isNetworkError({ message: "Load failed" })).toBe(true);
    expect(isNetworkError({ message: "NetworkError when attempting to fetch resource." })).toBe(true);
  });
  it("Geschäftsregeln sind keine Netzwerkfehler", () => {
    expect(isNetworkError({ message: "Du bist bereits eingecheckt.", code: "P0001" })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
