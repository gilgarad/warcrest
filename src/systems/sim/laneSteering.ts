import {
  COMBAT_PROGRESS_CLEARANCE,
  COMBAT_ROW_CLEARANCE,
  COMBAT_ROW_REACH,
} from "../lane-combat/laneOccupancy";
import { RANGE_TO_PROGRESS } from "../lane-units/rangeRules";
import { distance as euclidean, progressBetween } from "./simMath";

/**
 * Lane positioning and engagement geometry, as free functions over plain data.
 *
 * These moved off `LaneBattleScene` unchanged. They were already pure — they
 * only ever needed the unit list and some constants — but living on the scene
 * meant they could not be called or tested without a running Phaser game. Here
 * they run in Node, which is what a headless simulation, a Worker, or a server
 * needs.
 *
 * Everything takes `SteeringUnit`, a structural subset of the simulation's
 * unit. Nothing here can see a sprite even by accident.
 */

export interface SteeringUnit {
  id: number;
  team: string;
  laneId: string;
  role: string;
  progress: number;
  laneRow: number;
  range: number;
}

export interface SteeringSlot {
  progress: number;
  laneRow: number;
}

/** Minimum gap kept between friendly units in the same row. */
export const FRIENDLY_GAP = 0.013;
/** Extra reach a melee unit is allowed when deciding it can connect. */
export const MELEE_ENGAGE_TOLERANCE_PROGRESS = 0.0022;
/**
 * Lane rows are far narrower than lane progress in world terms, so a raw row
 * difference would swamp the distance. This scales rows into progress units.
 */
const ROW_TO_PROGRESS = 0.01;

export function isMeleeUnit(unit: SteeringUnit): boolean {
  return unit.role === "battle" && unit.range <= 2.5;
}

export function isRangedUnit(unit: SteeringUnit): boolean {
  return unit.role === "battle" && unit.range > 2.5;
}

export function unitDistance(a: SteeringUnit, b: SteeringUnit): number {
  return euclidean(progressBetween(a.progress, b.progress), Math.abs(a.laneRow - b.laneRow) * ROW_TO_PROGRESS);
}

/** No friendly unit is close enough in this row to block standing there. */
export function isLaneRowFree(units: readonly SteeringUnit[], unit: SteeringUnit, laneRow: number): boolean {
  return !units.some((other) =>
    other.id !== unit.id
    && other.team === unit.team
    && other.laneId === unit.laneId
    && Math.abs(other.laneRow - laneRow) < COMBAT_ROW_CLEARANCE
    && progressBetween(other.progress, unit.progress) < FRIENDLY_GAP,
  );
}

/** No friendly unit already occupies this combat slot. */
export function isCombatSlotFree(
  units: readonly SteeringUnit[],
  unit: SteeringUnit,
  slot: SteeringSlot,
  enemy: SteeringUnit,
): boolean {
  if (Math.abs(slot.laneRow - enemy.laneRow) > COMBAT_ROW_REACH + 0.001) return false;
  return !units.some((other) =>
    other.id !== unit.id
    && other.team === unit.team
    && other.laneId === unit.laneId
    && progressBetween(other.progress, slot.progress) < COMBAT_PROGRESS_CLEARANCE
    && Math.abs(other.laneRow - slot.laneRow) < COMBAT_ROW_CLEARANCE,
  );
}

/** Whether standing in `slot` puts `enemy` inside this unit's reach. */
export function canAttackEnemyFromSlot(unit: SteeringUnit, slot: SteeringSlot, enemy: SteeringUnit): boolean {
  const reach = euclidean(
    progressBetween(slot.progress, enemy.progress),
    Math.abs(slot.laneRow - enemy.laneRow) * ROW_TO_PROGRESS,
  );
  const tolerance = isMeleeUnit(unit) ? MELEE_ENGAGE_TOLERANCE_PROGRESS : 0;
  return reach <= unit.range * RANGE_TO_PROGRESS + tolerance;
}

/**
 * How crowded the ground just ahead of this unit is, in a given row.
 *
 * Weighted so a unit directly in front counts for more than one at the edge of
 * the window, which is what stops a column from all picking the same detour.
 */
export function getForwardLaneCongestion(
  units: readonly SteeringUnit[],
  unit: SteeringUnit,
  laneRow: number,
): number {
  const forwardWindow = 0.065;
  const rearWindow = 0.016;
  const dir = unit.team === "player" ? 1 : -1;
  return units.reduce((score, other) => {
    if (other.id === unit.id || other.team !== unit.team || other.laneId !== unit.laneId) return score;
    if (Math.abs(other.laneRow - laneRow) >= 0.6) return score;
    const relativeProgress = (other.progress - unit.progress) * dir;
    if (relativeProgress < -rearWindow || relativeProgress > forwardWindow) return score;
    const rowWeight = 1 - Math.min(1, Math.abs(other.laneRow - laneRow) / 0.6);
    const progressWeight = relativeProgress >= 0
      ? 1 - Math.min(1, relativeProgress / forwardWindow)
      : 0.4 * (1 - Math.min(1, Math.abs(relativeProgress) / rearWindow));
    return score + rowWeight * progressWeight;
  }, 0);
}

/** How crowded a specific slot is with friendly units. */
export function getFriendlySlotCongestion(
  units: readonly SteeringUnit[],
  unit: SteeringUnit,
  progress: number,
  laneRow: number,
): number {
  const progressWindow = 0.03;
  return units.reduce((score, other) => {
    if (other.id === unit.id || other.team !== unit.team || other.laneId !== unit.laneId) return score;
    const progressDistance = progressBetween(other.progress, progress);
    if (progressDistance >= progressWindow) return score;
    const rowDistance = Math.abs(other.laneRow - laneRow);
    if (rowDistance >= 1.2) return score;
    return score + (1 - progressDistance / progressWindow) * (1 - Math.min(1, rowDistance / 1.2));
  }, 0);
}

/**
 * Tie-break for equally good rows: prefer the side the enemy is on, and when
 * there is no enemy to lean toward, split by unit id so a column does not all
 * swerve the same way at once.
 */
export function getMirrorLanePreference(unit: SteeringUnit, laneRow: number, enemy?: SteeringUnit): number {
  const delta = laneRow - unit.laneRow;
  if (Math.abs(delta) < 0.001) return 0;
  const desiredDirection = enemy && Math.abs(enemy.laneRow - unit.laneRow) > 0.15
    ? Math.sign(enemy.laneRow - unit.laneRow)
    : (unit.id % 2 === 0 ? 1 : -1);
  return Math.sign(delta) === desiredDirection ? 0 : 1;
}
