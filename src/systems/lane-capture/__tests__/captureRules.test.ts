import { describe, expect, it } from "vitest";
import {
  getBuildingDefinition,
  getTowerBuildCost,
  getTowerMaxHp,
  getTowerRepairCost,
  resolveCapturedBuilding,
} from "../captureRules";

describe("capture rules", () => {
  it("scales tower construction and repair by age", () => {
    expect(getTowerBuildCost("stone")).toEqual({ gold: 10, wood: 10 });
    expect(getTowerBuildCost("bronze")).toEqual({ gold: 14, wood: 14 });
    expect(getTowerBuildCost("iron_late")).toEqual({ gold: 26, wood: 26, metal: 12 });
    expect(getTowerRepairCost("bronze")).toEqual({ gold: 7, wood: 7 });
    expect(getTowerMaxHp("stone")).toBe(130);
    expect(getTowerMaxHp("iron_late")).toBeGreaterThan(getTowerMaxHp("stone"));
  });

  it("owns the building catalogue outside the scene", () => {
    expect(getBuildingDefinition("supply_depot").cost).toEqual({ gold: 18, wood: 12, food: 10 });
  });

  it("resolves destruction and level-loss capture branches", () => {
    expect(resolveCapturedBuilding("mint", 3, 0.69, 1).result).toBe("destroyed");
    expect(resolveCapturedBuilding("mint", 3, 0.7, 1)).toMatchObject({
      buildingId: "mint",
      buildingLevel: 2,
      result: "captured",
      levelDrop: 1,
    });
    expect(resolveCapturedBuilding("mint", 2, 0.9, 3).result).toBe("collapsed");
  });
});
