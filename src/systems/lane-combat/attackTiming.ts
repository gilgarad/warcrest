import type { AttackTargetKind } from "../../presentation/units/combatPresentation";

export type AttackTimingRole = "melee" | "ranged" | "support";

export interface AttackTimingProfile {
  durationSec: number;
  eventProgress: number;
  eventDelayMs: number;
  targetKind: AttackTargetKind;
}

const ROLE_TIMING: Record<AttackTimingRole, Omit<AttackTimingProfile, "eventDelayMs" | "targetKind">> = {
  melee: { durationSec: 0.38, eventProgress: 0.44 },
  ranged: { durationSec: 0.46, eventProgress: 0.36 },
  support: { durationSec: 0.56, eventProgress: 0.52 },
};

export function getAttackTimingProfile(
  role: AttackTimingRole,
  targetKind: AttackTargetKind,
): AttackTimingProfile {
  const timing = ROLE_TIMING[role];
  return {
    ...timing,
    targetKind,
    eventDelayMs: timing.durationSec * timing.eventProgress * 1000,
  };
}
