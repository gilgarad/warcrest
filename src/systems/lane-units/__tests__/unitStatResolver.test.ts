import { describe, expect, it } from "vitest";
import { createTeamResearchState } from "../../lane-economy/researchState";
import { adjustDraftResearchLevel, applyResearchDraft } from "../../lane-economy/researchRules";
import { makeResourceMap } from "../../lane-economy/laneEconomy";
import { resolveSpawnUnitStats } from "../unitStatResolver";

describe("unit stat resolver", () => {
  it("keeps baseline stats when no research is applied", () => {
    const research = createTeamResearchState();
    const stats = resolveSpawnUnitStats("stone_axeman", "stone", research);
    expect(stats.attack).toBe(9);
    expect(stats.defense).toBe(3);
  });

  it("resolves attack and defense from the production age research table", () => {
    const research = createTeamResearchState();
    const resources = makeResourceMap(0, 0, 0, 0, 60);
    adjustDraftResearchLevel(research, "bronze", "bronze_swordsman", "attack", 1);
    adjustDraftResearchLevel(research, "bronze", "bronze_swordsman", "attack", 1);
    adjustDraftResearchLevel(research, "bronze", "bronze_swordsman", "defense", 1);
    expect(applyResearchDraft(resources, research, "bronze")).toBe(true);

    const bronzeStats = resolveSpawnUnitStats("bronze_swordsman", "bronze", research);
    const stoneStats = resolveSpawnUnitStats("bronze_swordsman", "stone", research);

    expect(bronzeStats.attack).toBe(14);
    expect(bronzeStats.defense).toBe(6);
    expect(stoneStats.attack).toBe(12);
    expect(stoneStats.defense).toBe(5);
  });

  it("resolves support wagon stats by production age band", () => {
    const research = createTeamResearchState();

    const stone = resolveSpawnUnitStats("supply_wagon", "stone", research);
    const ironLate = resolveSpawnUnitStats("supply_wagon", "iron_late", research);
    const renaissance = resolveSpawnUnitStats("supply_wagon", "renaissance", research);
    const industrialLate = resolveSpawnUnitStats("supply_wagon", "industrial_late", research);
    const modernMid = resolveSpawnUnitStats("supply_wagon", "modern_mid", research);

    expect(stone.hp).toBe(28);
    expect(stone.defense).toBe(1);
    expect(stone.range).toBe(3);

    expect(ironLate.hp).toBe(40);
    expect(ironLate.defense).toBe(3);
    expect(ironLate.range).toBe(3.5);

    expect(renaissance.hp).toBe(60);
    expect(renaissance.defense).toBe(8);
    expect(renaissance.range).toBe(4);

    expect(industrialLate.hp).toBe(80);
    expect(industrialLate.defense).toBe(14);
    expect(industrialLate.range).toBe(4.5);

    expect(modernMid.hp).toBe(140);
    expect(modernMid.defense).toBe(40);
    expect(modernMid.range).toBe(5.5);
  });
});
