import { describe, expect, it } from "vitest";
import { resolveUnitFramePresentation } from "../unitPresentation";

describe("unit frame presentation", () => {
  it("keeps bronze spearman silhouette height stable across standard and wide frames", () => {
    const targetHeight = 96;
    const idle = resolveUnitFramePresentation(
      "bronze_spearman",
      targetHeight,
      1,
      "bronze-spearman-idle",
    );
    const attack = resolveUnitFramePresentation(
      "bronze_spearman",
      targetHeight,
      1,
      "bronze-spearman-attack",
    );

    expect(idle.spriteHeight * (270 / 384)).toBeCloseTo(targetHeight);
    expect(attack.spriteHeight * (270 / 384)).toBeCloseTo(targetHeight);
    expect(attack.spriteWidth / attack.spriteHeight).toBeCloseTo(512 / 384);
    expect(idle.originY).toBe(attack.originY);
  });
});
