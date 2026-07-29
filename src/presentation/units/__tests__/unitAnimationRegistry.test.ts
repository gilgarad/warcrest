import { describe, expect, it } from "vitest";
import {
  UNIT_ANIMATION_ASSETS,
  UNIT_FACING_DIRECTIONS,
  getAuthoredUnitDirections,
  getFrameCanvasAspect,
  getFrameVisibleHeightRatio,
  getUnitAnimationDefinition,
  hasCompleteUnitDirectionalSet,
  resolveUnitAnimationTexture,
  resolveUnitFacingDirection,
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
      expect(definition?.fallbackDirection).toBe("w");
      expect(definition?.directions.w?.attack.length).toBeGreaterThan(0);
      if ([
        "stone_axeman",
        "stone_slinger",
        "supply_wagon",
        "bronze_swordsman",
        "bronze_spearman",
        "archer",
        "iron_swordsman",
        "iron_spearman",
        "musketeer",
        "knight",
      ].includes(unitId)) {
        expect(definition?.legacyHorizontalMirror).toBe(false);
        expect(getAuthoredUnitDirections(unitId)).toEqual(UNIT_FACING_DIRECTIONS);
        expect(hasCompleteUnitDirectionalSet(unitId)).toBe(true);
      }
    },
  );

  it("uses the approved wide production attack frame throughout the attack window", () => {
    expect(resolveUnitAnimationTexture("stone_axeman", false, 0, 0.1)).toBe("stone-axeman-w-attack");
    expect(resolveUnitAnimationTexture("stone_axeman", false, 0, 0.9)).toBe("stone-axeman-w-attack");
    expect(getFrameCanvasAspect("stone_axeman", "stone-axeman-w-idle")).toBe(1);
    expect(getFrameCanvasAspect("stone_axeman", "stone-axeman-w-attack")).toBeCloseTo(512 / 384);
  });

  it("registers the bronze spearman without a token fallback", () => {
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0)).toBe("bronze-spearman-w-idle");
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === "bronze-spearman-ne-attack")).toBe(true);
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === "bronze-spearman-se-attack-enemy")).toBe(true);
  });

  it("records per-frame visible heights for scale normalization", () => {
    expect(getFrameVisibleHeightRatio("bronze_spearman", "bronze-spearman-ne-attack")).toBeCloseTo(270 / 384);
    expect(getFrameVisibleHeightRatio("stone_axeman", "stone-axeman-attack")).toBeCloseTo(270 / 384);
  });

  it.each([
    ["stone_slinger", "stone-slinger"],
    ["stone_axeman", "stone-axeman"],
    ["supply_wagon", "supply-wagon"],
    ["bronze_swordsman", "bronze-swordsman"],
    ["archer", "archer"],
    ["iron_swordsman", "iron-swordsman"],
    ["iron_spearman", "iron-spearman"],
    ["musketeer", "musketeer"],
    ["knight", "knight"],
  ] as const)("registers full eight-direction production frames for %s", (unitId, prefix) => {
    expect(resolveUnitAnimationTexture(unitId, false, 0, 0, "w")).toBe(`${prefix}-w-idle`);
    expect(resolveUnitAnimationTexture(unitId, false, 0, 0, "n")).toBe(`${prefix}-n-idle`);
    expect(resolveUnitAnimationTexture(unitId, true, 1, 0, "se")).toBe(`${prefix}-se-walk-a`);
    expect(resolveUnitAnimationTexture(unitId, true, -1, 0, "nw")).toBe(`${prefix}-nw-walk-b`);
    expect(resolveUnitAnimationTexture(unitId, false, 0, 0.25, "sw")).toBe(`${prefix}-sw-attack`);
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === `${prefix}-ne-idle-enemy`)).toBe(true);
  });

  it("selects team palette variants without whole-sprite tinting", () => {
    expect(resolveTeamUnitTextureKey("stone-axeman-idle", "player")).toBe("stone-axeman-idle");
    expect(resolveTeamUnitTextureKey("stone-axeman-idle", "enemy")).toBe("stone-axeman-idle-enemy");
    expect(shouldFlipUnitFrame("stone_axeman", -1)).toBe(false);
    expect(shouldFlipUnitFrame("stone_axeman", 1)).toBe(false);
  });

  it("defines the complete production direction contract and quantizes screen motion", () => {
    expect(UNIT_FACING_DIRECTIONS).toEqual(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);
    expect(resolveUnitFacingDirection(0, -1)).toBe("n");
    expect(resolveUnitFacingDirection(1, -1)).toBe("ne");
    expect(resolveUnitFacingDirection(1, 0)).toBe("e");
    expect(resolveUnitFacingDirection(1, 1)).toBe("se");
    expect(resolveUnitFacingDirection(0, 1)).toBe("s");
    expect(resolveUnitFacingDirection(-1, 1)).toBe("sw");
    expect(resolveUnitFacingDirection(-1, 0)).toBe("w");
    expect(resolveUnitFacingDirection(-1, -1)).toBe("nw");
    expect(resolveUnitFacingDirection(0, 0, "s")).toBe("s");
  });

  it("uses authored bronze-spearman directional frames instead of falling back to west art", () => {
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0, "w"))
      .toBe("bronze-spearman-w-idle");
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0, "n"))
      .toBe("bronze-spearman-n-idle");
    expect(resolveUnitAnimationTexture("bronze_spearman", true, 1, 0, "se"))
      .toBe("bronze-spearman-se-walk-a");
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0.25, "sw"))
      .toBe("bronze-spearman-sw-attack");
  });
});
