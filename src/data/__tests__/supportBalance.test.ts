import { describe, expect, it } from "vitest";
import { AGES } from "../ages";
import {
  getBattlelineUnitCount,
  getSupportHealPower,
  getWaveRoster,
  scaleSupportHealPower,
} from "../unitRosters";

function uniformSurvivalSec(
  hp: number,
  incomingDamagePerUnitSec: number,
  healPower: number,
  healCooldownSec: number,
  battlelineCount: number,
): number {
  const netDamagePerSec = incomingDamagePerUnitSec
    - healPower / healCooldownSec / battlelineCount;
  return netDamagePerSec <= 0 ? Number.POSITIVE_INFINITY : hp / netDamagePerSec;
}

describe("support healing roster scaling", () => {
  it("preserves the legacy per-unit healing rate for every current age roster", () => {
    for (const age of AGES) {
      const roster = getWaveRoster(age.id);
      expect(getBattlelineUnitCount(roster)).toBe(3);
      expect(getSupportHealPower(age.id)).toBe(6);
      expect(getSupportHealPower(age.id) / 3).toBe(10 / 5);
    }
  });

  it("scales automatically when the battleline count changes again", () => {
    expect(scaleSupportHealPower(5)).toBe(10);
    expect(scaleSupportHealPower(4)).toBe(8);
    expect(scaleSupportHealPower(3)).toBe(6);
    expect(scaleSupportHealPower(0)).toBe(0);
  });

  it("keeps the adjusted survival gain equal to the legacy 5-unit baseline", () => {
    const hp = 34;
    const incomingDamagePerUnitSec = 3;
    const cooldownSec = 1.2;
    const noSupport = uniformSurvivalSec(hp, incomingDamagePerUnitSec, 0, cooldownSec, 3);
    const legacyFive = uniformSurvivalSec(hp, incomingDamagePerUnitSec, 10, cooldownSec, 5);
    const adjustedThree = uniformSurvivalSec(hp, incomingDamagePerUnitSec, 6, cooldownSec, 3);
    const unscaledThree = uniformSurvivalSec(hp, incomingDamagePerUnitSec, 10, cooldownSec, 3);

    expect(noSupport).toBeCloseTo(11.33, 2);
    expect(legacyFive).toBeCloseTo(25.5, 2);
    expect(adjustedThree).toBeCloseTo(legacyFive, 5);
    expect(unscaledThree).toBeCloseTo(153, 2);
  });
});
