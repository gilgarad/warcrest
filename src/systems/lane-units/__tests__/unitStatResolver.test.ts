import { describe, expect, it } from "vitest";
import { createTeamResearchState } from "../../lane-economy/researchState";
import { adjustDraftResearchLevel, applyResearchDraft } from "../../lane-economy/researchRules";
import { makeResourceMap } from "../../lane-economy/laneEconomy";
import { resolveSpawnUnitStats } from "../unitStatResolver";
import { BATTLE_UNIT_MOVE_SPEEDS, UNIT_STATS } from "../unitStats";

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

  it("applies every configured battle-unit movement multiplier", () => {
    const expected = {
      stone_slinger: 1,
      stone_axeman: 1,
      bronze_swordsman: 1,
      bronze_spearman: 1,
      archer: 1,
      iron_swordsman: 1,
      iron_spearman: 1,
      musketeer: 1.2,
      knight: 1.5,
      pikeman: 0.8,
      heavy_cavalry: 1.2,
      rifleman: 1.2,
      grenadier: 1.2,
      light_cavalry: 1.5,
      cannon_i: 0.8,
      rifleman_late: 1.2,
      grenadier_late: 1.2,
      cavalry: 1.5,
      cannon_ii: 0.8,
      infantry: 1.2,
      machine_gunner: 1,
      shock_trooper: 1.2,
      artillery_i: 1.2,
      automatic_rifleman: 1.2,
      support_gunner: 1.2,
      mobile_infantry: 1.2,
      artillery_ii: 1.2,
      tank: 1.5,
      special_forces: 1.2,
      heavy_gunner: 1,
      breakthrough_trooper: 1.2,
      mobile_artillery: 1.5,
      modern_tank: 1.5,
    } as const;

    expect(BATTLE_UNIT_MOVE_SPEEDS).toEqual(expected);
    expect(Object.fromEntries(
      Object.keys(BATTLE_UNIT_MOVE_SPEEDS).map((unitId) => [
        unitId,
        UNIT_STATS[unitId as keyof typeof BATTLE_UNIT_MOVE_SPEEDS].speed,
      ]),
    )).toEqual(expected);
  });

  it("resolves support movement speed from the production age", () => {
    const research = createTeamResearchState();
    const expected = {
      stone: 0.8,
      bronze: 0.8,
      iron_early: 0.8,
      iron_mid: 0.8,
      iron_late: 1,
      renaissance: 1,
      industrial_early: 1.2,
      industrial_late: 1.2,
      modern_early: 1.3,
      modern_mid: 1.3,
      modern_late: 1.3,
    } as const;

    Object.entries(expected).forEach(([ageId, speed]) => {
      expect(resolveSpawnUnitStats("supply_wagon", ageId as keyof typeof expected, research).speed).toBe(speed);
    });
  });
});
