import { AGES, getAge, getAgeIndex, type AgeId } from "../data/ages";
import { type BattleUnitId, getWaveRoster } from "../data/unitRosters";
import { TOWER_RESEARCH_SUBJECT_ID, type ResearchSubjectId } from "../systems/lane-economy/researchSubjects";
import type { TeamState } from "../systems/lane-economy/laneEconomy";
import {
  canApplyResearchDraft,
  canDecrementResearchLevel,
  clampResearchLevel,
  getDraftResearchApplyCost,
  getResearchLevelCap,
  getResearchPointCostPerLevel,
  resolveResearchMultiplier,
} from "../systems/lane-economy/researchRules";
import {
  getAppliedResearchLevels,
  getDraftResearchLevels,
  type TeamResearchState,
} from "../systems/lane-economy/researchState";
import { UNIT_STATS } from "../systems/lane-units/unitStats";

export interface BaseResearchPanelRow {
  subjectId: ResearchSubjectId;
  iconTextureKey: string;
  label: string;
  attackLevel: number;
  defenseLevel: number;
  appliedAttackLevel: number;
  appliedDefenseLevel: number;
  attackCanDecrease: boolean;
  defenseCanDecrease: boolean;
  attackMultiplierText: string;
  defenseMultiplierText: string;
}

export interface BaseResearchPanelSnapshot {
  title: string;
  ageLabel: string;
  productionHint: string;
  researchText: string;
  capText: string;
  applyLabel: string;
  applyEnabled: boolean;
  canBrowsePrev: boolean;
  canBrowseNext: boolean;
  rows: BaseResearchPanelRow[];
}

export interface BaseResearchPanelInput {
  team: TeamState;
  researchState: TeamResearchState;
  viewedAgeId: AgeId;
  freeApply?: boolean;
}

function uniqueBattleUnits(ageId: AgeId): BattleUnitId[] {
  const seen = new Set<BattleUnitId>();
  const ordered: BattleUnitId[] = [];
  getWaveRoster(ageId).battleline.forEach((entry) => {
    if (seen.has(entry.unitId)) return;
    seen.add(entry.unitId);
    ordered.push(entry.unitId);
  });
  return ordered;
}

function formatMultiplier(level: number): string {
  return `x${resolveResearchMultiplier(level).toFixed(1)}`;
}

function createResearchRow(
  researchState: TeamResearchState,
  ageId: AgeId,
  subjectId: ResearchSubjectId,
  label: string,
  iconTextureKey: string,
): BaseResearchPanelRow {
  const draft = getDraftResearchLevels(researchState, ageId, subjectId);
  const applied = getAppliedResearchLevels(researchState, ageId, subjectId);
  return {
    subjectId,
    iconTextureKey,
    label,
    attackLevel: clampResearchLevel(ageId, draft.attackLevel),
    defenseLevel: clampResearchLevel(ageId, draft.defenseLevel),
    appliedAttackLevel: clampResearchLevel(ageId, applied.attackLevel),
    appliedDefenseLevel: clampResearchLevel(ageId, applied.defenseLevel),
    attackCanDecrease: canDecrementResearchLevel(researchState, ageId, subjectId, "attack"),
    defenseCanDecrease: canDecrementResearchLevel(researchState, ageId, subjectId, "defense"),
    attackMultiplierText: formatMultiplier(clampResearchLevel(ageId, draft.attackLevel)),
    defenseMultiplierText: formatMultiplier(clampResearchLevel(ageId, draft.defenseLevel)),
  };
}

export function createBaseResearchPanelSnapshot(input: BaseResearchPanelInput): BaseResearchPanelSnapshot {
  const currentAge = getAge(input.team.ageId);
  const viewedAge = getAge(input.viewedAgeId);
  const viewedAgeIndex = getAgeIndex(input.viewedAgeId);
  const currentAgeIndex = getAgeIndex(input.team.ageId);
  const rows = uniqueBattleUnits(input.viewedAgeId).map((unitId) => createResearchRow(
    input.researchState,
    input.viewedAgeId,
    unitId,
    UNIT_STATS[unitId].label,
    UNIT_STATS[unitId].textureKey,
  ));
  if (input.viewedAgeId === input.team.ageId) {
    rows.push(createResearchRow(
      input.researchState,
      input.viewedAgeId,
      TOWER_RESEARCH_SUBJECT_ID,
      "방어 타워",
      "tower-player",
    ));
  }
  const applyCost = getDraftResearchApplyCost(input.researchState, input.viewedAgeId);
  const levelCap = getResearchLevelCap(input.viewedAgeId);
  const pointCost = getResearchPointCostPerLevel(input.viewedAgeId);
  return {
    title: "본진 연구 / 생산",
    ageLabel: `${viewedAge.label}${input.viewedAgeId === input.team.ageId ? "" : ` · 현재 시대 ${currentAge.label}`}`,
    productionHint: `현재 웨이브 생산: ${viewedAge.label}`,
    researchText: `연구 ${Math.round(input.team.resources.research)}R | 적용 비용 ${applyCost}R`,
    capText: `1포인트당 ${pointCost}R | 최대 ${levelCap}`,
    applyLabel: applyCost > 0
      ? input.freeApply ? `DEV 무료 적용 (${applyCost}R)` : `적용 ${applyCost}R`
      : "적용 대기 없음",
    applyEnabled: applyCost > 0 && (input.freeApply || canApplyResearchDraft(input.team.resources, input.researchState, input.viewedAgeId)),
    canBrowsePrev: viewedAgeIndex > 0,
    canBrowseNext: viewedAgeIndex < currentAgeIndex,
    rows,
  };
}

export function getBrowsableAgeIds(currentAgeId: AgeId): AgeId[] {
  return AGES.slice(0, getAgeIndex(currentAgeId) + 1).map((age) => age.id);
}
