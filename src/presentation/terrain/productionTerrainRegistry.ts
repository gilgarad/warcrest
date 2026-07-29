import { assetUrl } from "../../config/assetUrl";
import type { TerrainMaterial, TerrainPatchSpec } from "../../data/battlefieldMaps";
import { getMarchingMask } from "../../systems/terrain/marchingSquares";

export type ProductionTerrainMaterial = "grass" | "dirt" | "road" | "stone";

const MATERIALS: readonly ProductionTerrainMaterial[] = ["grass", "dirt", "road", "stone"];
const ASSET_ROOT = assetUrl("assets/production/terrain");

export const PRODUCTION_TERRAIN_ASSETS = MATERIALS.flatMap((material) => [
  {
    key: getProductionTerrainBaseKey(material),
    path: `${ASSET_ROOT}/${material}-base.png`,
  },
  ...Array.from({ length: 16 }, (_, mask) => ({
    key: getProductionTerrainTransitionKey(material, mask),
    path: `${ASSET_ROOT}/${material}-transition-${String(mask).padStart(2, "0")}.png`,
  })),
]);

export function getProductionTerrainBaseKey(material: ProductionTerrainMaterial): string {
  return `production-terrain-${material}-base`;
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
): string | undefined {
  if (mask === 0) return undefined;
  return mask === 15
    ? getProductionTerrainBaseKey(material)
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
