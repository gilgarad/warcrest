import { describe, expect, it } from "vitest";
import { getAttackTimingProfile } from "../attackTiming";

describe("getAttackTimingProfile", () => {
  it("keeps melee contact early and recovery compact", () => {
    const profile = getAttackTimingProfile("melee", "unit");
    expect(profile.eventProgress).toBeLessThan(0.5);
    expect(profile.durationSec - profile.eventDelayMs / 1000).toBeLessThan(0.25);
  });

  it("shows a ranged release pose before spawning its projectile", () => {
    const profile = getAttackTimingProfile("ranged", "structure");
    expect(profile.eventProgress).toBeGreaterThan(0.35);
    expect(profile.eventProgress).toBeLessThan(0.5);
  });

  it("gives support casts a readable but restrained beat", () => {
    const melee = getAttackTimingProfile("melee", "unit");
    const support = getAttackTimingProfile("support", "unit");
    expect(support.durationSec).toBeGreaterThan(melee.durationSec);
    expect(support.eventProgress).toBeGreaterThan(0.5);
  });
});
