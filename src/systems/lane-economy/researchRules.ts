import { getAge, type AgeId } from "../../data/ages";
import type { ResourceId } from "../../data/resources";
import {
  discardResearchDraftForAge,
  getAppliedResearchLevels,
  getDraftResearchEntriesForAge,
  getDraftResearchLevels,
  setDraftResearchLevels,
  type TeamResearchState,
  type UnitResearchLevels,
} from "./researchState";
import type { ResearchSubjectId } from "./researchSubjects";

export type ResearchStatKey = "attack" | "defense";

export function getResearchPointCostPerLevel(ageId: AgeId): number {
  const group = getAge(ageId).productionGroup;
  if (group === "ancient" || group === "classical") return 20;
  if (group === "iron") return 40;
  if (group === "renaissance" || group === "industrial") return 80;
  return 160;
}

export function getResearchLevelCap(ageId: AgeId): number {
  const group = getAge(ageId).productionGroup;
  if (group === "ancient" || group === "classical") return 10;
  if (group === "iron") return 20;
  if (group === "renaissance" || group === "industrial") return 30;
  return 40;
}

export function clampResearchLevel(ageId: AgeId, level: number): number {
  return Math.max(0, Math.min(getResearchLevelCap(ageId), Math.floor(level)));
}

function toLevelKey(stat: ResearchStatKey): keyof UnitResearchLevels {
  return stat === "attack" ? "attackLevel" : "defenseLevel";
}

export function resolveResearchMultiplier(level: number): number {
  return 1 + Math.max(0, level) * 0.1;
}

export function canIncrementResearchLevel(
  researchState: TeamResearchState,
  ageId: AgeId,
  unitId: ResearchSubjectId,
  stat: ResearchStatKey,
): boolean {
  const key = toLevelKey(stat);
  return clampResearchLevel(ageId, getDraftResearchLevels(researchState, ageId, unitId)[key]) < getResearchLevelCap(ageId);
}

export function canDecrementResearchLevel(
  researchState: TeamResearchState,
  ageId: AgeId,
  unitId: ResearchSubjectId,
  stat: ResearchStatKey,
): boolean {
  const key = toLevelKey(stat);
  const applied = clampResearchLevel(ageId, getAppliedResearchLevels(researchState, ageId, unitId)[key]);
  const draft = clampResearchLevel(ageId, getDraftResearchLevels(researchState, ageId, unitId)[key]);
  return draft > applied;
}

export function adjustDraftResearchLevel(
  researchState: TeamResearchState,
  ageId: AgeId,
  unitId: ResearchSubjectId,
  stat: ResearchStatKey,
  delta: 1 | -1,
): UnitResearchLevels {
  const next = getDraftResearchLevels(researchState, ageId, unitId);
  const key = toLevelKey(stat);
  const applied = clampResearchLevel(ageId, getAppliedResearchLevels(researchState, ageId, unitId)[key]);
  const candidate = clampResearchLevel(ageId, next[key]) + delta;
  next[key] = delta > 0
    ? Math.min(getResearchLevelCap(ageId), candidate)
    : Math.max(applied, candidate);
  setDraftResearchLevels(researchState, ageId, unitId, next);
  return next;
}

export function getDraftResearchApplyCost(
  researchState: TeamResearchState,
  ageId: AgeId,
): number {
  const costPerLevel = getResearchPointCostPerLevel(ageId);
  return getDraftResearchEntriesForAge(researchState, ageId).reduce((total, [unitId, draft]) => {
    const applied = getAppliedResearchLevels(researchState, ageId, unitId);
    const attackDelta = Math.max(0, clampResearchLevel(ageId, draft.attackLevel) - clampResearchLevel(ageId, applied.attackLevel));
    const defenseDelta = Math.max(0, clampResearchLevel(ageId, draft.defenseLevel) - clampResearchLevel(ageId, applied.defenseLevel));
    return total + (attackDelta + defenseDelta) * costPerLevel;
  }, 0);
}

export function canApplyResearchDraft(
  resources: Record<ResourceId, number>,
  researchState: TeamResearchState,
  ageId: AgeId,
): boolean {
  const cost = getDraftResearchApplyCost(researchState, ageId);
  return cost > 0 && resources.research >= cost;
}

export function applyResearchDraft(
  resources: Record<ResourceId, number>,
  researchState: TeamResearchState,
  ageId: AgeId,
): boolean {
  const cost = getDraftResearchApplyCost(researchState, ageId);
  if (cost <= 0 || resources.research < cost) return false;
  const ageDraft = getDraftResearchEntriesForAge(researchState, ageId);
  if (ageDraft.length === 0) return false;
  resources.research -= cost;
  const nextApplied = researchState.applied[ageId] ?? {};
  ageDraft.forEach(([unitId, draft]) => {
    nextApplied[unitId] = {
      attackLevel: clampResearchLevel(ageId, draft.attackLevel),
      defenseLevel: clampResearchLevel(ageId, draft.defenseLevel),
    };
  });
  researchState.applied[ageId] = nextApplied;
  discardResearchDraftForAge(researchState, ageId);
  return true;
}
