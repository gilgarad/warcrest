import type { AgeId } from "../../data/ages";
import { clampResearchLevel } from "../lane-economy/researchRules";
import { getAppliedResearchLevels, type TeamResearchState } from "../lane-economy/researchState";
import { resolveResearchMultiplier } from "../lane-economy/researchRules";
import { getSupportWagonAgeStats, UNIT_STATS, type LaneUnitId, type UnitStatDef } from "./unitStats";

export function resolveResearchedUnitValue(baseValue: number, level: number): number {
  return Math.max(0, Math.round(baseValue * resolveResearchMultiplier(level)));
}

export function resolveSpawnUnitStats(
  unitId: LaneUnitId,
  productionAgeId: AgeId,
  researchState: TeamResearchState,
  researchLevelFloor = 0,
): UnitStatDef {
  const baseStats = unitId === "supply_wagon"
    ? (() => {
      const supportAgeStats = getSupportWagonAgeStats(productionAgeId);
      const baseline = UNIT_STATS.supply_wagon;
      return {
        ...baseline,
        hp: supportAgeStats.hp,
        attack: supportAgeStats.attack,
        defense: supportAgeStats.defense,
        range: supportAgeStats.range,
        rangeMultiplier: supportAgeStats.range / 4.4,
        speed: supportAgeStats.speed,
        textureKey: supportAgeStats.textureKey,
        tint: supportAgeStats.tint,
      };
    })()
    : UNIT_STATS[unitId];
  const levels = getAppliedResearchLevels(researchState, productionAgeId, unitId);
  const attackLevel = Math.max(levels.attackLevel, researchLevelFloor);
  const defenseLevel = Math.max(levels.defenseLevel, researchLevelFloor);
  return {
    ...baseStats,
    attack: resolveResearchedUnitValue(baseStats.attack, clampResearchLevel(productionAgeId, attackLevel)),
    defense: resolveResearchedUnitValue(baseStats.defense, clampResearchLevel(productionAgeId, defenseLevel)),
  };
}
