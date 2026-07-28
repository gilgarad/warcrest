import { describe, expect, it } from "vitest";
import {
  PRODUCTION_STRUCTURE_ASSETS,
  STRUCTURE_GROUND_ORIGIN,
  getCaptureMarkerTexture,
  getDefenseTowerTexture,
  getDefenseTowerVisibleHeightRatio,
  getMainBaseTexture,
} from "../productionStructureRegistry";

describe("production structure registry", () => {
  it("registers approved structures and team variants", () => {
    expect(PRODUCTION_STRUCTURE_ASSETS).toHaveLength(15);
    expect(new Set(PRODUCTION_STRUCTURE_ASSETS.map((asset) => asset.key)).size).toBe(15);
    expect(STRUCTURE_GROUND_ORIGIN).toEqual({ x: 0.5, y: 0.875 });
  });

  it("resolves state-specific tower scale and team textures", () => {
    expect(getDefenseTowerTexture("construction", "enemy")).toBe("defense-tower-construction-enemy");
    expect(getDefenseTowerVisibleHeightRatio("ruins")).toBeCloseTo(280 / 512);
    expect(getMainBaseTexture("enemy")).toBe("main-base-enemy");
    expect(getCaptureMarkerTexture("neutral")).toBe("capture-marker-neutral");
  });
});
