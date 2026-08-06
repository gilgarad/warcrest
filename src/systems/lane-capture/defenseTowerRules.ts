import { AGES, type AgeId } from "../../data/ages";
import type { ResourceCost } from "../../data/balance";
import { clampResearchLevel, resolveResearchMultiplier } from "../lane-economy/researchRules";
import { getAppliedResearchLevels, type TeamResearchState } from "../lane-economy/researchState";
import { TOWER_RESEARCH_SUBJECT_ID } from "../lane-economy/researchSubjects";
import { UNIT_STATS } from "../lane-units/unitStats";
import type { BattleUnitId } from "../../data/unitRosters";

const TOWER_REFERENCE_UNIT_BY_AGE: Record<AgeId, BattleUnitId> = {
  stone: "stone_slinger",
  bronze: "stone_slinger",
  iron_early: "archer",
  iron_mid: "archer",
  iron_late: "musketeer",
  renaissance: "musketeer",
  industrial_early: "cannon_i",
  industrial_late: "cannon_ii",
  modern_early: "artillery_i",
  modern_mid: "artillery_ii",
  modern_late: "mobile_artillery",
};

export const DEFENSE_TOWER_BUILD_DURATION_SEC = 10;

export function getDefenseTowerBuildCost(ageId: AgeId): ResourceCost {
  const ageIndex = AGES.findIndex((age) => age.id === ageId);
  return {
    gold: 10 + ageIndex * 4,
    wood: 10 + ageIndex * 4,
    ...(ageIndex >= 2 ? { metal: 4 + ageIndex * 2 } : {}),
  };
}

export function getDefenseTowerReferenceUnit(ageId: AgeId): BattleUnitId {
  return TOWER_REFERENCE_UNIT_BY_AGE[ageId];
}

export function getDefenseTowerBaseHp(ageId: AgeId): number {
  return UNIT_STATS[getDefenseTowerReferenceUnit(ageId)].hp * 25;
}

export function getDefenseTowerBaseDefense(ageId: AgeId): number {
  return UNIT_STATS[getDefenseTowerReferenceUnit(ageId)].defense;
}

export function getDefenseTowerResearchLevels(
  ageId: AgeId,
  researchState?: TeamResearchState,
): { attackLevel: number; defenseLevel: number } {
  if (!researchState) return { attackLevel: 0, defenseLevel: 0 };
  const levels = getAppliedResearchLevels(researchState, ageId, TOWER_RESEARCH_SUBJECT_ID);
  return {
    attackLevel: clampResearchLevel(ageId, levels.attackLevel),
    defenseLevel: clampResearchLevel(ageId, levels.defenseLevel),
  };
}

export function getDefenseTowerAttackMultiplier(ageId: AgeId, researchState?: TeamResearchState): number {
  return resolveResearchMultiplier(getDefenseTowerResearchLevels(ageId, researchState).attackLevel);
}

export function getDefenseTowerDefenseMultiplier(ageId: AgeId, researchState?: TeamResearchState): number {
  return resolveResearchMultiplier(getDefenseTowerResearchLevels(ageId, researchState).defenseLevel);
}

export function getDefenseTowerMaxHp(ageId: AgeId, _researchState?: TeamResearchState): number {
  return Math.max(1, Math.round(getDefenseTowerBaseHp(ageId)));
}

export function getDefenseTowerDefense(ageId: AgeId, researchState?: TeamResearchState): number {
  return Math.max(0, Math.round(getDefenseTowerBaseDefense(ageId) * getDefenseTowerDefenseMultiplier(ageId, researchState)));
}

export function shouldGrantTowerResearchCarryover(
  previousAgeId: AgeId,
  nextAgeId: AgeId,
  researchState: TeamResearchState,
  stat: "attack" | "defense",
): boolean {
  if (stat === "attack") {
    return getDefenseTowerAttackMultiplier(previousAgeId, researchState) > getDefenseTowerAttackMultiplier(nextAgeId, researchState);
  }
  return getDefenseTowerDefense(previousAgeId, researchState) > getDefenseTowerDefense(nextAgeId, researchState);
}
