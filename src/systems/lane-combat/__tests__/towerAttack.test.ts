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

  it("keeps stone projectiles through bronze age", () => {
    const pattern = createTowerAttackPattern("bronze");
    expect(pattern.projectileKey).toBe("projectile-stone");
    expect(pattern.perProjectileDamage).toBe(UNIT_STATS.stone_slinger.attack);
    expect(pattern.cooldownSec).toBe(UNIT_STATS.stone_slinger.attackCooldownSec);
  });

  it("upgrades to arrows from early iron age", () => {
    const pattern = createTowerAttackPattern("iron_early");
    expect(pattern.projectileKey).toBe("projectile-arrow");
    expect(pattern.perProjectileDamage).toBe(8);
    expect(pattern.cooldownSec).toBe(1.95);
  });

  it("upgrades to gunshot projectiles in late iron age", () => {
    const pattern = createTowerAttackPattern("iron_late");
    expect(pattern.projectileKey).toBe("projectile-shot");
    expect(pattern.perProjectileDamage).toBe(10);
    expect(pattern.cooldownSec).toBe(2.05);
  });
});
