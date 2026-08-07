import { describe, expect, it } from "vitest";
import { resolveUnitFramePresentation } from "../unitPresentation";

describe("unit frame presentation", () => {
  it("keeps bronze spearman silhouette height stable across directional frames", () => {
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

    expect(idle.spriteHeight * (270 / 384)).toBeCloseTo(targetHeight);
    expect(attack.spriteHeight * (270 / 384)).toBeCloseTo(targetHeight);
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
  });
});
