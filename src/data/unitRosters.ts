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
  | "knight";

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
      { unitId: "stone_slinger", count: 1 },
      { unitId: "archer", count: 1 },
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
];

export function getWaveRoster(ageId: AgeId): AgeWaveRoster {
  const found = AGE_WAVE_ROSTERS.find((roster) => roster.ageId === ageId);
  if (!found) throw new Error(`Unknown wave roster age: ${ageId}`);
  return found;
}
