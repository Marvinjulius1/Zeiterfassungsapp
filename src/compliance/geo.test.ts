import { describe, expect, it } from "vitest";
import { distanceMeters, insideGeofence } from "./geo";

const koeln = { lat: 50.9375, lng: 6.9403 };

describe("Geofence", () => {
  it("Entfernung Köln–Hamburg ≈ 357 km", () => {
    expect(distanceMeters(koeln, { lat: 53.543, lng: 9.989 }) / 1000).toBeCloseTo(357, -1);
  });
  it("innerhalb und außerhalb", () => {
    const fence = { ...koeln, radiusM: 150 };
    expect(insideGeofence({ lat: 50.9380, lng: 6.9405 }, fence)).toBe(true);
    expect(insideGeofence({ lat: 50.9420, lng: 6.9403 }, fence)).toBe(false); // ~500 m
  });
  it("Messungenauigkeit zählt zugunsten der Person (max. 100 m)", () => {
    const fence = { ...koeln, radiusM: 150 };
    const near = { lat: 50.9393, lng: 6.9403 }; // ~200 m
    expect(insideGeofence(near, fence)).toBe(false);
    expect(insideGeofence({ ...near, accuracy: 80 }, fence)).toBe(true);
    expect(insideGeofence({ ...near, accuracy: 5000 }, { ...fence, radiusM: 50 })).toBe(false);
  });
});
