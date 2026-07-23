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
}

export const UNIT_TYPES: UnitTypeDef[] = [
  {
    id: "soldier",
    name: "병사",
    palette: { skin: 0xf2c299, outfit: 0x3d5a80, accent: 0xf2c14e },
  },
];

export function getUnitType(id: string): UnitTypeDef {
  const found = UNIT_TYPES.find((u) => u.id === id);
  if (!found) throw new Error(`Unknown unit type: ${id}`);
  return found;
}

export const DEFAULT_UNIT_TYPE_ID = UNIT_TYPES[0].id;
