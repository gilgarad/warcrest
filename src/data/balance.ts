import { AGES, type AgeId } from "./ages";
import type { ResourceId } from "./resources";

export interface ResourceCost {
  [resourceId: string]: number;
}

export interface OpponentScalePreset {
  opponentCount: 1 | 2 | 3;
  productionMultiplier: number;
  foodCostMultiplier: number;
  upkeepMultiplier: number;
  rewardMultiplier: number;
}

export const BASE_WORKER_COST: ResourceCost = {
  gold: 10,
  wood: 10,
  food: 10,
};

export const WAVE_INTERVAL_SEC = 30;
export const INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC = 10;
export const AI_INSTANT_WAVE_MIN_REMAINING_RATIO = 22 / 90;
export const AI_INSTANT_WAVE_MIN_REMAINING_SEC = WAVE_INTERVAL_SEC * AI_INSTANT_WAVE_MIN_REMAINING_RATIO;
export const BASE_RESOURCE_TICK_SEC = 5;
export const EVENT_WAVE_BONUS_MIN = 1;
export const EVENT_WAVE_BONUS_MAX = 3;
export const EVENT_EXTRA_UNIT_COUNT = 1;

// User direction fixed the scaling shape; exact values are an initial tuning pass.
export const OPPONENT_SCALE_PRESETS: OpponentScalePreset[] = [
  { opponentCount: 1, productionMultiplier: 1, foodCostMultiplier: 1, upkeepMultiplier: 1, rewardMultiplier: 1 },
  { opponentCount: 2, productionMultiplier: 1.85, foodCostMultiplier: 1.7, upkeepMultiplier: 1.65, rewardMultiplier: 1.5 },
  { opponentCount: 3, productionMultiplier: 2.7, foodCostMultiplier: 2.4, upkeepMultiplier: 2.3, rewardMultiplier: 2 },
];

export const MVP_ACTIVE_RESOURCE_IDS: ResourceId[] = ["gold", "wood", "food", "metal"];

export const AGE_BALANCE = AGES.map((age) => ({
  ageId: age.id,
  baseWaveFoodCost: age.baseWaveFoodCost,
  extraUnitFoodCost: age.bonusUnitFoodBase * 2,
  foodWorkerIntervalSec: age.foodWorkerIntervalSec,
  killGoldBase: age.killGoldBase,
}));

const RESEARCH_WORKER_COST_BY_AGE: Record<AgeId, ResourceCost> = {
  stone: { gold: 50, wood: 50, food: 50, metal: 50 },
  bronze: { gold: 75, wood: 75, food: 75, metal: 75 },
  iron_early: { gold: 100, wood: 100, food: 100, metal: 100 },
  iron_mid: { gold: 150, wood: 150, food: 150, metal: 150 },
  iron_late: { gold: 225, wood: 225, food: 225, metal: 225 },
};

export function getOpponentScale(opponentCount: 1 | 2 | 3): OpponentScalePreset {
  const found = OPPONENT_SCALE_PRESETS.find((preset) => preset.opponentCount === opponentCount);
  if (!found) throw new Error(`Unknown opponent scaling preset: ${opponentCount}`);
  return found;
}

export function getAgeBalance(ageId: AgeId) {
  const found = AGE_BALANCE.find((entry) => entry.ageId === ageId);
  if (!found) throw new Error(`Unknown age balance: ${ageId}`);
  return found;
}

export function getResearchWorkerDirectCost(ageId: AgeId): ResourceCost {
  return RESEARCH_WORKER_COST_BY_AGE[ageId];
}
