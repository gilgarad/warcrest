import {
  CAPTURE_POINT_PROGRESS,
  type BattlefieldMapSpec,
} from "./battlefieldMaps";

export type CaptureBuildingId = "supply_depot" | "mint";
export type CapturePointType = "buildable";
export type CapturePointAction =
  | "build-supply-depot"
  | "build-mint"
  | "dismantle";

export interface CapturePointDefinition {
  id: number;
  progress: number;
  pointType: CapturePointType;
  allowedBuildingTypes: readonly CaptureBuildingId[];
  initialBuilding: CaptureBuildingId | null;
  canDemolish: boolean;
  canReplaceBuilding: boolean;
}

export interface CapturePointActionState {
  owner: "player" | "enemy" | "neutral";
  buildingId?: CaptureBuildingId;
}

export const CAPTURE_POINT_DEFINITIONS: readonly CapturePointDefinition[] = [
  {
    id: 0,
    progress: CAPTURE_POINT_PROGRESS[0],
    pointType: "buildable",
    allowedBuildingTypes: ["supply_depot", "mint"],
    initialBuilding: null,
    canDemolish: true,
    canReplaceBuilding: true,
  },
  {
    id: 1,
    progress: CAPTURE_POINT_PROGRESS[1],
    pointType: "buildable",
    allowedBuildingTypes: ["supply_depot", "mint"],
    initialBuilding: null,
    canDemolish: true,
    canReplaceBuilding: true,
  },
];

export function getCapturePointDefinitions(
  mapSpec?: BattlefieldMapSpec,
): readonly CapturePointDefinition[] {
  if (!mapSpec) return CAPTURE_POINT_DEFINITIONS;
  const sockets = mapSpec.structureSockets.filter((socket) => socket.kind === "capture-point");
  if (sockets.length === 0) return CAPTURE_POINT_DEFINITIONS;
  return sockets.map((socket, index) => ({
    id: index,
    progress: socket.progress,
    pointType: "buildable",
    allowedBuildingTypes: ["supply_depot", "mint"],
    initialBuilding: null,
    canDemolish: true,
    canReplaceBuilding: true,
  }));
}

export function getCapturePointActions(
  definition: CapturePointDefinition,
  state: CapturePointActionState,
): CapturePointAction[] {
  if (state.owner !== "player") return [];

  const actions: CapturePointAction[] = [];
  if (!state.buildingId) {
    if (definition.allowedBuildingTypes.includes("supply_depot")) actions.push("build-supply-depot");
    if (definition.allowedBuildingTypes.includes("mint")) actions.push("build-mint");
  }
  if (definition.canDemolish && Boolean(state.buildingId)) actions.push("dismantle");
  return actions;
}
