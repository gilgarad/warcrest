export type UnitRangeProfile = "melee" | "ranged" | "support";

export const RANGE_TO_PROGRESS = 0.013;

export const BASE_ATTACK_RANGE_UNITS: Record<UnitRangeProfile, number> = {
  melee: 1.5,
  ranged: 4.5,
  support: 4.4,
};

export function resolveAttackRangeUnits(
  profile: UnitRangeProfile,
  multiplier: number,
): number {
  return BASE_ATTACK_RANGE_UNITS[profile] * multiplier;
}

export function resolveAttackRangeProgress(
  profile: UnitRangeProfile,
  multiplier: number,
): number {
  return resolveAttackRangeUnits(profile, multiplier) * RANGE_TO_PROGRESS;
}
