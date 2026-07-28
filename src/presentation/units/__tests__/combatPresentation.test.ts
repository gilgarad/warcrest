import { describe, expect, it } from "vitest";
import { resolveAttackMotion } from "../combatPresentation";

describe("resolveAttackMotion", () => {
  it("gives structure strikes a deeper wind-up and longer contact reach", () => {
    const windup = resolveAttackMotion({ role: "battle", melee: true, ranged: false, targetKind: "structure", progress: 0.3, facing: 1 });
    const contact = resolveAttackMotion({ role: "battle", melee: true, ranged: false, targetKind: "structure", progress: 0.56, facing: 1 });
    expect(windup.offsetX).toBeLessThan(0);
    expect(contact.offsetX).toBeGreaterThanOrEqual(14.9);
  });

  it("uses recoil instead of melee lunge for ranged attacks", () => {
    const motion = resolveAttackMotion({ role: "battle", melee: false, ranged: true, targetKind: "unit", progress: 0.62, facing: 1 });
    expect(motion.offsetX).toBeLessThan(-2);
    expect(Math.abs(motion.rotationRad)).toBeGreaterThan(0);
  });
});
