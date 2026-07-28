import { describe, expect, it } from "vitest";
import {
  UNIT_ANIMATION_ASSETS,
  getFrameCanvasAspect,
  getFrameVisibleHeightRatio,
  getUnitAnimationDefinition,
  resolveUnitAnimationTexture,
  resolveTeamUnitTextureKey,
  shouldFlipUnitFrame,
} from "../unitAnimationRegistry";

describe("unit animation registry", () => {
  it.each([
    "stone_axeman", "stone_slinger", "supply_wagon", "bronze_swordsman", "bronze_spearman",
    "archer", "iron_swordsman", "iron_spearman", "musketeer", "knight",
  ] as const)(
    "%s uses the shared normalized animation contract",
    (unitId) => {
      const definition = getUnitAnimationDefinition(unitId);
      expect(definition).toBeDefined();
      expect(definition?.groundOriginX).toBe(0.5);
      expect(definition?.groundOriginY).toBe(0.875);
      expect(definition?.referenceVisibleHeightRatio).toBeCloseTo(270 / 384);
      expect(definition?.nativeFacingX).toBe(-1);
      expect(definition?.attack.length).toBeGreaterThan(0);
    },
  );

  it("uses the approved wide production attack frame throughout the attack window", () => {
    expect(resolveUnitAnimationTexture("stone_axeman", false, 0, 0.1)).toBe("stone-axeman-attack");
    expect(resolveUnitAnimationTexture("stone_axeman", false, 0, 0.9)).toBe("stone-axeman-attack");
    expect(getFrameCanvasAspect("stone_axeman", "stone-axeman-idle")).toBe(1);
    expect(getFrameCanvasAspect("stone_axeman", "stone-axeman-attack")).toBeCloseTo(512 / 384);
  });

  it("registers the bronze spearman without a token fallback", () => {
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0)).toBe("bronze-spearman-idle");
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === "bronze-spearman-attack")).toBe(true);
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === "bronze-spearman-attack-enemy")).toBe(true);
  });

  it.each([
    ["bronze_swordsman", "bronze-swordsman"],
    ["archer", "archer"],
    ["iron_swordsman", "iron-swordsman"],
    ["iron_spearman", "iron-spearman"],
    ["musketeer", "musketeer"],
    ["knight", "knight"],
  ] as const)("registers production poses for %s", (unitId, prefix) => {
    expect(resolveUnitAnimationTexture(unitId, false, 0, 0)).toBe(`${prefix}-idle`);
    expect(resolveUnitAnimationTexture(unitId, true, 1, 0)).toBe(`${prefix}-walk-a`);
    expect(resolveUnitAnimationTexture(unitId, true, -1, 0)).toBe(`${prefix}-walk-b`);
    expect(resolveUnitAnimationTexture(unitId, false, 0, 0.5)).toBe(`${prefix}-attack`);
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === `${prefix}-attack-enemy`)).toBe(true);
  });

  it("records per-frame visible heights for scale normalization", () => {
    expect(getFrameVisibleHeightRatio("bronze_spearman", "bronze-spearman-attack")).toBeCloseTo(270 / 384);
    expect(getFrameVisibleHeightRatio("stone_axeman", "stone-axeman-attack")).toBeCloseTo(270 / 384);
  });

  it("selects team palette variants without whole-sprite tinting", () => {
    expect(resolveTeamUnitTextureKey("stone-axeman-idle", "player")).toBe("stone-axeman-idle");
    expect(resolveTeamUnitTextureKey("stone-axeman-idle", "enemy")).toBe("stone-axeman-idle-enemy");
    expect(shouldFlipUnitFrame("stone_axeman", -1)).toBe(false);
    expect(shouldFlipUnitFrame("stone_axeman", 1)).toBe(true);
  });
});
