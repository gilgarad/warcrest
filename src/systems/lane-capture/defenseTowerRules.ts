import { AGES, type AgeId } from "../../data/ages";
import type { ResourceCost } from "../../data/balance";
import { getWaveRoster } from "../../data/unitRosters";
import { UNIT_STATS } from "../lane-units/unitStats";

export const DEFENSE_TOWER_BUILD_DURATION_SEC = 10;

export function getDefenseTowerBuildCost(ageId: AgeId): ResourceCost {
  const ageIndex = AGES.findIndex((age) => age.id === ageId);
  return {
    gold: 10 + ageIndex * 4,
    wood: 10 + ageIndex * 4,
    ...(ageIndex >= 2 ? { metal: 4 + ageIndex * 2 } : {}),
  };
}

export function getDefenseTowerMaxHp(ageId: AgeId): number {
  const roster = getWaveRoster(ageId);
  const sampleUnit = roster.battleline[0]?.unitId ?? "stone_axeman";
  return UNIT_STATS[sampleUnit].hp * 25;
}
