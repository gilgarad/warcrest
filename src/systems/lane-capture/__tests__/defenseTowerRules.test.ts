import { describe, expect, it } from "vitest";
import { getDefenseTowerBuildCost, getDefenseTowerMaxHp } from "../defenseTowerRules";

describe("defense tower rules", () => {
  it("scales construction cost and hit points by age", () => {
    expect(getDefenseTowerBuildCost("stone")).toEqual({ gold: 10, wood: 10 });
    expect(getDefenseTowerBuildCost("bronze")).toEqual({ gold: 14, wood: 14 });
    expect(getDefenseTowerBuildCost("iron_late")).toEqual({ gold: 26, wood: 26, metal: 12 });
    expect(getDefenseTowerMaxHp("stone")).toBe(650);
    expect(getDefenseTowerMaxHp("iron_late")).toBeGreaterThan(getDefenseTowerMaxHp("stone"));
  });
});
