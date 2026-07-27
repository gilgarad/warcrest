import { describe, expect, it } from "vitest";
import { UNIT_STATS } from "../../lane-units/unitStats";
import { createTowerAttackPattern } from "../towerAttack";

describe("tower attack pattern", () => {
  it("fires two full-strength slinger stones in the stone age", () => {
    const pattern = createTowerAttackPattern("stone");
    expect(pattern.projectileCount).toBe(2);
    expect(pattern.projectileKey).toBe("projectile-stone");
    expect(pattern.perProjectileDamage).toBe(UNIT_STATS.stone_slinger.attack);
    expect(pattern.cooldownSec).toBe(UNIT_STATS.stone_slinger.attackCooldownSec);
    expect(pattern.projectileCount * pattern.perProjectileDamage).toBe(14);
  });
});
