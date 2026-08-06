import { describe, expect, it } from "vitest";
import { getDefenseTowerReferenceUnit } from "../../lane-capture/defenseTowerRules";
import { UNIT_STATS } from "../../lane-units/unitStats";
import { RANGE_TO_PROGRESS } from "../../lane-units/rangeRules";
import { createTowerAttackPattern } from "../towerAttack";

describe("tower attack pattern", () => {
  it("maps stone towers to slinger stats", () => {
    const pattern = createTowerAttackPattern("stone");
    const unit = UNIT_STATS[getDefenseTowerReferenceUnit("stone")];
    expect(pattern.projectileCount).toBe(2);
    expect(pattern.projectileKey).toBe("projectile-stone");
    expect(pattern.perProjectileDamage).toBe(unit.attack);
    expect(pattern.cooldownSec).toBe(unit.attackCooldownSec);
    expect(pattern.rangeProgress).toBeCloseTo(unit.range * 1.2 * RANGE_TO_PROGRESS);
  });

  it("keeps stone projectile towers through bronze age", () => {
    const stone = createTowerAttackPattern("stone");
    const bronze = createTowerAttackPattern("bronze");
    expect(bronze.projectileKey).toBe("projectile-stone");
    expect(bronze.perProjectileDamage).toBe(UNIT_STATS.stone_slinger.attack);
    expect(bronze.cooldownSec).toBe(UNIT_STATS.stone_slinger.attackCooldownSec);
    expect(bronze.rangeProgress).toBeCloseTo(stone.rangeProgress);
  });

  it("uses archer-based arrow towers in early iron", () => {
    const pattern = createTowerAttackPattern("iron_early");
    expect(pattern.projectileKey).toBe("projectile-arrow");
    expect(pattern.perProjectileDamage).toBe(UNIT_STATS.archer.attack);
    expect(pattern.cooldownSec).toBe(UNIT_STATS.archer.attackCooldownSec);
  });

  it("uses musket towers in late iron and renaissance", () => {
    const pattern = createTowerAttackPattern("iron_late");
    const renaissance = createTowerAttackPattern("renaissance");
    expect(pattern.projectileKey).toBe("projectile-shot");
    expect(pattern.perProjectileDamage).toBe(UNIT_STATS.musketeer.attack);
    expect(pattern.cooldownSec).toBe(UNIT_STATS.musketeer.attackCooldownSec);
    expect(renaissance.perProjectileDamage).toBe(UNIT_STATS.musketeer.attack);
  });

  it("switches to artillery-scale tower range in late eras", () => {
    const industrial = createTowerAttackPattern("industrial_early");
    const modernLate = createTowerAttackPattern("modern_late");
    expect(industrial.perProjectileDamage).toBe(UNIT_STATS.cannon_i.attack);
    expect(modernLate.perProjectileDamage).toBe(UNIT_STATS.mobile_artillery.attack);
    expect(modernLate.rangeProgress).toBeGreaterThan(industrial.rangeProgress);
  });
});
