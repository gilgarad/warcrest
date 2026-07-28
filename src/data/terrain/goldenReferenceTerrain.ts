import { getMarchingMask } from "../../systems/terrain/marchingSquares";

export const GOLDEN_TERRAIN_COLUMNS = 16;
export const GOLDEN_TERRAIN_ROWS = 10;
export const GOLDEN_TERRAIN_TILE_SIZE = 64;
export const GOLDEN_PATH_HALF_WIDTH_ROWS = 1.8;
export const GOLDEN_PATH_CONTROL_ROWS = [8.45, 8.05, 2.7, 1.05] as const;

function cubicBezier(start: number, controlA: number, controlB: number, end: number, t: number): number {
  const inverse = 1 - t;
  return inverse ** 3 * start
    + 3 * inverse ** 2 * t * controlA
    + 3 * inverse * t ** 2 * controlB
    + t ** 3 * end;
}

function isDirtCorner(column: number, row: number): boolean {
  const t = Math.max(0, Math.min(1, column / GOLDEN_TERRAIN_COLUMNS));
  const centerRow = cubicBezier(...GOLDEN_PATH_CONTROL_ROWS, t);
  return Math.abs(row - centerRow) <= GOLDEN_PATH_HALF_WIDTH_ROWS;
}

export const GOLDEN_TERRAIN_MASKS = Array.from({ length: GOLDEN_TERRAIN_ROWS }, (_, row) =>
  Array.from({ length: GOLDEN_TERRAIN_COLUMNS }, (_, column) => getMarchingMask({
    northWest: isDirtCorner(column, row),
    northEast: isDirtCorner(column + 1, row),
    southEast: isDirtCorner(column + 1, row + 1),
    southWest: isDirtCorner(column, row + 1),
  })),
);
