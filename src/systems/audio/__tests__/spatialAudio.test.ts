import { describe, expect, it } from "vitest";
import { calculateSpatialAudio } from "../spatialAudio";

const camera = { centerX: 1000, centerY: 500, width: 1600, height: 900, zoom: 1 };

describe("calculateSpatialAudio", () => {
  it("keeps centered events at full volume and centered pan", () => {
    expect(calculateSpatialAudio({ x: 1000, y: 500 }, camera)).toEqual({
      audible: true,
      volumeMultiplier: 1,
      pan: 0,
    });
  });

  it("attenuates and gently pans edge events", () => {
    const mix = calculateSpatialAudio({ x: 1800, y: 500 }, camera);
    expect(mix.audible).toBe(true);
    expect(mix.volumeMultiplier).toBeLessThan(0.8);
    expect(mix.pan).toBeGreaterThan(0);
    expect(mix.pan).toBeLessThanOrEqual(0.45);
  });

  it("suppresses events far outside the camera", () => {
    expect(calculateSpatialAudio({ x: 5000, y: 500 }, camera).audible).toBe(false);
  });
});
