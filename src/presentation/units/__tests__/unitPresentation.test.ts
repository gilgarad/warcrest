import { describe, expect, it } from "vitest";
import { resolveUnitFramePresentation } from "../unitPresentation";

describe("unit frame presentation", () => {
  it("keeps bronze spearman body height stable across idle and attack", () => {
    const targetHeight = 96;
    const idle = resolveUnitFramePresentation(
      "bronze_spearman",
      targetHeight,
      1,
      "bronze-spearman-e-idle",
    );
    const attack = resolveUnitFramePresentation(
      "bronze_spearman",
      targetHeight,
      1,
      "bronze-spearman-e-attack",
    );

    expect(idle.spriteHeight * (250 / 384)).toBeCloseTo(targetHeight);
    expect(attack.spriteHeight * (312 / 384)).toBeCloseTo(targetHeight);
    expect(attack.spriteWidth / attack.spriteHeight).toBeCloseTo(512 / 384);
    expect(idle.originY).toBe(attack.originY);
  });

  it("keeps the pikeman body at infantry height while giving the pike extra canvas", () => {
    const targetHeight = 96;
    const walk = resolveUnitFramePresentation(
      "pikeman",
      targetHeight,
      1,
      "pikeman-e-walk-01",
    );
    const attack = resolveUnitFramePresentation(
      "pikeman",
      targetHeight,
      1,
      "pikeman-e-attack",
    );

    expect(walk.spriteHeight * (270 / 512)).toBeCloseTo(targetHeight);
    expect(walk.spriteWidth / walk.spriteHeight).toBeCloseTo(384 / 512);
    expect(attack.spriteHeight * (270 / 384)).toBeCloseTo(targetHeight);
    expect(attack.spriteWidth / attack.spriteHeight).toBeCloseTo(1024 / 384);
    expect(attack.originX).toBeCloseTo(253 / 1024);
  });

  it.each([
    ["bronze_swordsman", "bronze-swordsman-e-idle", 270, "bronze-swordsman-e-attack", 312, 1],
    ["bronze_spearman", "bronze-spearman-e-idle", 250, "bronze-spearman-e-attack", 312, 1],
    ["iron_swordsman", "iron-swordsman-e-idle", 270, "iron-swordsman-e-attack", 312, 1.04],
    ["iron_spearman", "iron-spearman-e-idle", 231, "iron-spearman-e-attack", 191, 1],
    ["rifleman_late", "rifleman-late-e-idle", 270, "rifleman-late-e-attack", 251, 1],
  ] as const)("keeps %s body height stable between idle and attack", (
    unitId,
    idleKey,
    idlePixels,
    attackKey,
    attackPixels,
    scaleFactor,
  ) => {
    const targetHeight = 96;
    const idle = resolveUnitFramePresentation(unitId, targetHeight, 1, idleKey);
    const attack = resolveUnitFramePresentation(unitId, targetHeight, 1, attackKey);

    expect(idle.spriteHeight * (idlePixels / 384)).toBeCloseTo(targetHeight * scaleFactor);
    expect(attack.spriteHeight * (attackPixels / 384)).toBeCloseTo(targetHeight * scaleFactor);
  });

  it("normalizes Rifleman I walk height without shrinking its attack", () => {
    const targetHeight = 96;
    const walk = resolveUnitFramePresentation("rifleman", targetHeight, 1, "rifleman-e-walk-01");
    const attack = resolveUnitFramePresentation("rifleman", targetHeight, 1, "rifleman-e-attack");

    expect(walk.spriteHeight * (312 / 384)).toBeCloseTo(targetHeight * 0.98);
    expect(attack.spriteHeight * (270 / 384)).toBeCloseTo(targetHeight * 0.98);
  });
});
