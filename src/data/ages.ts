import type { ResourceId } from "./resources";

export type AgeId =
  | "stone"
  | "bronze"
  | "iron_early"
  | "iron_mid"
  | "iron_late"
  | "renaissance"
  | "industrial_early"
  | "industrial_late"
  | "modern_early"
  | "modern_mid"
  | "modern_late";

export type AgeProductionGroup = "ancient" | "classical" | "iron" | "renaissance" | "industrial" | "modern";

export interface AgeDef {
  id: AgeId;
  label: string;
  order: number;
  activeResourceIds: ResourceId[];
  baseWaveFoodCost: number;
  bonusUnitFoodBase: number;
  foodWorkerIntervalSec: number;
  killGoldBase: number;
  immediateWaveTokenGranted: boolean;
  researchPointTier: number;
  productionGroup: AgeProductionGroup;
  notes?: string;
}

export const AGES: AgeDef[] = [
  {
    id: "stone",
    label: "석기 시대",
    order: 0,
    activeResourceIds: ["gold", "wood", "food", "metal"],
    baseWaveFoodCost: 5,
    bonusUnitFoodBase: 2,
    foodWorkerIntervalSec: 5,
    killGoldBase: 6,
    immediateWaveTokenGranted: true,
    researchPointTier: 0,
    productionGroup: "ancient",
  },
  {
    id: "bronze",
    label: "청동기",
    order: 1,
    activeResourceIds: ["gold", "wood", "food", "metal"],
    baseWaveFoodCost: 8,
    bonusUnitFoodBase: 2,
    foodWorkerIntervalSec: 4,
    killGoldBase: 9,
    immediateWaveTokenGranted: true,
    researchPointTier: 1,
    productionGroup: "classical",
  },
  {
    id: "iron_early",
    label: "초기 철기",
    order: 2,
    activeResourceIds: ["gold", "wood", "food", "metal"],
    baseWaveFoodCost: 11,
    bonusUnitFoodBase: 3,
    foodWorkerIntervalSec: 3,
    killGoldBase: 12,
    immediateWaveTokenGranted: true,
    researchPointTier: 2,
    productionGroup: "iron",
  },
  {
    id: "iron_mid",
    label: "중기 철기",
    order: 3,
    activeResourceIds: ["gold", "wood", "food", "metal"],
    baseWaveFoodCost: 15,
    bonusUnitFoodBase: 3,
    foodWorkerIntervalSec: 2,
    killGoldBase: 18,
    immediateWaveTokenGranted: true,
    researchPointTier: 3,
    productionGroup: "iron",
  },
  {
    id: "iron_late",
    label: "후기 철기",
    order: 4,
    activeResourceIds: ["gold", "wood", "food", "metal"],
    baseWaveFoodCost: 20,
    bonusUnitFoodBase: 4,
    foodWorkerIntervalSec: 1,
    killGoldBase: 27,
    immediateWaveTokenGranted: true,
    researchPointTier: 4,
    productionGroup: "iron",
    notes: "강철 시대가 아니라 중세 끝무렵을 뜻하는 단계.",
  },
  {
    id: "renaissance",
    label: "르네상스",
    order: 5,
    activeResourceIds: ["gold", "wood", "food", "metal", "research"],
    baseWaveFoodCost: 24,
    bonusUnitFoodBase: 4,
    foodWorkerIntervalSec: 1,
    killGoldBase: 33,
    immediateWaveTokenGranted: true,
    researchPointTier: 5,
    productionGroup: "renaissance",
  },
  {
    id: "industrial_early",
    label: "근대 초기",
    order: 6,
    activeResourceIds: ["gold", "wood", "food", "metal", "research"],
    baseWaveFoodCost: 28,
    bonusUnitFoodBase: 5,
    foodWorkerIntervalSec: 1,
    killGoldBase: 40,
    immediateWaveTokenGranted: true,
    researchPointTier: 6,
    productionGroup: "industrial",
  },
  {
    id: "industrial_late",
    label: "근대 후기",
    order: 7,
    activeResourceIds: ["gold", "wood", "food", "metal", "research"],
    baseWaveFoodCost: 32,
    bonusUnitFoodBase: 5,
    foodWorkerIntervalSec: 1,
    killGoldBase: 48,
    immediateWaveTokenGranted: true,
    researchPointTier: 7,
    productionGroup: "industrial",
  },
  {
    id: "modern_early",
    label: "현대 초기",
    order: 8,
    activeResourceIds: ["gold", "wood", "food", "metal", "research"],
    baseWaveFoodCost: 36,
    bonusUnitFoodBase: 6,
    foodWorkerIntervalSec: 1,
    killGoldBase: 57,
    immediateWaveTokenGranted: true,
    researchPointTier: 8,
    productionGroup: "modern",
  },
  {
    id: "modern_mid",
    label: "현대 중기",
    order: 9,
    activeResourceIds: ["gold", "wood", "food", "metal", "research"],
    baseWaveFoodCost: 40,
    bonusUnitFoodBase: 6,
    foodWorkerIntervalSec: 1,
    killGoldBase: 67,
    immediateWaveTokenGranted: true,
    researchPointTier: 9,
    productionGroup: "modern",
  },
  {
    id: "modern_late",
    label: "현대 후기",
    order: 10,
    activeResourceIds: ["gold", "wood", "food", "metal", "research"],
    baseWaveFoodCost: 45,
    bonusUnitFoodBase: 7,
    foodWorkerIntervalSec: 1,
    killGoldBase: 78,
    immediateWaveTokenGranted: true,
    researchPointTier: 10,
    productionGroup: "modern",
  },
];

export function getAge(id: AgeId): AgeDef {
  const found = AGES.find((age) => age.id === id);
  if (!found) throw new Error(`Unknown age: ${id}`);
  return found;
}

export function getAgeIndex(id: AgeId): number {
  const index = AGES.findIndex((age) => age.id === id);
  if (index < 0) throw new Error(`Unknown age index: ${id}`);
  return index;
}

export function isFinalAge(id: AgeId): boolean {
  return getAgeIndex(id) >= AGES.length - 1;
}

export function getNextAge(id: AgeId): AgeDef | null {
  const index = getAgeIndex(id);
  return index >= AGES.length - 1 ? null : AGES[index + 1];
}
