import { describe, expect, it } from "vitest";
import {
  AI_INSTANT_WAVE_MIN_REMAINING_RATIO,
  AI_INSTANT_WAVE_MIN_REMAINING_SEC,
  INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC,
  WAVE_INTERVAL_SEC,
} from "../balance";

describe("wave timing", () => {
  it("uses a 30-second regular wave interval", () => {
    expect(WAVE_INTERVAL_SEC).toBe(30);
  });

  it("keeps the player-defined 10-second instant-wave cooldown", () => {
    expect(INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC).toBe(10);
  });

  it("preserves the old 22/90 no-spend tail for AI instant-wave tokens", () => {
    expect(AI_INSTANT_WAVE_MIN_REMAINING_RATIO).toBeCloseTo(22 / 90, 8);
    expect(AI_INSTANT_WAVE_MIN_REMAINING_SEC).toBeCloseTo(22 / 3, 8);

    const remainingWhenTokenUnlocks = WAVE_INTERVAL_SEC
      - INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC;
    expect(remainingWhenTokenUnlocks).toBeGreaterThan(AI_INSTANT_WAVE_MIN_REMAINING_SEC);
  });
});
