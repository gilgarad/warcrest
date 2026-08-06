import { describe, expect, it } from "vitest";
import { adjustDraftResearchLevel, applyResearchDraft } from "../../lane-economy/researchRules";
import { makeResourceMap } from "../../lane-economy/laneEconomy";
import { createTeamResearchState } from "../../lane-economy/researchState";
import { TOWER_RESEARCH_SUBJECT_ID } from "../../lane-economy/researchSubjects";
import {
  getDefenseTowerDefense,
  getDefenseTowerAttackMultiplier,
  getDefenseTowerMaxHp,
  shouldGrantTowerResearchCarryover,
} from "../defenseTowerRules";

describe("defense tower rules", () => {
  it("scales tower attack and defense from dedicated tower research", () => {
    const research = createTeamResearchState();
    const resources = makeResourceMap(0, 0, 0, 0, 160);
    adjustDraftResearchLevel(research, "industrial_early", TOWER_RESEARCH_SUBJECT_ID, "attack", 1);
    adjustDraftResearchLevel(research, "industrial_early", TOWER_RESEARCH_SUBJECT_ID, "defense", 1);
    expect(applyResearchDraft(resources, research, "industrial_early")).toBe(true);

    expect(getDefenseTowerAttackMultiplier("industrial_early", research)).toBeCloseTo(1.1);
    expect(getDefenseTowerDefense("industrial_early", research)).toBeGreaterThan(getDefenseTowerDefense("industrial_early"));
    expect(getDefenseTowerMaxHp("industrial_early", research)).toBe(getDefenseTowerMaxHp("industrial_early"));
  });

  it("flags carryover when the previous age tower research outpaces the next age baseline", () => {
    const research = createTeamResearchState();
    const resources = makeResourceMap(0, 0, 0, 0, 40);
    adjustDraftResearchLevel(research, "stone", TOWER_RESEARCH_SUBJECT_ID, "attack", 1);
    expect(applyResearchDraft(resources, research, "stone")).toBe(true);

    expect(shouldGrantTowerResearchCarryover("stone", "bronze", research, "attack")).toBe(true);
    expect(shouldGrantTowerResearchCarryover("stone", "bronze", research, "defense")).toBe(false);
  });
});
