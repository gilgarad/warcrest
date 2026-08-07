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

const THREE_FRAME_BIPEDS = [
  ["stone_slinger", "stone-slinger"], ["stone_axeman", "stone-axeman"],
  ["bronze_swordsman", "bronze-swordsman"], ["bronze_spearman", "bronze-spearman"],
  ["archer", "archer"], ["iron_swordsman", "iron-swordsman"],
  ["iron_spearman", "iron-spearman"], ["musketeer", "musketeer"],
  ["pikeman", "pikeman"], ["grenadier", "grenadier"],
  ["rifleman_late", "rifleman-late"], ["grenadier_late", "grenadier-late"],
  ["infantry", "infantry"], ["machine_gunner", "machine-gunner"],
  ["shock_trooper", "shock-trooper"], ["automatic_rifleman", "automatic-rifleman"],
  ["support_gunner", "support-gunner"], ["mobile_infantry", "mobile-infantry"],
  ["special_forces", "special-forces"], ["heavy_gunner", "heavy-gunner"],
  ["breakthrough_trooper", "breakthrough-trooper"],
] as const;

const THREE_FRAME_CAVALRY = [
  ["knight", "knight"],
  ["heavy_cavalry", "heavy-cavalry"],
  ["light_cavalry", "light-cavalry"],
  ["cavalry", "cavalry"],
] as const;

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
      const authoredDirections = getAuthoredUnitDirections(unitId);
      expect(definition?.fallbackDirection).toBe(authoredDirections[0]);
      expect(definition?.directions[authoredDirections[0]]?.attack.length).toBeGreaterThan(0);
      if (unitId === "supply_wagon") {
        expect(definition?.legacyHorizontalMirror).toBe(false);
        expect(definition?.directionMode).toBe("direct");
        expect(getAuthoredUnitDirections(unitId)).toEqual(UNIT_FACING_DIRECTIONS);
        expect(hasCompleteUnitDirectionalSet(unitId)).toBe(true);
      }
    },
  );

  it("uses the approved wide production attack frame throughout the attack window", () => {
    expect(resolveUnitAnimationTexture("stone_axeman", false, 0, 0.1)).toBe("stone-axeman-e-attack");
    expect(resolveUnitAnimationTexture("stone_axeman", false, 0, 0.9)).toBe("stone-axeman-e-attack");
    expect(getFrameCanvasAspect("stone_axeman", "stone-axeman-e-idle")).toBe(1);
    expect(getFrameCanvasAspect("stone_axeman", "stone-axeman-e-attack")).toBeCloseTo(512 / 384);
  });

  it("registers the bronze spearman without a token fallback", () => {
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0)).toBe("bronze-spearman-e-idle");
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === "bronze-spearman-e-attack")).toBe(true);
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === "bronze-spearman-e-attack-enemy")).toBe(true);
  });

  it("records per-frame visible heights for scale normalization", () => {
    expect(getFrameVisibleHeightRatio("bronze_spearman", "bronze-spearman-ne-attack")).toBeCloseTo(270 / 384);
    expect(getFrameVisibleHeightRatio("stone_axeman", "stone-axeman-attack")).toBeCloseTo(270 / 384);
  });

  it.each(THREE_FRAME_BIPEDS)("uses the shared east-authored 3-frame contract for %s", (unitId, prefix) => {
    expect(getAuthoredUnitDirections(unitId)).toEqual(["e"]);
    expect(resolveUnitAnimationTexture(unitId, false, 0, 0, "w")).toBe(`${prefix}-e-idle`);
    expect(resolveUnitAnimationTexture(unitId, false, 0, 0, "n")).toBe(`${prefix}-e-idle`);
    expect(resolveUnitAnimationTexture(unitId, true, 0.1, 0, "se")).toBe(`${prefix}-e-walk-01`);
    expect(resolveUnitAnimationTexture(unitId, true, 0.45, 0, "nw")).toBe(`${prefix}-e-walk-02`);
    expect(resolveUnitAnimationTexture(unitId, true, 0.65, 0, "e")).toBe(`${prefix}-e-walk-03`);
    expect(resolveUnitAnimationTexture(unitId, true, 0.9, 0, "e")).toBe(`${prefix}-e-walk-02`);
    expect(resolveUnitAnimationTexture(unitId, false, 0, 0.25, "sw")).toBe(`${prefix}-e-attack`);
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === `${prefix}-e-walk-03-enemy`)).toBe(true);
  });

  it.each(THREE_FRAME_CAVALRY)("uses the quadruped 3-frame contract for %s", (unitId, prefix) => {
    const definition = getUnitAnimationDefinition(unitId);
    expect(definition?.scaleFactor).toBe(1.14);
    expect(definition?.directionMode).toBe("legacy-mirrored");
    expect(getAuthoredUnitDirections(unitId)).toEqual(["e"]);
    expect(hasCompleteUnitDirectionalSet(unitId)).toBe(false);
    expect(resolveUnitAnimationTexture(unitId, true, 0.05, 0, "e")).toBe(`${prefix}-e-walk-01`);
    expect(resolveUnitAnimationTexture(unitId, true, 0.30, 0, "e")).toBe(`${prefix}-e-walk-02`);
    expect(resolveUnitAnimationTexture(unitId, true, 0.55, 0, "e")).toBe(`${prefix}-e-walk-03`);
    expect(resolveUnitAnimationTexture(unitId, true, 0.80, 0, "w")).toBe(`${prefix}-e-walk-02`);
    expect(resolveUnitAnimationTexture(unitId, false, 0, 0.25, "w")).toBe(`${prefix}-e-attack`);
    expect(shouldFlipUnitFrame(unitId, 1, "w")).toBe(true);
  });

  it("selects team palette variants without whole-sprite tinting", () => {
    expect(resolveTeamUnitTextureKey("stone-axeman-idle", "player")).toBe("stone-axeman-idle");
    expect(resolveTeamUnitTextureKey("stone-axeman-idle", "enemy")).toBe("stone-axeman-idle-enemy");
    expect(resolveTeamUnitTextureKey("stone-axeman-walk-c", "enemy")).toBe("stone-axeman-walk-c");
    expect(shouldFlipUnitFrame("stone_axeman", -1, "w")).toBe(true);
    expect(shouldFlipUnitFrame("stone_axeman", 1, "e")).toBe(false);
    expect(shouldFlipUnitFrame("stone_axeman", 1, "ne")).toBe(false);
    expect(shouldFlipUnitFrame("stone_axeman", -1, "sw")).toBe(true);
  });

  it("keeps the eight-direction asset contract while resolving active facing horizontally", () => {
    expect(UNIT_FACING_DIRECTIONS).toEqual(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);
    expect(resolveUnitFacingDirection(0, -1)).toBe("w");
    expect(resolveUnitFacingDirection(0, -1, "e")).toBe("e");
    expect(resolveUnitFacingDirection(1, -1)).toBe("e");
    expect(resolveUnitFacingDirection(1, 0)).toBe("e");
    expect(resolveUnitFacingDirection(1, 1)).toBe("e");
    expect(resolveUnitFacingDirection(0, 1, "e")).toBe("e");
    expect(resolveUnitFacingDirection(-1, 1)).toBe("w");
    expect(resolveUnitFacingDirection(-1, 0)).toBe("w");
    expect(resolveUnitFacingDirection(-1, -1)).toBe("w");
    expect(resolveUnitFacingDirection(0, 0, "e")).toBe("e");
  });

  it("disconnects non-horizontal bronze-spearman frames from active presentation", () => {
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0, "w"))
      .toBe("bronze-spearman-e-idle");
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0, "n"))
      .toBe("bronze-spearman-e-idle");
    expect(resolveUnitAnimationTexture("bronze_spearman", true, 0.1, 0, "se"))
      .toBe("bronze-spearman-e-walk-01");
    expect(resolveUnitAnimationTexture("bronze_spearman", true, 0.8, 0, "se"))
      .toBe("bronze-spearman-e-walk-02");
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0.25, "sw"))
      .toBe("bronze-spearman-e-attack");
  });

  it("uses the v2 3-frame mirrored contract for rifleman", () => {
    const definition = getUnitAnimationDefinition("rifleman");
    expect(definition?.directionMode).toBe("legacy-mirrored");
    expect(getAuthoredUnitDirections("rifleman")).toEqual(["e"]);
    expect(hasCompleteUnitDirectionalSet("rifleman")).toBe(false);
    expect(resolveUnitAnimationTexture("rifleman", false, 0, 0, "e")).toBe("rifleman-e-idle");
    expect(resolveUnitAnimationTexture("rifleman", true, 0.05, 0, "e")).toBe("rifleman-e-walk-01");
    expect(resolveUnitAnimationTexture("rifleman", true, 0.30, 0, "e")).toBe("rifleman-e-walk-02");
    expect(resolveUnitAnimationTexture("rifleman", true, 0.55, 0, "e")).toBe("rifleman-e-walk-03");
    expect(resolveUnitAnimationTexture("rifleman", true, 0.80, 0, "e")).toBe("rifleman-e-walk-02");
    expect(resolveUnitAnimationTexture("rifleman", true, 0.95, 0, "e")).toBe("rifleman-e-walk-02");
    expect(resolveUnitAnimationTexture("rifleman", false, 0, 0.25, "e")).toBe("rifleman-e-attack");
    expect(resolveUnitAnimationTexture("rifleman", false, 0, 0, "w")).toBe("rifleman-e-idle");
    expect(resolveUnitAnimationTexture("rifleman", true, 0.55, 0, "nw")).toBe("rifleman-e-walk-03");
    expect(resolveUnitAnimationTexture("rifleman", true, 0.55, 0, "sw")).toBe("rifleman-e-walk-03");
    expect(shouldFlipUnitFrame("rifleman", 1, "w")).toBe(true);
    expect(shouldFlipUnitFrame("rifleman", 1, "nw")).toBe(true);
    expect(shouldFlipUnitFrame("rifleman", 1, "sw")).toBe(true);
    expect(shouldFlipUnitFrame("rifleman", 1, "e")).toBe(false);
  });

  it("limits rifleman_late to the global 3-frame mirrored contract", () => {
    const definition = getUnitAnimationDefinition("rifleman_late");
    expect(definition?.directionMode).toBe("legacy-mirrored");
    expect(getAuthoredUnitDirections("rifleman_late")).toEqual(["e"]);
    expect(hasCompleteUnitDirectionalSet("rifleman_late")).toBe(false);
    expect(resolveUnitAnimationTexture("rifleman_late", false, 0, 0, "e")).toBe("rifleman-late-e-idle");
    expect(resolveUnitAnimationTexture("rifleman_late", true, 0.05, 0, "e")).toBe("rifleman-late-e-walk-01");
    expect(resolveUnitAnimationTexture("rifleman_late", true, 0.55, 0, "e")).toBe("rifleman-late-e-walk-03");
    expect(resolveUnitAnimationTexture("rifleman_late", true, 0.95, 0, "e")).toBe("rifleman-late-e-walk-02");
    expect(resolveUnitAnimationTexture("rifleman_late", false, 0, 0.25, "e")).toBe("rifleman-late-e-attack");
    expect(resolveUnitAnimationTexture("rifleman_late", false, 0, 0, "w")).toBe("rifleman-late-e-idle");
    expect(resolveUnitAnimationTexture("rifleman_late", true, 0.55, 0, "nw")).toBe("rifleman-late-e-walk-03");
    expect(resolveUnitAnimationTexture("rifleman_late", true, 0.55, 0, "sw")).toBe("rifleman-late-e-walk-03");
    expect(shouldFlipUnitFrame("rifleman_late", 1, "w")).toBe(true);
    expect(shouldFlipUnitFrame("rifleman_late", 1, "nw")).toBe(true);
    expect(shouldFlipUnitFrame("rifleman_late", 1, "sw")).toBe(true);
    expect(shouldFlipUnitFrame("rifleman_late", 1, "e")).toBe(false);
  });
});
