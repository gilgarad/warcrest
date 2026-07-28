import { describe, expect, it } from "vitest";
import {
  getBuildingDefinition,
  resolveCapturedBuilding,
} from "../captureRules";

describe("capture rules", () => {
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
