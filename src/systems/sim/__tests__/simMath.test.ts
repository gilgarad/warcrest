import { describe, expect, it } from "vitest";
import { clamp, distance, lerp, moveToward } from "../simMath";

describe("simMath", () => {
  it("clamps to the bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it("interpolates, and extrapolates past the ends like Phaser.Math.Linear did", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    // Deliberately not clamped: the steering code relies on this behaviour.
    expect(lerp(0, 10, 1.5)).toBe(15);
    expect(lerp(0, 10, -0.5)).toBe(-5);
  });

  it("moves toward a target and lands exactly on it", () => {
    expect(moveToward(0, 10, 3)).toBe(3);
    expect(moveToward(0, 10, 20)).toBe(10);
    expect(moveToward(10, 0, 20)).toBe(0);
    expect(moveToward(5, 5, 1)).toBe(5);
  });

  it("never overshoots the target", () => {
    expect(moveToward(9.9, 10, 1)).toBe(10);
    expect(moveToward(10.1, 10, 1)).toBe(10);
  });

  it("measures distance", () => {
    expect(distance(3, 4)).toBe(5);
    expect(distance(0, 0)).toBe(0);
  });

  /**
   * The simulation must produce identical numbers on both peers, so these
   * helpers may only use operations IEEE-754 pins down exactly. Guarding the
   * values here means a "harmless" rewrite using Math.pow or a fast
   * approximation gets caught rather than silently desyncing a match.
   */
  it("produces exactly reproducible values", () => {
    expect(lerp(0.1, 0.2, 0.3)).toBe(0.1 + (0.2 - 0.1) * 0.3);
    expect(distance(0.1, 0.2)).toBe(Math.sqrt(0.1 * 0.1 + 0.2 * 0.2));
    expect(clamp(0.1 + 0.2, 0, 1)).toBe(0.30000000000000004);
  });
});
