import type { AgeId } from "../../data/ages";
import type { ResearchSubjectId } from "./researchSubjects";

export interface UnitResearchLevels {
  attackLevel: number;
  defenseLevel: number;
}

export interface TeamResearchState {
  applied: Partial<Record<AgeId, Partial<Record<ResearchSubjectId, UnitResearchLevels>>>>;
  draft: Partial<Record<AgeId, Partial<Record<ResearchSubjectId, UnitResearchLevels>>>>;
}

const ZERO_LEVELS: Readonly<UnitResearchLevels> = Object.freeze({ attackLevel: 0, defenseLevel: 0 });

export function createTeamResearchState(): TeamResearchState {
  return {
    applied: {},
    draft: {},
  };
}

export function cloneResearchLevels(levels: UnitResearchLevels): UnitResearchLevels {
  return {
    attackLevel: levels.attackLevel,
    defenseLevel: levels.defenseLevel,
  };
}

export function getAppliedResearchLevels(
  researchState: TeamResearchState,
  ageId: AgeId,
  unitId: ResearchSubjectId,
): UnitResearchLevels {
  return researchState.applied[ageId]?.[unitId] ?? ZERO_LEVELS;
}

export function getDraftResearchLevels(
  researchState: TeamResearchState,
  ageId: AgeId,
  unitId: ResearchSubjectId,
): UnitResearchLevels {
  const draft = researchState.draft[ageId]?.[unitId];
  return draft ?? cloneResearchLevels(getAppliedResearchLevels(researchState, ageId, unitId));
}

export function setDraftResearchLevels(
  researchState: TeamResearchState,
  ageId: AgeId,
  unitId: ResearchSubjectId,
  levels: UnitResearchLevels,
): void {
  const ageDraft = researchState.draft[ageId] ?? {};
  ageDraft[unitId] = cloneResearchLevels(levels);
  researchState.draft[ageId] = ageDraft;
}

export function discardResearchDraftForAge(researchState: TeamResearchState, ageId: AgeId): void {
  delete researchState.draft[ageId];
}

export function getDraftResearchEntriesForAge(
  researchState: TeamResearchState,
  ageId: AgeId,
): Array<[ResearchSubjectId, UnitResearchLevels]> {
  return Object.entries(researchState.draft[ageId] ?? {}) as Array<[ResearchSubjectId, UnitResearchLevels]>;
}
