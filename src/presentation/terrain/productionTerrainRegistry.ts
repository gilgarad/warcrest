import { assetUrl } from "../../config/assetUrl";
import type { TerrainMaterial, TerrainPatchSpec } from "../../data/battlefieldMaps";
import { getMarchingMask } from "../../systems/terrain/marchingSquares";

export type ProductionTerrainMaterial = "grass" | "dirt" | "road" | "stone" | "water";

const MATERIALS: readonly ProductionTerrainMaterial[] = ["grass", "dirt", "road", "stone", "water"];
const ASSET_ROOT = assetUrl("assets/production/terrain");

/**
 * Interchangeable cuts of the full tile.
 *
 * A single texture covered every cell of open ground, which turned the surface
 * decoration into a visible grid of itself. Picking between several by cell
 * position breaks that up. Partial tiles need no variants: they appear along
 * edges in short runs, with nothing for the eye to line them up against.
 */
export const TERRAIN_BASE_VARIANTS = 4;

export const PRODUCTION_TERRAIN_ASSETS = MATERIALS.flatMap((material) => [
  ...Array.from({ length: TERRAIN_BASE_VARIANTS }, (_, variant) => ({
    key: getProductionTerrainBaseKey(material, variant),
    path: `${ASSET_ROOT}/${material}-base${variant === 0 ? "" : `-v${variant}`}.png`,
  })),
  ...Array.from({ length: 16 }, (_, mask) => ({
    key: getProductionTerrainTransitionKey(material, mask),
    path: `${ASSET_ROOT}/${material}-transition-${String(mask).padStart(2, "0")}.png`,
  })),
]);

export function getProductionTerrainBaseKey(
  material: ProductionTerrainMaterial,
  variant = 0,
): string {
  const index = ((variant % TERRAIN_BASE_VARIANTS) + TERRAIN_BASE_VARIANTS) % TERRAIN_BASE_VARIANTS;
  return `production-terrain-${material}-base${index === 0 ? "" : `-v${index}`}`;
}

/**
 * Which variant a cell uses.
 *
 * Derived from the coordinates rather than drawn at random so the field looks
 * the same every time it is built -- a surface that reshuffles itself on reload
 * is its own kind of wrong, and in a lockstep match both players must be
 * looking at the same ground.
 */
export function getTerrainBaseVariant(column: number, row: number): number {
  return Math.abs(column * 7 + row * 13) % TERRAIN_BASE_VARIANTS;
}

export function getProductionTerrainTransitionKey(
  material: ProductionTerrainMaterial,
  mask: number,
): string {
  return `production-terrain-${material}-transition-${String(mask).padStart(2, "0")}`;
}

export function getProductionTerrainTextureKey(
  material: ProductionTerrainMaterial,
  mask: number,
  variant = 0,
): string | undefined {
  if (mask === 0) return undefined;
  return mask === 15
    ? getProductionTerrainBaseKey(material, variant)
    : getProductionTerrainTransitionKey(material, mask);
}

export function getPatchMaterialMask(
  patch: TerrainPatchSpec,
  column: number,
  row: number,
  includesMaterial: (material: TerrainMaterial) => boolean,
): number {
  const cellByCoordinate = new Map(
    patch.cells.map((cell) => [`${cell.column}:${cell.row}`, cell] as const),
  );
  const includesCell = (cellColumn: number, cellRow: number): boolean => {
    const cell = cellByCoordinate.get(`${cellColumn}:${cellRow}`);
    return cell ? includesMaterial(cell.material) : false;
  };

  // Each grid vertex samples the cell on its south-east side. Adjacent tiles
  // therefore share identical corner values and cannot open a visual seam.
  return getMarchingMask({
    northWest: includesCell(column - 1, row - 1),
    northEast: includesCell(column, row - 1),
    southEast: includesCell(column, row),
    southWest: includesCell(column - 1, row),
  });
}

export const includesDirtShoulder = (material: TerrainMaterial): boolean => material !== "grass";
export const includesRoad = (material: TerrainMaterial): boolean => material === "stone";
