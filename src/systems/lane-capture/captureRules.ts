import type { ResourceCost } from "../../data/balance";
import type { CaptureBuildingId } from "../../data/capturePointDefinitions";

export type BuildingId = CaptureBuildingId;

export interface BuildingDefinition {
  id: BuildingId;
  label: string;
  shortLabel: string;
  cost: ResourceCost;
  description: string;
}

export interface CapturedBuildingOutcome {
  buildingId?: BuildingId;
  buildingLevel: number;
  result: "none" | "destroyed" | "collapsed" | "captured";
  levelDrop: number;
}

export const DISMANTLE_COST_GOLD = 8;

export const BUILDING_DEFINITIONS: readonly BuildingDefinition[] = [
  { id: "supply_depot", label: "병참", shortLabel: "병참", cost: { gold: 18, wood: 12, food: 10 }, description: "근처 아군 치유와 보급" },
  { id: "mint", label: "조달소", shortLabel: "조달", cost: { gold: 16, wood: 10, metal: 8 }, description: "주기적으로 금 수급" },
];

export function getBuildingDefinition(id: BuildingId): BuildingDefinition {
  const definition = BUILDING_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) throw new Error(`Unknown capture building: ${id}`);
  return definition;
}

export function resolveCapturedBuilding(
  buildingId: BuildingId | undefined,
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
