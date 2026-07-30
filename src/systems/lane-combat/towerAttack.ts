import { AGES, type AgeId } from "../../data/ages";
import { UNIT_STATS } from "../lane-units/unitStats";

export interface TowerAttackPattern {
  projectileKey: string;
  projectileCount: number;
  perProjectileDamage: number;
  spreadWorldPx: number;
  rangeProgress: number;
  cooldownSec: number;
}

export function createTowerAttackPattern(ageId: AgeId): TowerAttackPattern {
  const stoneTowerRangeProgress = UNIT_STATS.stone_slinger.range * 0.013 * 2;
  const ageIndex = AGES.findIndex((age) => age.id === ageId);
  if (ageIndex >= 4) {
    return { projectileKey: "projectile-shot", projectileCount: 2, perProjectileDamage: 10, spreadWorldPx: 12, rangeProgress: stoneTowerRangeProgress, cooldownSec: 2.05 };
  }
  if (ageIndex >= 2) {
    return { projectileKey: "projectile-arrow", projectileCount: 2, perProjectileDamage: 8, spreadWorldPx: 12, rangeProgress: stoneTowerRangeProgress, cooldownSec: 1.95 };
  }
  const slinger = UNIT_STATS.stone_slinger;
  return {
    projectileKey: "projectile-stone",
    projectileCount: 2,
    perProjectileDamage: slinger.attack,
    spreadWorldPx: 18,
    rangeProgress: stoneTowerRangeProgress,
    cooldownSec: slinger.attackCooldownSec,
  };
}
