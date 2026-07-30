import type { ResourceId } from "./resources";

export type AgeId = "stone" | "bronze" | "iron_early" | "iron_mid" | "iron_late";

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
    notes: "강철 시대가 아니라 중세 끝무렵을 뜻하는 단계.",
  },
];

export function getAge(id: AgeId): AgeDef {
  const found = AGES.find((age) => age.id === id);
  if (!found) throw new Error(`Unknown age: ${id}`);
  return found;
}
