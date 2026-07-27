import { describe, expect, it } from "vitest";
import {
  UNIT_ANIMATION_ASSETS,
  getUnitAnimationDefinition,
  resolveUnitAnimationTexture,
} from "../unitAnimationRegistry";

describe("unit animation registry", () => {
  it.each(["stone_axeman", "stone_slinger", "supply_wagon", "bronze_spearman"] as const)(
    "%s uses the shared normalized animation contract",
    (unitId) => {
      const definition = getUnitAnimationDefinition(unitId);
      expect(definition).toBeDefined();
      expect(definition?.canvasAspect).toBe(1.125);
      expect(definition?.groundOriginX).toBeCloseTo(450 / 1152);
      expect(definition?.groundOriginY).toBeCloseTo(900 / 1024);
      expect(definition?.attack.length).toBeGreaterThan(0);
    },
  );

  it("resolves the axeman wind-up, contact, and recover frames", () => {
    expect(resolveUnitAnimationTexture("stone_axeman", false, 0, 0.1)).toBe("stone-axeman-attack-windup");
    expect(resolveUnitAnimationTexture("stone_axeman", false, 0, 0.5)).toBe("stone-axeman-attack-contact");
    expect(resolveUnitAnimationTexture("stone_axeman", false, 0, 0.9)).toBe("stone-axeman-attack-recover");
  });

  it("registers the bronze spearman without a token fallback", () => {
    expect(resolveUnitAnimationTexture("bronze_spearman", false, 0, 0)).toBe("bronze-spearman-idle");
    expect(UNIT_ANIMATION_ASSETS.some((asset) => asset.key === "bronze-spearman-attack-contact")).toBe(true);
  });
});
