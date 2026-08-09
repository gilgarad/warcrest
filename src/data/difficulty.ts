export type DifficultyId = "beginner" | "intermediate" | "advanced" | "god";

export interface DifficultyDef {
  id: DifficultyId;
  label: string;
  /** Multiplies the enemy team's per-worker resource production (gold/wood/food/metal/research). */
  enemyProductionMultiplier: number;
  /** Enemy attack/defense research level floor, applied in every age regardless of actual research spent. */
  enemyResearchLevelFloor: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: "beginner", label: "초급", enemyProductionMultiplier: 1, enemyResearchLevelFloor: 0 },
  { id: "intermediate", label: "중급", enemyProductionMultiplier: 2, enemyResearchLevelFloor: 1 },
  { id: "advanced", label: "고급", enemyProductionMultiplier: 3, enemyResearchLevelFloor: 2 },
  { id: "god", label: "신", enemyProductionMultiplier: 4, enemyResearchLevelFloor: 3 },
];

export function getDifficulty(id: DifficultyId | undefined): DifficultyDef {
  return DIFFICULTIES.find((entry) => entry.id === id) ?? DIFFICULTIES[0];
}
