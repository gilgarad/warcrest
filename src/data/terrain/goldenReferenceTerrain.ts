import { getMarchingMask } from "../../systems/terrain/marchingSquares";

export const GOLDEN_TERRAIN_COLUMNS = 16;
export const GOLDEN_TERRAIN_ROWS = 10;
export const GOLDEN_TERRAIN_TILE_SIZE = 64;

function isDirtCorner(column: number, row: number): boolean {
  const centerRow = 8.2 - column * 0.43;
  return Math.abs(row - centerRow) <= 1.45;
}

export const GOLDEN_TERRAIN_MASKS = Array.from({ length: GOLDEN_TERRAIN_ROWS }, (_, row) =>
  Array.from({ length: GOLDEN_TERRAIN_COLUMNS }, (_, column) => getMarchingMask({
    northWest: isDirtCorner(column, row),
    northEast: isDirtCorner(column + 1, row),
    southEast: isDirtCorner(column + 1, row + 1),
    southWest: isDirtCorner(column, row + 1),
  })),
);
