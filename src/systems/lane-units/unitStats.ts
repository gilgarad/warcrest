import { getAge, type AgeId } from "../../data/ages";
import { getSupportHealPower, type BattleUnitId, type SupportUnitId } from "../../data/unitRosters";
import {
  resolveAttackRangeUnits,
  type UnitRangeProfile,
} from "./rangeRules";

export type LaneUnitId = BattleUnitId | SupportUnitId;

export interface UnitStatDef {
  hp: number;
  attack: number;
  defense: number;
  range: number;
  rangeProfile: UnitRangeProfile;
  rangeMultiplier: number;
  speed: number;
  attackSpeed: number;
  attackCooldownSec: number;
  healPower?: number;
  label: string;
  textureKey: string;
  tint: number;
}

// Unit move speed is a multiplier, not an absolute world-progress value.
// Actual forward progress remains `UNIT_PROGRESS_SPEED * speed`.
export const NORMALIZED_MOVE_SPEED = 1;
export const NORMALIZED_RANGED_RANGE_MULTIPLIER = 1;
export const NORMALIZED_ATTACK_SPEED = 1;

function meleeRange(multiplier: number): Pick<UnitStatDef, "range" | "rangeProfile" | "rangeMultiplier"> {
  return {
    range: resolveAttackRangeUnits("melee", multiplier),
    rangeProfile: "melee",
    rangeMultiplier: multiplier,
  };
}

function rangedRange(multiplier = NORMALIZED_RANGED_RANGE_MULTIPLIER): Pick<UnitStatDef, "range" | "rangeProfile" | "rangeMultiplier"> {
  return {
    range: resolveAttackRangeUnits("ranged", multiplier),
    rangeProfile: "ranged",
    rangeMultiplier: multiplier,
  };
}

function rangedRangeUnits(units: number): Pick<UnitStatDef, "range" | "rangeProfile" | "rangeMultiplier"> {
  return rangedRange(units / 4.5);
}

function supportRange(multiplier = 1): Pick<UnitStatDef, "range" | "rangeProfile" | "rangeMultiplier"> {
  return {
    range: resolveAttackRangeUnits("support", multiplier),
    rangeProfile: "support",
    rangeMultiplier: multiplier,
  };
}

export const UNIT_STATS: Record<LaneUnitId, UnitStatDef> = {
  stone_slinger: { hp: 30, attack: 5, defense: 2, ...rangedRangeUnits(3), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.3, label: "투석", textureKey: "stone-slinger-w-idle", tint: 0xd4b27c },
  stone_axeman: { hp: 50, attack: 9, defense: 3, ...meleeRange(1), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.0, label: "도끼", textureKey: "stone-axeman-w-idle", tint: 0xa7b1be },
  bronze_swordsman: { hp: 60, attack: 12, defense: 5, ...meleeRange(1), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 0.95, label: "청동검", textureKey: "bronze-swordsman-w-idle", tint: 0xe1af64 },
  bronze_spearman: { hp: 60, attack: 11, defense: 5, ...meleeRange(1.47), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.05, label: "청동창", textureKey: "bronze-spearman-w-idle", tint: 0xd1c28f },
  archer: { hp: 45, attack: 7, defense: 3, ...rangedRangeUnits(4.5), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 2.0, label: "활", textureKey: "archer-w-idle", tint: 0x90c6ff },
  iron_swordsman: { hp: 70, attack: 16, defense: 8, ...meleeRange(1.07), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 0.9, label: "철검", textureKey: "iron-swordsman-w-idle", tint: 0xdfe7f4 },
  iron_spearman: { hp: 70, attack: 15, defense: 7, ...meleeRange(1.6), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.0, label: "철창", textureKey: "iron-spearman-w-idle", tint: 0xa7c8dd },
  musketeer: { hp: 50, attack: 12, defense: 4, ...rangedRangeUnits(4), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 2.1, label: "총병", textureKey: "musketeer-w-idle", tint: 0xc09aff },
  knight: { hp: 100, attack: 22, defense: 10, ...meleeRange(1.2), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.45, label: "기사", textureKey: "knight-w-idle", tint: 0xffe1a1 },
  pikeman: { hp: 70, attack: 20, defense: 9, ...meleeRange(1.73), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.0, label: "장창병", textureKey: "pikeman-w-idle", tint: 0xbfd7e6 },
  heavy_cavalry: { hp: 120, attack: 24, defense: 12, ...meleeRange(1.27), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.35, label: "중기병", textureKey: "heavy-cavalry-w-idle", tint: 0xf2d4a1 },
  rifleman: { hp: 60, attack: 18, defense: 6, ...rangedRangeUnits(5.5), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.8, label: "소총병 I", textureKey: "rifleman-w-idle", tint: 0xc8c0ff },
  grenadier: { hp: 60, attack: 22, defense: 6, ...rangedRangeUnits(3), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 2.0, label: "척탄병 I", textureKey: "grenadier-w-idle", tint: 0xffc98e },
  light_cavalry: { hp: 90, attack: 23, defense: 10, ...meleeRange(1.2), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.25, label: "경기병", textureKey: "light-cavalry-w-idle", tint: 0xffe0ac },
  cannon_i: { hp: 50, attack: 30, defense: 8, ...rangedRangeUnits(7), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 2.6, label: "대포 I", textureKey: "cannon-i-w-idle", tint: 0xb9c7d8 },
  rifleman_late: { hp: 70, attack: 22, defense: 6, ...rangedRangeUnits(6), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.65, label: "소총병 II", textureKey: "rifleman-late-w-idle", tint: 0xd8d0ff },
  grenadier_late: { hp: 70, attack: 25, defense: 6, ...rangedRangeUnits(4), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.85, label: "척탄병 II", textureKey: "grenadier-late-w-idle", tint: 0xffcf99 },
  cavalry: { hp: 120, attack: 28, defense: 12, ...meleeRange(1.27), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.2, label: "기병대", textureKey: "cavalry-w-idle", tint: 0xffdfb5 },
  cannon_ii: { hp: 70, attack: 36, defense: 8, ...rangedRangeUnits(8), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 2.35, label: "대포 II", textureKey: "cannon-ii-w-idle", tint: 0xc9d2e0 },
  infantry: { hp: 70, attack: 30, defense: 10, ...rangedRangeUnits(6), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.45, label: "보병", textureKey: "infantry-w-idle", tint: 0xe2d8ff },
  machine_gunner: { hp: 70, attack: 32, defense: 26, ...rangedRangeUnits(5.5), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 0.8, label: "기관총병", textureKey: "machine-gunner-w-idle", tint: 0xced7ff },
  shock_trooper: { hp: 70, attack: 36, defense: 13, ...meleeRange(1.13), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 0.8, label: "돌격병", textureKey: "shock-trooper-w-idle", tint: 0xf1d9d9 },
  artillery_i: { hp: 80, attack: 42, defense: 20, ...rangedRangeUnits(10), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 2.45, label: "포병 I", textureKey: "artillery-i-w-idle", tint: 0xc4d3de },
  automatic_rifleman: { hp: 70, attack: 34, defense: 20, ...rangedRangeUnits(6.5), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.0, label: "자동소총병", textureKey: "automatic-rifleman-w-idle", tint: 0xd6e1ff },
  support_gunner: { hp: 70, attack: 30, defense: 24, ...rangedRangeUnits(4), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.15, label: "지원화기병", textureKey: "support-gunner-w-idle", tint: 0xc4dbff },
  mobile_infantry: { hp: 70, attack: 38, defense: 30, ...rangedRangeUnits(5), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 0.95, label: "기동병", textureKey: "mobile-infantry-w-idle", tint: 0xebe1d3 },
  artillery_ii: { hp: 90, attack: 50, defense: 26, ...rangedRangeUnits(12), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 2.15, label: "포병 II", textureKey: "artillery-ii-w-idle", tint: 0xd2dde5 },
  tank: { hp: 150, attack: 45, defense: 50, ...rangedRangeUnits(9), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.9, label: "전차", textureKey: "tank-w-idle", tint: 0xa0c394 },
  special_forces: { hp: 80, attack: 38, defense: 22, ...rangedRangeUnits(7), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 0.9, label: "특수보병", textureKey: "special-forces-w-idle", tint: 0xe4ecff },
  heavy_gunner: { hp: 80, attack: 36, defense: 20, ...rangedRangeUnits(4), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.0, label: "중화기병", textureKey: "heavy-gunner-w-idle", tint: 0xcad6ff },
  breakthrough_trooper: { hp: 110, attack: 52, defense: 22, ...meleeRange(1.27), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 0.75, label: "돌파병", textureKey: "breakthrough-trooper-w-idle", tint: 0xf0d4c1 },
  mobile_artillery: { hp: 120, attack: 64, defense: 18, ...rangedRangeUnits(12), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.85, label: "자주포", textureKey: "mobile-artillery-w-idle", tint: 0xcddbe2 },
  modern_tank: { hp: 200, attack: 60, defense: 60, ...rangedRangeUnits(10), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.6, label: "현대 전차", textureKey: "modern-tank-w-idle", tint: 0x9ac089 },
  supply_wagon: { hp: 28, attack: 0, defense: 1, ...supportRange(1), speed: NORMALIZED_MOVE_SPEED, attackSpeed: NORMALIZED_ATTACK_SPEED, attackCooldownSec: 1.2, healPower: getSupportHealPower("stone"), label: "보급", textureKey: "supply-wagon-ancient-e-idle", tint: 0x89da93 },
};

export interface SupportWagonAgeStats {
  hp: number;
  attack: number;
  defense: number;
  range: number;
  textureKey: string;
  tint: number;
}

export function getSupportWagonAgeStats(ageId: AgeId): SupportWagonAgeStats {
  const group = getAge(ageId).productionGroup;
  if (group === "ancient" || group === "classical") {
    return { hp: 28, attack: 0, defense: 1, range: 3, textureKey: "supply-wagon-ancient-e-idle", tint: 0x89da93 };
  }
  if (group === "iron") {
    return { hp: 40, attack: 0, defense: 3, range: 3.5, textureKey: "supply-wagon-iron-e-idle", tint: 0x93c9a3 };
  }
  if (group === "renaissance") {
    return { hp: 60, attack: 0, defense: 8, range: 4, textureKey: "supply-wagon-renaissance-e-idle", tint: 0xa3c3d6 };
  }
  if (group === "industrial") {
    return { hp: 80, attack: 0, defense: 14, range: 4.5, textureKey: "supply-wagon-industrial-e-idle", tint: 0xb0b7d8 };
  }
  if (ageId === "modern_early") {
    return { hp: 120, attack: 0, defense: 30, range: 5, textureKey: "supply-wagon-modern-early-e-idle", tint: 0xb2d0ea };
  }
  return { hp: 140, attack: 0, defense: 40, range: 5.5, textureKey: "supply-wagon-modern-late-e-idle", tint: 0xc6def2 };
}

export function getProjectileKeyForUnit(unitId: LaneUnitId): string {
  if ([
    "stone_slinger",
    "grenadier",
    "grenadier_late",
    "cannon_i",
    "cannon_ii",
    "artillery_i",
    "artillery_ii",
    "mobile_artillery",
    "tank",
    "modern_tank",
  ].includes(unitId)) return "projectile-stone";
  if (unitId === "archer") return "projectile-arrow";
  if ([
    "musketeer",
    "rifleman",
    "rifleman_late",
    "infantry",
    "machine_gunner",
    "automatic_rifleman",
    "support_gunner",
    "special_forces",
    "heavy_gunner",
  ].includes(unitId)) return "projectile-shot";
  return "projectile-stone";
}
