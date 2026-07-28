import { DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID } from "./battlefieldMaps";

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
