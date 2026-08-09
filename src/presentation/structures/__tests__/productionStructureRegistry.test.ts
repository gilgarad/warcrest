import { describe, expect, it } from "vitest";
import {
  PRODUCTION_STRUCTURE_ASSETS,
  STRUCTURE_GROUND_ORIGIN,
  getCaptureMarkerTexture,
  getDefenseTowerFamily,
  getDefenseTowerTexture,
  getDefenseTowerVisibleHeightRatio,
  getMainBaseTexture,
} from "../productionStructureRegistry";

describe("production structure registry", () => {
  it("registers approved structures and team variants", () => {
    expect(PRODUCTION_STRUCTURE_ASSETS).toHaveLength(45);
    expect(new Set(PRODUCTION_STRUCTURE_ASSETS.map((asset) => asset.key)).size).toBe(45);
    expect(STRUCTURE_GROUND_ORIGIN).toEqual({ x: 0.5, y: 0.875 });
  });

  it("resolves state-specific tower scale and team textures", () => {
    expect(getDefenseTowerFamily("stone")).toBe("palisade");
    expect(getDefenseTowerFamily("industrial_early")).toBe("bastion");
    expect(getDefenseTowerTexture("modern_late", "construction", "enemy")).toBe("defense-tower-missile-construction-enemy");
    expect(getDefenseTowerVisibleHeightRatio("iron_late", "ruins")).toBeCloseTo(260 / 512);
    expect(getMainBaseTexture("enemy")).toBe("main-base-enemy");
    expect(getCaptureMarkerTexture("neutral")).toBe("capture-marker-neutral");
  });
});
