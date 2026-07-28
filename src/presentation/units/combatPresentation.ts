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
    const reach = Math.sin(progress * Math.PI);
    return { offsetX: reach * 3 * input.facing, lift: reach * 1.2, rotationRad: 0 };
  }

  if (input.ranged) {
    const recoil = progress < 0.34
      ? smoothStep(progress / 0.34) * -2
      : -2 - Math.sin(((progress - 0.34) / 0.66) * Math.PI) * 5;
    return {
      offsetX: recoil * input.facing,
      lift: Math.sin(progress * Math.PI) * 0.8,
      rotationRad: -input.facing * Math.sin(progress * Math.PI) * 0.018,
    };
  }

  if (input.melee) {
    const reach = input.targetKind === "structure" ? 15 : 11;
    const windBack = input.targetKind === "structure" ? 4 : 2.5;
    let offset: number;
    if (progress < 0.3) {
      offset = -smoothStep(progress / 0.3) * windBack;
    } else if (progress < 0.56) {
      offset = -windBack + smoothStep((progress - 0.3) / 0.26) * (reach + windBack);
    } else {
      offset = reach * (1 - smoothStep((progress - 0.56) / 0.44));
    }
    return {
      offsetX: offset * input.facing,
      lift: Math.sin(progress * Math.PI) * (input.targetKind === "structure" ? 2.2 : 1.4),
      rotationRad: input.targetKind === "structure"
        ? input.facing * Math.sin(progress * Math.PI) * 0.025
        : 0,
    };
  }

  return { offsetX: 0, lift: 0, rotationRad: 0 };
}
