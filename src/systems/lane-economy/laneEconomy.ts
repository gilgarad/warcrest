import { AGES, type AgeId } from "../../data/ages";
import {
  BASE_RESOURCE_TICK_SEC,
  RESEARCH_RESOURCE_TICK_SEC,
  WAVE_INTERVAL_SEC,
  type ResourceCost,
} from "../../data/balance";
import type { ResourceId } from "../../data/resources";

export type TeamId = "player" | "enemy";
export type WorkerRole = "gold" | "wood" | "food" | "metal" | "research" | "idle";
export type WorkerResourceId = "gold" | "wood" | "food" | "metal";

export interface TeamState {
  id: TeamId;
  baseHp: number;
  ageId: AgeId;
  selectedProductionAgeId: AgeId;
  resources: Record<ResourceId, number>;
  workers: Record<WorkerRole, number>;
  instantWaveTokens: number;
  nextWaveInSec: number;
  lastWaveElapsedSec: number;
  pendingBonusWaves: number;
}

export function makeResourceMap(
  gold: number,
  wood: number,
  food: number,
  metal: number,
  research = 0,
): Record<ResourceId, number> {
  return { gold, wood, food, metal, research, gunpowder: 0, fuel: 0 };
}

export function createTeamState(
  id: TeamId,
  resources: Record<ResourceId, number>,
  baseHp: number,
): TeamState {
  return {
    id,
    baseHp,
    ageId: "stone",
    selectedProductionAgeId: "stone",
    resources,
    workers: {
      gold: 1,
      wood: 1,
      food: 1,
      metal: 1,
      research: 0,
      idle: 0,
    },
    instantWaveTokens: 0,
    nextWaveInSec: WAVE_INTERVAL_SEC,
    lastWaveElapsedSec: -100,
    pendingBonusWaves: 0,
  };
}

export function canAfford(resources: Record<ResourceId, number>, cost: ResourceCost): boolean {
  return Object.entries(cost).every(([key, value]) => resources[key as ResourceId] >= value);
}

export function payCost(resources: Record<ResourceId, number>, cost: ResourceCost): void {
  Object.entries(cost).forEach(([key, value]) => {
    resources[key as ResourceId] -= value;
  });
}

export function tickLaneEconomy(
  teams: readonly TeamState[],
  workerAccumulator: Map<string, number>,
  deltaSec: number,
): void {
  teams.forEach((team) => {
    tickResourceWorker(team, workerAccumulator, "gold", deltaSec, BASE_RESOURCE_TICK_SEC);
    tickResourceWorker(team, workerAccumulator, "wood", deltaSec, BASE_RESOURCE_TICK_SEC);
    tickResourceWorker(team, workerAccumulator, "food", deltaSec, BASE_RESOURCE_TICK_SEC);
    tickResourceWorker(team, workerAccumulator, "metal", deltaSec, BASE_RESOURCE_TICK_SEC);
    tickResourceWorker(team, workerAccumulator, "research", deltaSec, RESEARCH_RESOURCE_TICK_SEC);
  });
}

export function getAgeUpCost(ageIndex: number): ResourceCost {
  const base = { gold: 35, wood: 20, metal: 28 };
  if (ageIndex <= 0) return base;
  let gold = base.gold;
  let wood = base.wood;
  let metal = base.metal;
  for (let index = 0; index < ageIndex; index += 1) {
    gold = Math.round(gold * 1.5);
    wood = Math.round(wood * 1.5);
    metal = Math.round(metal * 1.5);
  }
  return { gold, wood, metal };
}

export function shouldAdvanceAiAge(
  team: TeamState,
  elapsedSec: number,
  thresholds: readonly number[] = [0, 55, 120, 190, 280, 375, 475, 580, 690, 805, 925],
): boolean {
  const ageIndex = AGES.findIndex((age) => age.id === team.ageId);
  if (ageIndex < 0 || ageIndex >= AGES.length - 1) return false;
  return elapsedSec >= thresholds[ageIndex + 1]
    && canAfford(team.resources, getAgeUpCost(ageIndex));
}

export function advanceTeamAge(team: TeamState): boolean {
  const ageIndex = AGES.findIndex((age) => age.id === team.ageId);
  if (ageIndex < 0 || ageIndex >= AGES.length - 1) return false;
  team.ageId = AGES[ageIndex + 1].id;
  team.selectedProductionAgeId = team.ageId;
  return true;
}

function tickResourceWorker(
  team: TeamState,
  workerAccumulator: Map<string, number>,
  resourceId: WorkerResourceId | "research",
  deltaSec: number,
  intervalSec: number,
): void {
  const workers = team.workers[resourceId];
  if (workers <= 0) return;
  const key = `${team.id}:${resourceId}`;
  const next = (workerAccumulator.get(key) ?? 0) + deltaSec;
  const producedPerWorker = Math.floor(next / intervalSec);
  if (producedPerWorker > 0) team.resources[resourceId] += producedPerWorker * workers;
  workerAccumulator.set(key, next % intervalSec);
}
