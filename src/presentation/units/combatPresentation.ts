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
      offsetX: castPulse * 1.8 * input.facing,
      lift: castPulse * 3.2,
      rotationRad: input.facing * castPulse * 0.012,
    };
  }

  if (input.ranged) {
    const releaseProgress = 0.42;
    const recoil = progress < releaseProgress
      ? -smoothStep(progress / releaseProgress) * 5
      : -5 + smoothStep((progress - releaseProgress) / (1 - releaseProgress)) * 5;
    const releaseSnap = Math.exp(-Math.pow((progress - releaseProgress) / 0.1, 2));
    return {
      offsetX: (recoil + releaseSnap * 2.4) * input.facing,
      lift: Math.sin(progress * Math.PI) * 1.2,
      rotationRad: -input.facing * (0.025 * Math.sin(progress * Math.PI) + releaseSnap * 0.028),
    };
  }

  if (input.melee) {
    const reach = input.targetKind === "structure" ? 22 : 17;
    const windBack = input.targetKind === "structure" ? 7 : 5;
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
      lift: Math.sin(progress * Math.PI) * (input.targetKind === "structure" ? 3.2 : 2.2),
      rotationRad: input.facing * Math.sin(progress * Math.PI)
        * (input.targetKind === "structure" ? 0.065 : 0.045),
    };
  }

  return { offsetX: 0, lift: 0, rotationRad: 0 };
}
