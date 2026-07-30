import { describe, expect, it } from "vitest";
import { resolveAttackMotion } from "../combatPresentation";

describe("resolveAttackMotion", () => {
  it("gives structure strikes a deeper wind-up and longer contact reach", () => {
    const windup = resolveAttackMotion({ role: "battle", melee: true, ranged: false, targetKind: "structure", progress: 0.24, facing: 1 });
    const contact = resolveAttackMotion({ role: "battle", melee: true, ranged: false, targetKind: "structure", progress: 0.48, facing: 1 });
    expect(windup.offsetX).toBeLessThan(0);
    expect(contact.offsetX).toBeGreaterThanOrEqual(16.9);
    expect(Math.abs(contact.rotationRad)).toBeGreaterThan(0.03);
  });

  it("uses recoil instead of melee lunge for ranged attacks", () => {
    const motion = resolveAttackMotion({ role: "battle", melee: false, ranged: true, targetKind: "unit", progress: 0.62, facing: 1 });
    expect(motion.offsetX).toBeLessThan(-1.5);
    expect(Math.abs(motion.rotationRad)).toBeGreaterThan(0);
  });

  it("keeps support movement smaller than the melee contact silhouette", () => {
    const support = resolveAttackMotion({ role: "support", melee: false, ranged: false, targetKind: "unit", progress: 0.52, facing: 1 });
    const melee = resolveAttackMotion({ role: "battle", melee: true, ranged: false, targetKind: "unit", progress: 0.48, facing: 1 });
    expect(Math.abs(support.offsetX)).toBeLessThan(Math.abs(melee.offsetX));
    expect(support.lift).toBeGreaterThan(1.5);
  });
});
