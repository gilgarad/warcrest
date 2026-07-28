import { AGES, type AgeId } from "../../data/ages";
import type { ResourceCost } from "../../data/balance";
import type { CaptureBuildingId } from "../../data/capturePointDefinitions";
import { getWaveRoster } from "../../data/unitRosters";
import { UNIT_STATS } from "../lane-units/unitStats";

export type BuildingId = CaptureBuildingId;

export interface BuildingDefinition {
  id: BuildingId;
  label: string;
  shortLabel: string;
  cost: ResourceCost;
  description: string;
}

export interface CapturedBuildingOutcome {
  buildingId?: Exclude<BuildingId, "watchtower">;
  buildingLevel: number;
  result: "none" | "destroyed" | "collapsed" | "captured";
  levelDrop: number;
}

export const DISMANTLE_COST_GOLD = 8;

export const BUILDING_DEFINITIONS: readonly BuildingDefinition[] = [
  { id: "watchtower", label: "요새", shortLabel: "요새", cost: { gold: 10, wood: 10 }, description: "파괴된 타워 재건축" },
  { id: "supply_depot", label: "병참", shortLabel: "병참", cost: { gold: 18, wood: 12, food: 10 }, description: "근처 아군 치유와 보급" },
  { id: "mint", label: "조달소", shortLabel: "조달", cost: { gold: 16, wood: 10, metal: 8 }, description: "주기적으로 금 수급" },
];

export function getBuildingDefinition(id: BuildingId): BuildingDefinition {
  const definition = BUILDING_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) throw new Error(`Unknown capture building: ${id}`);
  return definition;
}

export function getTowerBuildCost(ageId: AgeId): ResourceCost {
  const ageIndex = AGES.findIndex((age) => age.id === ageId);
  return {
    gold: 10 + ageIndex * 4,
    wood: 10 + ageIndex * 4,
    ...(ageIndex >= 2 ? { metal: 4 + ageIndex * 2 } : {}),
  };
}

export function getTowerRepairCost(ageId: AgeId): ResourceCost {
  const rebuildCost = getTowerBuildCost(ageId);
  return {
    gold: Math.max(1, Math.ceil((rebuildCost.gold ?? 0) / 2)),
    wood: Math.max(1, Math.ceil((rebuildCost.wood ?? 0) / 2)),
  };
}

export function getTowerMaxHp(ageId: AgeId): number {
  const sampleRoster = getWaveRoster(ageId);
  const sampleUnit = sampleRoster.battleline[0]?.unitId ?? "stone_axeman";
  return UNIT_STATS[sampleUnit].hp * 5;
}

export function resolveCapturedBuilding(
  buildingId: Exclude<BuildingId, "watchtower"> | undefined,
  buildingLevel: number,
  randomFraction: number,
  randomLevelDrop: number,
): CapturedBuildingOutcome {
  if (!buildingId || buildingLevel <= 0) {
    return { buildingId: undefined, buildingLevel: 0, result: "none", levelDrop: 0 };
  }
  if (randomFraction < 0.7) {
    return { buildingId: undefined, buildingLevel: 0, result: "destroyed", levelDrop: 0 };
  }
  const levelDrop = Math.max(1, Math.min(3, Math.floor(randomLevelDrop)));
  const nextLevel = Math.max(0, buildingLevel - levelDrop);
  return {
    buildingId: nextLevel > 0 ? buildingId : undefined,
    buildingLevel: nextLevel,
    result: nextLevel > 0 ? "captured" : "collapsed",
    levelDrop,
  };
}
