import {
  DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID,
  type BattlefieldMapSpec,
} from "./battlefieldMaps";

export type DefenseTowerAction = "rebuild-defense-tower";

export interface DefenseTowerDefinition {
  id: number;
  owner: "player" | "enemy";
  progress: number;
  linkedCapturePointId: number;
}

export const DEFENSE_TOWER_DEFINITIONS: readonly DefenseTowerDefinition[] = [
  { id: 0, owner: "player", progress: DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID[0], linkedCapturePointId: 0 },
  { id: 1, owner: "enemy", progress: DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID[1], linkedCapturePointId: 1 },
];

export function getDefenseTowerDefinitions(
  mapSpec?: BattlefieldMapSpec,
): readonly DefenseTowerDefinition[] {
  if (!mapSpec) return DEFENSE_TOWER_DEFINITIONS;
  const captureSockets = mapSpec.structureSockets.filter((socket) => socket.kind === "capture-point");
  const captureIds = new Map(captureSockets.map((socket, index) => [socket.id, index]));
  const sockets = mapSpec.structureSockets.filter((socket) => socket.kind === "defense-tower");
  if (sockets.length === 0) return DEFENSE_TOWER_DEFINITIONS;
  return sockets.map((socket, index) => ({
    id: index,
    owner: socket.teamOwner === "enemy" ? "enemy" : "player",
    progress: socket.progress,
    linkedCapturePointId: captureIds.get(socket.linkedSocketId ?? "") ?? 0,
  }));
}
