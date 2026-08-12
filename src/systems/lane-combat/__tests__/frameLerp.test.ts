import { describe, expect, it } from "vitest";
import { frameLerpAlpha, LERP_REFERENCE_FPS } from "../frameLerp";

const STEERING_ALPHAS = [0.34, 0.4, 0.42, 0.45, 0.52];

/** Applies `steps` lerp steps of `deltaSec` each, starting from 0 toward 1. */
function converge(deltaSec: number, steps: number, alphaAt60: number): number {
  let value = 0;
  const alpha = frameLerpAlpha(deltaSec, alphaAt60);
  for (let i = 0; i < steps; i += 1) value += (1 - value) * alpha;
  return value;
}

describe("frameLerpAlpha", () => {
  it("returns the authored alpha unchanged at the reference frame rate", () => {
    for (const alpha of STEERING_ALPHAS) {
      expect(frameLerpAlpha(1 / LERP_REFERENCE_FPS, alpha)).toBeCloseTo(alpha, 12);
    }
  });

  it("converges the same amount per wall-clock second at any frame rate", () => {
    // One simulated second at 60fps, 30fps, 20fps and a 15fps stutter.
    for (const alpha of STEERING_ALPHAS) {
      const at60 = converge(1 / 60, 60, alpha);
      for (const fps of [30, 20, 15]) {
        expect(converge(1 / fps, fps, alpha)).toBeCloseTo(at60, 10);
      }
    }
  });

  it("is the fix for the bug: a bare constant alpha falls behind when frames drop", () => {
    // What the scene used to do — the same constant applied once per frame.
    const bare = (steps: number, alpha: number): number => {
      let value = 0;
      for (let i = 0; i < steps; i += 1) value += (1 - value) * alpha;
      return value;
    };
    // The window that matters is short: roughly how long a unit has to slide
    // into an attack slot before its next attack window. Over 0.2s a 60fps
    // client covers 12 frames and effectively arrives, while a 15fps client
    // gets 3 frames and is still a fifth of the way out — far enough to sit
    // outside engagement range.
    expect(bare(12, 0.4)).toBeGreaterThan(0.99);
    expect(bare(3, 0.4)).toBeLessThan(0.8);

    // Delta-scaled, the same 0.2s of wall-clock time lands both frame rates on
    // the same position.
    expect(converge(1 / 15, 3, 0.4)).toBeCloseTo(converge(1 / 60, 12, 0.4), 10);
  });

  it("clamps degenerate inputs", () => {
    expect(frameLerpAlpha(0, 0.4)).toBe(0);
    expect(frameLerpAlpha(-1, 0.4)).toBe(0);
    expect(frameLerpAlpha(1 / 60, 0)).toBe(0);
    expect(frameLerpAlpha(1 / 60, 1)).toBe(1);
  });

  it("never overshoots for very long frames", () => {
    for (const alpha of STEERING_ALPHAS) {
      const value = frameLerpAlpha(2.5, alpha);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
