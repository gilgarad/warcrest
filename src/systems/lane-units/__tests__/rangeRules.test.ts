import { describe, expect, it } from "vitest";
import { UNIT_STATS } from "../unitStats";
import {
  RANGE_TO_PROGRESS,
} from "../rangeRules";
import { createTowerAttackPattern } from "../../lane-combat/towerAttack";

describe("range rules", () => {
  it("uses per-unit ranged attack ranges", () => {
    expect(UNIT_STATS.stone_slinger.range).toBe(3);
    expect(UNIT_STATS.archer.range).toBe(4.5);
    expect(UNIT_STATS.musketeer.range).toBe(4);
    expect(UNIT_STATS.rifleman.range).toBe(5.5);
    expect(UNIT_STATS.machine_gunner.range).toBe(5.5);
    expect(UNIT_STATS.modern_tank.range).toBe(10);
  });

  it("uses 1.2x the reference ranged unit range for tower reach", () => {
    expect(createTowerAttackPattern("stone").rangeProgress).toBeCloseTo(3 * 1.2 * RANGE_TO_PROGRESS);
    expect(createTowerAttackPattern("industrial_early").rangeProgress).toBeCloseTo(7 * 1.2 * RANGE_TO_PROGRESS);
    expect(createTowerAttackPattern("modern_late").rangeProgress).toBeCloseTo(12 * 1.2 * RANGE_TO_PROGRESS);
  });
});
