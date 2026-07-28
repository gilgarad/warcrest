import { describe, expect, it } from "vitest";
import type { TerrainPatchSpec } from "../../../data/battlefieldMaps";
import {
  PRODUCTION_TERRAIN_ASSETS,
  getPatchMaterialMask,
  getProductionTerrainTextureKey,
  includesDirtShoulder,
  includesRoad,
} from "../productionTerrainRegistry";

const patch: TerrainPatchSpec = {
  id: "test",
  center: { x: 0, y: 0 },
  rotationRad: 0,
  columns: 3,
  rows: 3,
  cellWidth: 64,
  cellHeight: 64,
  cells: [
    "grass", "dirt", "grass",
    "dirt", "stone", "dirt",
    "grass", "dirt", "grass",
  ].map((material, index) => ({
    column: index % 3,
    row: Math.floor(index / 3),
    material: material as "grass" | "dirt" | "stone",
    variant: 0,
  })),
};

describe("production terrain registry", () => {
  it("registers four bases and every 16-state transition", () => {
    expect(PRODUCTION_TERRAIN_ASSETS).toHaveLength(68);
    expect(new Set(PRODUCTION_TERRAIN_ASSETS.map((asset) => asset.key)).size).toBe(68);
  });

  it("uses the base for full cells and skips empty cells", () => {
    expect(getProductionTerrainTextureKey("road", 0)).toBeUndefined();
    expect(getProductionTerrainTextureKey("road", 15)).toBe("production-terrain-road-base");
  });

  it("keeps neighboring transition edges continuous", () => {
    for (const predicate of [includesDirtShoulder, includesRoad]) {
      for (let row = 0; row < patch.rows; row += 1) {
        for (let column = 0; column < patch.columns - 1; column += 1) {
          const left = getPatchMaterialMask(patch, column, row, predicate);
          const right = getPatchMaterialMask(patch, column + 1, row, predicate);
          expect(Boolean(left & 2)).toBe(Boolean(right & 1));
          expect(Boolean(left & 4)).toBe(Boolean(right & 8));
        }
      }
    }
  });
});
