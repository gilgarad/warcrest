import { describe, expect, it } from "vitest";
import { AGES } from "../ages";
import {
  getBattlelineUnitCount,
  getSupportHealPower,
  getSupportResourceProfile,
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

function manaGatedSurvivalSec(): { survivalSec: number; castTimes: number[] } {
  const hpPerUnit = 34;
  const damagePerUnitSec = 3;
  const cooldownSec = 1.2;
  const profile = getSupportResourceProfile("stone");
  const hp = [hpPerUnit, hpPerUnit, hpPerUnit];
  const castTimes: number[] = [];
  const stepSec = 0.01;
  let mana = profile.manaMax;
  let cooldown = cooldownSec;
  let elapsed = 0;
  while (elapsed < 60 && hp.some((value) => value > 0)) {
    elapsed += stepSec;
    mana = Math.min(profile.manaMax, mana + profile.manaRegenPerSec * stepSec);
    cooldown -= stepSec;
    for (let index = 0; index < hp.length; index += 1) {
      hp[index] = Math.max(0, hp[index] - damagePerUnitSec * stepSec);
    }
    const injured = hp
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => value > 0 && value < hpPerUnit)
      .sort((a, b) => a.value - b.value);
    if (injured.length === 0 || cooldown > 0 || mana < profile.healManaCost) continue;
    cooldown = cooldownSec;
    mana -= profile.healManaCost;
    let remaining = profile.healPower;
    for (const { index } of injured) {
      const applied = Math.min(hpPerUnit - hp[index], Math.max(1, remaining));
      hp[index] += applied;
      remaining -= applied;
      if (remaining <= 0) break;
    }
    castTimes.push(Number(elapsed.toFixed(2)));
  }
  return { survivalSec: Number(elapsed.toFixed(2)), castTimes };
}

describe("support healing roster scaling", () => {
  it("derives support heal and mana from the active battleline count of each age", () => {
    for (const age of AGES) {
      const roster = getWaveRoster(age.id);
      const battlelineCount = getBattlelineUnitCount(roster);
      const expectedHealPower = battlelineCount === 3
        ? 4
        : battlelineCount === 4
          ? 5.33
          : 6.67;
      expect([3, 4, 5]).toContain(battlelineCount);
      expect(getSupportHealPower(age.id)).toBe(expectedHealPower);
      expect(getSupportResourceProfile(age.id)).toEqual({
        healPower: expectedHealPower,
        manaMax: battlelineCount * 6,
        healManaCost: 6,
        manaRegenPerSec: 1.25,
      });
    }
  });

  it("scales automatically when the battleline count changes again", () => {
    expect(scaleSupportHealPower(5)).toBe(10);
    expect(scaleSupportHealPower(4)).toBe(8);
    expect(scaleSupportHealPower(3)).toBe(6);
    expect(scaleSupportHealPower(0)).toBe(0);
  });

  it("keeps the mana-gated survival gain useful but below the legacy unlimited baseline", () => {
    const hp = 34;
    const incomingDamagePerUnitSec = 3;
    const cooldownSec = 1.2;
    const noSupport = uniformSurvivalSec(hp, incomingDamagePerUnitSec, 0, cooldownSec, 3);
    const legacyFive = uniformSurvivalSec(hp, incomingDamagePerUnitSec, 10, cooldownSec, 5);
    const manaGated = manaGatedSurvivalSec();

    expect(noSupport).toBeCloseTo(11.33, 2);
    expect(legacyFive).toBeCloseTo(25.5, 2);
    expect(manaGated.survivalSec).toBeGreaterThan(noSupport);
    expect(manaGated.survivalSec).toBeLessThan(legacyFive * 0.65);
    expect(manaGated.castTimes.slice(0, 3)).toEqual([1.2, 2.4, 3.6]);
    expect(manaGated.castTimes[3] - manaGated.castTimes[2]).toBeGreaterThan(2);
  });
});
