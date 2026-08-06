import { describe, expect, it } from "vitest";
import { createTeamResearchState, getAppliedResearchLevels, getDraftResearchLevels } from "../researchState";
import {
  adjustDraftResearchLevel,
  applyResearchDraft,
  canApplyResearchDraft,
  canDecrementResearchLevel,
  getDraftResearchApplyCost,
  resolveResearchMultiplier,
} from "../researchRules";
import { makeResourceMap } from "../laneEconomy";

describe("research rules", () => {
  it("keeps draft decrements above the applied baseline", () => {
    const research = createTeamResearchState();
    const resources = makeResourceMap(0, 0, 0, 0, 40);
    adjustDraftResearchLevel(research, "stone", "stone_axeman", "attack", 1);
    adjustDraftResearchLevel(research, "stone", "stone_axeman", "attack", 1);
    expect(getDraftResearchApplyCost(research, "stone")).toBe(40);
    expect(canApplyResearchDraft(resources, research, "stone")).toBe(true);
    expect(applyResearchDraft(resources, research, "stone")).toBe(true);
    expect(getAppliedResearchLevels(research, "stone", "stone_axeman").attackLevel).toBe(2);

    adjustDraftResearchLevel(research, "stone", "stone_axeman", "attack", -1);
    expect(getDraftResearchLevels(research, "stone", "stone_axeman").attackLevel).toBe(2);
    expect(canDecrementResearchLevel(research, "stone", "stone_axeman", "attack")).toBe(false);
  });

  it("applies draft atomically and clears it after spending research points", () => {
    const research = createTeamResearchState();
    const resources = makeResourceMap(0, 0, 0, 0, 60);

    adjustDraftResearchLevel(research, "bronze", "bronze_swordsman", "attack", 1);
    adjustDraftResearchLevel(research, "bronze", "bronze_swordsman", "defense", 1);
    adjustDraftResearchLevel(research, "bronze", "bronze_spearman", "attack", 1);

    expect(getDraftResearchApplyCost(research, "bronze")).toBe(60);
    expect(applyResearchDraft(resources, research, "bronze")).toBe(true);
    expect(resources.research).toBe(0);
    expect(getAppliedResearchLevels(research, "bronze", "bronze_swordsman")).toEqual({
      attackLevel: 1,
      defenseLevel: 1,
    });
    expect(getDraftResearchLevels(research, "bronze", "bronze_swordsman")).toEqual({
      attackLevel: 1,
      defenseLevel: 1,
    });
  });

  it("uses 10 percent per-level multipliers", () => {
    expect(resolveResearchMultiplier(0)).toBeCloseTo(1);
    expect(resolveResearchMultiplier(1)).toBeCloseTo(1.1);
    expect(resolveResearchMultiplier(5)).toBeCloseTo(1.5);
  });

  it("caps research level by age group", () => {
    const research = createTeamResearchState();
    for (let index = 0; index < 16; index += 1) {
      adjustDraftResearchLevel(research, "stone", "stone_axeman", "attack", 1);
    }
    expect(getDraftResearchLevels(research, "stone", "stone_axeman").attackLevel).toBe(10);
  });
});
