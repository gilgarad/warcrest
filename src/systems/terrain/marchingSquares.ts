export const MARCHING_CORNER = {
  northWest: 1,
  northEast: 2,
  southEast: 4,
  southWest: 8,
} as const;

export type MarchingMask = number;
export type Point = readonly [x: number, y: number];

export interface MarchingCorners {
  northWest: boolean;
  northEast: boolean;
  southEast: boolean;
  southWest: boolean;
}

export function getMarchingMask(corners: MarchingCorners): MarchingMask {
  return (corners.northWest ? MARCHING_CORNER.northWest : 0)
    | (corners.northEast ? MARCHING_CORNER.northEast : 0)
    | (corners.southEast ? MARCHING_CORNER.southEast : 0)
    | (corners.southWest ? MARCHING_CORNER.southWest : 0);
}

export function getMarchingPolygons(mask: MarchingMask, size: number): readonly (readonly Point[])[] {
  const h = size / 2;
  const nw: Point = [0, 0];
  const ne: Point = [size, 0];
  const se: Point = [size, size];
  const sw: Point = [0, size];
  const n: Point = [h, 0];
  const e: Point = [size, h];
  const s: Point = [h, size];
  const w: Point = [0, h];
  const polygons: Record<number, readonly (readonly Point[])[]> = {
    0: [],
    1: [[nw, n, w]],
    2: [[n, ne, e]],
    3: [[nw, ne, e, w]],
    4: [[e, se, s]],
    5: [[nw, n, w], [e, se, s]],
    6: [[n, ne, se, s]],
    7: [[nw, ne, se, s, w]],
    8: [[w, s, sw]],
    9: [[nw, n, s, sw]],
    10: [[n, ne, e], [w, s, sw]],
    11: [[nw, ne, e, s, sw]],
    12: [[w, e, se, sw]],
    13: [[nw, n, e, se, sw]],
    14: [[n, ne, se, sw, w]],
    15: [[nw, ne, se, sw]],
  };
  return polygons[mask] ?? [];
}
