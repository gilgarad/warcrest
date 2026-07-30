export type AttackTargetKind = "unit" | "structure";

export interface AttackMotionInput {
  role: "battle" | "support";
  melee: boolean;
  ranged: boolean;
  targetKind: AttackTargetKind;
  progress: number;
  facing: -1 | 1;
}

export interface AttackMotion {
  offsetX: number;
  lift: number;
  rotationRad: number;
}

function smoothStep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function resolveAttackMotion(input: AttackMotionInput): AttackMotion {
  const progress = Math.max(0, Math.min(1, input.progress));
  if (progress <= 0) return { offsetX: 0, lift: 0, rotationRad: 0 };

  if (input.role === "support") {
    const castPulse = Math.sin(progress * Math.PI);
    return {
      offsetX: castPulse * 1.1 * input.facing,
      lift: castPulse * 2.1,
      rotationRad: input.facing * castPulse * 0.007,
    };
  }

  if (input.ranged) {
    const releaseProgress = 0.42;
    const recoil = progress < releaseProgress
      ? -smoothStep(progress / releaseProgress) * 3.8
      : -3.8 + smoothStep((progress - releaseProgress) / (1 - releaseProgress)) * 3.8;
    const releaseSnap = Math.exp(-Math.pow((progress - releaseProgress) / 0.11, 2));
    return {
      offsetX: (recoil + releaseSnap * 1.5) * input.facing,
      lift: Math.sin(progress * Math.PI) * 0.85,
      rotationRad: -input.facing * (0.016 * Math.sin(progress * Math.PI) + releaseSnap * 0.018),
    };
  }

  if (input.melee) {
    const reach = input.targetKind === "structure" ? 17 : 13;
    const windBack = input.targetKind === "structure" ? 5 : 3.5;
    let offset: number;
    if (progress < 0.26) {
      offset = -smoothStep(progress / 0.26) * windBack;
    } else if (progress < 0.48) {
      offset = -windBack + smoothStep((progress - 0.26) / 0.22) * (reach + windBack);
    } else {
      offset = reach * (1 - smoothStep((progress - 0.48) / 0.52));
    }
    return {
      offsetX: offset * input.facing,
      lift: Math.sin(progress * Math.PI) * (input.targetKind === "structure" ? 2.4 : 1.6),
      rotationRad: input.facing * Math.sin(progress * Math.PI)
        * (input.targetKind === "structure" ? 0.04 : 0.028),
    };
  }

  return { offsetX: 0, lift: 0, rotationRad: 0 };
}
