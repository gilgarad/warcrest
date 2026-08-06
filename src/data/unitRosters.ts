import type { AgeId } from "./ages";

export type BattleUnitId =
  | "stone_slinger"
  | "stone_axeman"
  | "bronze_swordsman"
  | "bronze_spearman"
  | "archer"
  | "iron_swordsman"
  | "iron_spearman"
  | "musketeer"
  | "knight"
  | "pikeman"
  | "heavy_cavalry"
  | "rifleman"
  | "grenadier"
  | "light_cavalry"
  | "cannon_i"
  | "rifleman_late"
  | "grenadier_late"
  | "cavalry"
  | "cannon_ii"
  | "infantry"
  | "machine_gunner"
  | "shock_trooper"
  | "artillery_i"
  | "automatic_rifleman"
  | "support_gunner"
  | "mobile_infantry"
  | "artillery_ii"
  | "tank"
  | "special_forces"
  | "heavy_gunner"
  | "breakthrough_trooper"
  | "mobile_artillery"
  | "modern_tank";

export type SupportUnitId = "supply_wagon";

export interface RosterEntry<UnitId extends string> {
  unitId: UnitId;
  count: number;
}

export interface AgeWaveRoster {
  ageId: AgeId;
  battleline: Array<RosterEntry<BattleUnitId>>;
  support: Array<RosterEntry<SupportUnitId>>;
}

export const LEGACY_SUPPORT_HEAL_POWER = 10;
export const LEGACY_SUPPORT_BATTLELINE_COUNT = 5;
export const SUPPORT_HEAL_REDUCTION_RATIO = 2 / 3;
export const SUPPORT_MANA_PER_BATTLELINE_UNIT = 6;
export const SUPPORT_HEAL_MANA_COST = 6;
export const SUPPORT_MANA_REGEN_PER_SEC = 1.25;

export interface SupportResourceProfile {
  healPower: number;
  manaMax: number;
  healManaCost: number;
  manaRegenPerSec: number;
}

export const AGE_WAVE_ROSTERS: AgeWaveRoster[] = [
  {
    ageId: "stone",
    battleline: [
      { unitId: "stone_slinger", count: 1 },
      { unitId: "stone_axeman", count: 2 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "bronze",
    battleline: [
      { unitId: "stone_slinger", count: 1 },
      { unitId: "bronze_swordsman", count: 1 },
      { unitId: "bronze_spearman", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "iron_early",
    battleline: [
      { unitId: "archer", count: 1 },
      { unitId: "bronze_spearman", count: 1 },
      { unitId: "iron_swordsman", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "iron_mid",
    battleline: [
      { unitId: "archer", count: 1 },
      { unitId: "iron_swordsman", count: 1 },
      { unitId: "iron_spearman", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "iron_late",
    battleline: [
      { unitId: "archer", count: 1 },
      { unitId: "knight", count: 1 },
      { unitId: "musketeer", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "renaissance",
    battleline: [
      { unitId: "musketeer", count: 1 },
      { unitId: "pikeman", count: 1 },
      { unitId: "heavy_cavalry", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "industrial_early",
    battleline: [
      { unitId: "rifleman", count: 1 },
      { unitId: "grenadier", count: 1 },
      { unitId: "light_cavalry", count: 1 },
      { unitId: "cannon_i", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "industrial_late",
    battleline: [
      { unitId: "rifleman_late", count: 1 },
      { unitId: "grenadier_late", count: 1 },
      { unitId: "cavalry", count: 1 },
      { unitId: "cannon_ii", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "modern_early",
    battleline: [
      { unitId: "infantry", count: 1 },
      { unitId: "machine_gunner", count: 1 },
      { unitId: "shock_trooper", count: 1 },
      { unitId: "artillery_i", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "modern_mid",
    battleline: [
      { unitId: "automatic_rifleman", count: 1 },
      { unitId: "support_gunner", count: 1 },
      { unitId: "mobile_infantry", count: 1 },
      { unitId: "artillery_ii", count: 1 },
      { unitId: "tank", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
  {
    ageId: "modern_late",
    battleline: [
      { unitId: "special_forces", count: 1 },
      { unitId: "heavy_gunner", count: 1 },
      { unitId: "breakthrough_trooper", count: 1 },
      { unitId: "mobile_artillery", count: 1 },
      { unitId: "modern_tank", count: 1 },
    ],
    support: [{ unitId: "supply_wagon", count: 1 }],
  },
];

export function getWaveRoster(ageId: AgeId): AgeWaveRoster {
  const found = AGE_WAVE_ROSTERS.find((roster) => roster.ageId === ageId);
  if (!found) throw new Error(`Unknown wave roster age: ${ageId}`);
  return found;
}

export function getBattlelineUnitCount(roster: AgeWaveRoster): number {
  return roster.battleline.reduce((total, entry) => total + entry.count, 0);
}

export function scaleSupportHealPower(
  battlelineUnitCount: number,
  baselineHealPower = LEGACY_SUPPORT_HEAL_POWER,
  baselineBattlelineCount = LEGACY_SUPPORT_BATTLELINE_COUNT,
): number {
  if (battlelineUnitCount <= 0 || baselineBattlelineCount <= 0) return 0;
  return Math.round((baselineHealPower * battlelineUnitCount / baselineBattlelineCount) * 100) / 100;
}

export function getSupportHealPower(ageId: AgeId): number {
  return getSupportResourceProfile(ageId).healPower;
}

export function getSupportResourceProfile(ageId: AgeId): SupportResourceProfile {
  const battlelineCount = getBattlelineUnitCount(getWaveRoster(ageId));
  return {
    healPower: Math.round(scaleSupportHealPower(battlelineCount) * SUPPORT_HEAL_REDUCTION_RATIO * 100) / 100,
    manaMax: battlelineCount * SUPPORT_MANA_PER_BATTLELINE_UNIT,
    healManaCost: SUPPORT_HEAL_MANA_COST,
    manaRegenPerSec: SUPPORT_MANA_REGEN_PER_SEC,
  };
}
