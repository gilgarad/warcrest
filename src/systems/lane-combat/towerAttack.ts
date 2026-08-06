import type { AgeId } from "../../data/ages";
import { getDefenseTowerAttackMultiplier, getDefenseTowerReferenceUnit } from "../lane-capture/defenseTowerRules";
import type { TeamResearchState } from "../lane-economy/researchState";
import { getProjectileKeyForUnit, UNIT_STATS } from "../lane-units/unitStats";
import { RANGE_TO_PROGRESS } from "../lane-units/rangeRules";

export interface TowerAttackPattern {
  projectileKey: string;
  projectileCount: number;
  perProjectileDamage: number;
  basePerProjectileDamage: number;
  spreadWorldPx: number;
  rangeProgress: number;
  cooldownSec: number;
}

export function createTowerAttackPattern(ageId: AgeId, researchState?: TeamResearchState): TowerAttackPattern {
  const referenceUnit = UNIT_STATS[getDefenseTowerReferenceUnit(ageId)];
  const towerRangeProgress = referenceUnit.range * 1.2 * RANGE_TO_PROGRESS;
  const attackMultiplier = getDefenseTowerAttackMultiplier(ageId, researchState);
  const basePerProjectileDamage = referenceUnit.attack;
  return {
    projectileKey: getProjectileKeyForUnit(getDefenseTowerReferenceUnit(ageId)),
    projectileCount: 2,
    basePerProjectileDamage,
    perProjectileDamage: Math.max(1, Math.round(basePerProjectileDamage * attackMultiplier)),
    spreadWorldPx: referenceUnit.range >= 8 ? 22 : referenceUnit.range >= 6 ? 18 : 12,
    rangeProgress: towerRangeProgress,
    cooldownSec: referenceUnit.attackCooldownSec,
  };
}
