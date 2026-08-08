import type { BattleUnitId } from "../../data/unitRosters";
import type { LaneUnitId } from "./unitStats";

/**
 * Weapon-archetype tags used to pick a period/weapon-appropriate combat SFX
 * variant per unit, instead of one flat melee/ranged sound for every era.
 */
export type MeleeWeaponArchetype = "blunt" | "blade" | "polearm" | "mechanized";
export type RangedWeaponArchetype = "sling" | "bow" | "musket" | "rifle" | "cannon" | "tank";

const MELEE_ARCHETYPE: Partial<Record<BattleUnitId, MeleeWeaponArchetype>> = {
  stone_axeman: "blunt",
  bronze_swordsman: "blade",
  bronze_spearman: "polearm",
  iron_swordsman: "blade",
  iron_spearman: "polearm",
  knight: "blade",
  pikeman: "polearm",
  heavy_cavalry: "blade",
  light_cavalry: "blade",
  cavalry: "blade",
  shock_trooper: "mechanized",
  breakthrough_trooper: "mechanized",
};

const RANGED_ARCHETYPE: Partial<Record<BattleUnitId, RangedWeaponArchetype>> = {
  stone_slinger: "sling",
  archer: "bow",
  musketeer: "musket",
  rifleman: "musket",
  grenadier: "musket",
  cannon_i: "cannon",
  rifleman_late: "rifle",
  grenadier_late: "rifle",
  cannon_ii: "cannon",
  infantry: "rifle",
  machine_gunner: "rifle",
  artillery_i: "cannon",
  automatic_rifleman: "rifle",
  support_gunner: "rifle",
  mobile_infantry: "rifle",
  artillery_ii: "cannon",
  tank: "tank",
  special_forces: "rifle",
  heavy_gunner: "rifle",
  mobile_artillery: "cannon",
  modern_tank: "tank",
};

function asBattleUnitId(unitId: LaneUnitId): BattleUnitId | undefined {
  return unitId === "supply_wagon" ? undefined : unitId;
}

export function getMeleeAttackSfxKey(unitId: LaneUnitId): string {
  const battleId = asBattleUnitId(unitId);
  const archetype = battleId ? MELEE_ARCHETYPE[battleId] : undefined;
  return archetype ? `sfx.combat.meleeAttack.${archetype}` : "sfx.combat.meleeAttack";
}

export function getMeleeHitSfxKey(unitId: LaneUnitId): string {
  const battleId = asBattleUnitId(unitId);
  const archetype = battleId ? MELEE_ARCHETYPE[battleId] : undefined;
  return archetype ? `sfx.combat.meleeHit.${archetype}` : "sfx.combat.meleeHit";
}

export function getRangedFireSfxKey(unitId: LaneUnitId): string {
  const battleId = asBattleUnitId(unitId);
  const archetype = battleId ? RANGED_ARCHETYPE[battleId] : undefined;
  return archetype ? `sfx.combat.rangedFire.${archetype}` : "sfx.combat.rangedFire";
}

export function getProjectileHitSfxKey(unitId: LaneUnitId): string {
  const battleId = asBattleUnitId(unitId);
  const archetype = battleId ? RANGED_ARCHETYPE[battleId] : undefined;
  return archetype ? `sfx.combat.projectileHit.${archetype}` : "sfx.combat.projectileHit";
}
