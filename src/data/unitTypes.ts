import type { ChibiPalette } from "../gfx/chibi";

/**
 * Registry of unit types. Only one entry exists today ("병사"). Add more
 * entries here to introduce new unit types — nothing else in the codebase
 * needs to change: the chibi generator reads `palette`, the squad/combat
 * systems only ever reference units by `id`.
 */
export interface UnitTypeDef {
  id: string;
  name: string;
  palette: ChibiPalette;
  baseHp: number;
  baseAttack: number;
  attackCooldownMs: number;
  attackRange: number;
  canAutoAttack?: boolean;
}

export const UNIT_TYPES: UnitTypeDef[] = [
  {
    id: "leader",
    name: "리더",
    palette: { skin: 0xffcc99, outfit: 0x5b6c82, accent: 0xf4d35e },
    baseHp: 100,
    baseAttack: 0,
    attackCooldownMs: 0,
    attackRange: 0,
    canAutoAttack: false,
  },
  {
    id: "soldier",
    name: "병사",
    palette: { skin: 0xffcc99, outfit: 0x2f6fe0, accent: 0xffd23f },
    baseHp: 100,
    baseAttack: 8,
    attackCooldownMs: 666,
    attackRange: 22,
    canAutoAttack: true,
  },
];

export function getUnitType(id: string): UnitTypeDef {
  const found = UNIT_TYPES.find((u) => u.id === id);
  if (!found) throw new Error(`Unknown unit type: ${id}`);
  return found;
}

export const DEFAULT_UNIT_TYPE_ID = "soldier";
