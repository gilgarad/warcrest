import { describe, expect, it } from "vitest";
import { resolveUnitFramePresentation } from "../unitPresentation";

describe("unit frame presentation", () => {
  it("keeps bronze spearman silhouette height stable across attack frames", () => {
    const targetHeight = 96;
    const windup = resolveUnitFramePresentation(
      "bronze_spearman",
      targetHeight,
      1,
      "bronze-spearman-attack-windup",
    );
    const contact = resolveUnitFramePresentation(
      "bronze_spearman",
      targetHeight,
      1,
      "bronze-spearman-attack-contact",
    );

    expect(windup.spriteHeight * (423 / 1024)).toBeCloseTo(targetHeight);
    expect(contact.spriteHeight * (625 / 1024)).toBeCloseTo(targetHeight);
    expect(windup.originY).toBe(contact.originY);
  });
});
