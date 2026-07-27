import { getSupportHealPower, type BattleUnitId, type SupportUnitId } from "../../data/unitRosters";

export type LaneUnitId = BattleUnitId | SupportUnitId;

export interface UnitStatDef {
  hp: number;
  attack: number;
  defense: number;
  range: number;
  speed: number;
  attackCooldownSec: number;
  healPower?: number;
  label: string;
  textureKey: string;
  tint: number;
}

export const UNIT_STATS: Record<LaneUnitId, UnitStatDef> = {
  stone_slinger: { hp: 26, attack: 7, defense: 2, range: 4.5, speed: 1.05, attackCooldownSec: 1.3, label: "투석", textureKey: "stone-slinger-unit", tint: 0xd4b27c },
  stone_axeman: { hp: 34, attack: 9, defense: 3, range: 1.5, speed: 1.1, attackCooldownSec: 1.0, label: "도끼", textureKey: "stone-axeman-unit", tint: 0xa7b1be },
  bronze_swordsman: { hp: 42, attack: 12, defense: 5, range: 1.5, speed: 1.1, attackCooldownSec: 0.95, label: "청동검", textureKey: "token-axe", tint: 0xe1af64 },
  bronze_spearman: { hp: 38, attack: 11, defense: 5, range: 2.2, speed: 1.0, attackCooldownSec: 1.05, label: "청동창", textureKey: "bronze-spearman-idle", tint: 0xd1c28f },
  archer: { hp: 30, attack: 13, defense: 3, range: 5.2, speed: 1.15, attackCooldownSec: 2.0, label: "활", textureKey: "token-ranged", tint: 0x90c6ff },
  iron_swordsman: { hp: 54, attack: 16, defense: 8, range: 1.6, speed: 1.12, attackCooldownSec: 0.9, label: "철검", textureKey: "token-axe", tint: 0xdfe7f4 },
  iron_spearman: { hp: 50, attack: 15, defense: 7, range: 2.4, speed: 1.06, attackCooldownSec: 1.0, label: "철창", textureKey: "token-spear", tint: 0xa7c8dd },
  musketeer: { hp: 36, attack: 21, defense: 4, range: 6.4, speed: 1.0, attackCooldownSec: 2.1, label: "머스킷", textureKey: "token-ranged", tint: 0xc09aff },
  knight: { hp: 72, attack: 22, defense: 10, range: 1.8, speed: 1.35, attackCooldownSec: 1.45, label: "기사", textureKey: "token-elite", tint: 0xffe1a1 },
  supply_wagon: { hp: 54, attack: 0, defense: 3, range: 4.4, speed: 0.98, attackCooldownSec: 1.2, healPower: getSupportHealPower("stone"), label: "보급", textureKey: "stone-supply-unit", tint: 0x89da93 },
};

export function getProjectileKeyForUnit(unitId: LaneUnitId): string {
  if (unitId === "stone_slinger") return "projectile-stone";
  if (unitId === "archer") return "projectile-arrow";
  if (unitId === "musketeer") return "projectile-shot";
  return "projectile-stone";
}
