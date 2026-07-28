export type CaptureBuildingId = "watchtower" | "supply_depot" | "mint";
export type CapturePointType = "fixed-fortress" | "buildable";
export type CapturePointAction =
  | "build-watchtower"
  | "build-supply-depot"
  | "build-mint"
  | "repair-fortress"
  | "rebuild-fortress"
  | "dismantle";

export interface CapturePointDefinition {
  id: number;
  progress: number;
  pointType: CapturePointType;
  allowedBuildingTypes: readonly CaptureBuildingId[];
  initialBuilding: "fixed-fortress" | "watchtower" | null;
  canDemolish: boolean;
  canRepair: boolean;
  canRebuild: boolean;
  canReplaceBuilding: boolean;
}

export interface CapturePointActionState {
  owner: "player" | "enemy" | "neutral";
  buildingId?: Exclude<CaptureBuildingId, "watchtower">;
  towerBuilt: boolean;
  towerBuildRemainingSec: number;
  towerHp: number;
  towerMaxHp: number;
}

export const CAPTURE_POINT_DEFINITIONS: readonly CapturePointDefinition[] = [
  {
    id: 0,
    progress: 0.375,
    pointType: "buildable",
    allowedBuildingTypes: ["watchtower", "supply_depot", "mint"],
    initialBuilding: "watchtower",
    canDemolish: true,
    canRepair: false,
    canRebuild: true,
    canReplaceBuilding: true,
  },
  {
    id: 1,
    progress: 0.767,
    pointType: "buildable",
    allowedBuildingTypes: ["watchtower", "supply_depot", "mint"],
    initialBuilding: "watchtower",
    canDemolish: true,
    canRepair: false,
    canRebuild: true,
    canReplaceBuilding: true,
  },
];

export function getCapturePointActions(
  definition: CapturePointDefinition,
  state: CapturePointActionState,
): CapturePointAction[] {
  if (state.owner !== "player") return [];

  if (definition.pointType === "fixed-fortress") {
    if (state.towerBuildRemainingSec > 0) return [];
    if (!state.towerBuilt) return definition.canRebuild ? ["rebuild-fortress"] : [];
    if (definition.canRepair && state.towerHp < state.towerMaxHp) return ["repair-fortress"];
    return [];
  }

  const actions: CapturePointAction[] = [];
  if (
    definition.canRebuild
    && definition.allowedBuildingTypes.includes("watchtower")
    && !state.towerBuilt
    && state.towerBuildRemainingSec <= 0
  ) {
    actions.push("build-watchtower");
  }
  if (!state.buildingId) {
    if (definition.allowedBuildingTypes.includes("supply_depot")) actions.push("build-supply-depot");
    if (definition.allowedBuildingTypes.includes("mint")) actions.push("build-mint");
  }
  if (definition.canDemolish && Boolean(state.buildingId)) actions.push("dismantle");
  return actions;
}
