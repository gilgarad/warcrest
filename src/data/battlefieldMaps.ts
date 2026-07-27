export type TerrainMaterial = "grass" | "dirt" | "stone";

export interface WorldPointSpec {
  x: number;
  y: number;
}

export interface TerrainCellSpec {
  column: number;
  row: number;
  material: TerrainMaterial;
  variant: number;
}

export interface TerrainPatchSpec {
  id: string;
  center: WorldPointSpec;
  rotationRad: number;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  cells: TerrainCellSpec[];
}

export interface LanePathNodeSpec {
  progress: number;
  position: WorldPointSpec;
}

export interface StructureFootprintSpec {
  shape: "ellipse";
  width: number;
  height: number;
  blocksMovement: boolean;
}

export interface StructureSocketSpec {
  id: string;
  kind: "capture-tower";
  position: WorldPointSpec;
  footprint: StructureFootprintSpec;
  bypassSlots: WorldPointSpec[];
}

/**
 * Runtime map contract. Storage adapters such as Tiled JSON should translate
 * into this shape instead of leaking their schema into gameplay or rendering.
 */
export interface BattlefieldMapSpec {
  schemaVersion: 1;
  id: string;
  lanePath: LanePathNodeSpec[];
  terrainPatches: TerrainPatchSpec[];
  structureSockets: StructureSocketSpec[];
}

export const LANE_PATH_NODES: LanePathNodeSpec[] = [
  { progress: 0, position: { x: 1240, y: 3130 } },
  { progress: 0.375, position: { x: 3080, y: 2280 } },
  { progress: 0.588, position: { x: 4095, y: 1740 } },
  { progress: 0.767, position: { x: 4960, y: 1305 } },
  { progress: 1, position: { x: 5995, y: 580 } },
];

const CENTRAL_CAPTURE = LANE_PATH_NODES[2].position;
const CENTRAL_LANE_ROTATION = Math.atan2(1305 - 2280, 4960 - 3080);

function createTerrainCells(columns: number, rows: number, variantSeed = 0): TerrainCellSpec[] {
  const centerRow = (rows - 1) / 2;
  const cells: TerrainCellSpec[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const laneDistance = Math.abs(row - centerRow);
      const material: TerrainMaterial = laneDistance <= 1
        ? "stone"
        : laneDistance <= 2
          ? "dirt"
          : "grass";

      cells.push({
        column,
        row,
        material,
        variant: (column * 17 + row * 31 + variantSeed * 13) % 8,
      });
    }
  }

  return cells;
}

const CENTRAL_PATCH_COLUMNS = 8;
const CENTRAL_PATCH_ROWS = 8;

const LANE_PATCH_ROWS = 8;
const LANE_PATCH_CELL_HEIGHT = 96;
const LANE_PATCH_TARGET_CELL_WIDTH = 148;
const LANE_PATCH_OVERLAP = 240;

function createLaneTerrainPatches(): TerrainPatchSpec[] {
  return LANE_PATH_NODES.slice(0, -1).map((start, index) => {
    const end = LANE_PATH_NODES[index + 1];
    const dx = end.position.x - start.position.x;
    const dy = end.position.y - start.position.y;
    const segmentLength = Math.hypot(dx, dy) + LANE_PATCH_OVERLAP;
    const columns = Math.ceil(segmentLength / LANE_PATCH_TARGET_CELL_WIDTH);

    return {
      id: `playable-lane-segment-${index + 1}`,
      center: {
        x: (start.position.x + end.position.x) / 2,
        y: (start.position.y + end.position.y) / 2,
      },
      rotationRad: Math.atan2(dy, dx),
      columns,
      rows: LANE_PATCH_ROWS,
      cellWidth: segmentLength / columns,
      cellHeight: LANE_PATCH_CELL_HEIGHT,
      cells: createTerrainCells(columns, LANE_PATCH_ROWS, index + 1),
    };
  });
}

export function getCapturePointSocketId(capturePointId: number): string {
  return `capture-point-${capturePointId}-tower`;
}

function createCaptureSocket(capturePointId: number, pathNodeIndex: number): StructureSocketSpec {
  const previous = LANE_PATH_NODES[pathNodeIndex - 1].position;
  const current = LANE_PATH_NODES[pathNodeIndex].position;
  const next = LANE_PATH_NODES[pathNodeIndex + 1].position;
  const tangentX = next.x - previous.x;
  const tangentY = next.y - previous.y;
  const tangentLength = Math.hypot(tangentX, tangentY);
  const bypassDistance = 122;
  const perpendicularX = -tangentY / tangentLength;
  const perpendicularY = tangentX / tangentLength;

  return {
    id: getCapturePointSocketId(capturePointId),
    kind: "capture-tower",
    position: { ...current },
    footprint: {
      shape: "ellipse",
      width: 166,
      height: 76,
      blocksMovement: false,
    },
    bypassSlots: [
      {
        x: current.x + perpendicularX * bypassDistance,
        y: current.y + perpendicularY * bypassDistance,
      },
      {
        x: current.x - perpendicularX * bypassDistance,
        y: current.y - perpendicularY * bypassDistance,
      },
    ],
  };
}

const CAPTURE_SOCKETS = [
  createCaptureSocket(0, 1),
  createCaptureSocket(1, 2),
  createCaptureSocket(2, 3),
];

export const CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC: BattlefieldMapSpec = {
  schemaVersion: 1,
  id: "warcrest-central-terrain-prototype-v1",
  lanePath: LANE_PATH_NODES,
  terrainPatches: [
    {
      id: "central-capture-prototype",
      center: CENTRAL_CAPTURE,
      rotationRad: CENTRAL_LANE_ROTATION,
      columns: CENTRAL_PATCH_COLUMNS,
      rows: CENTRAL_PATCH_ROWS,
      cellWidth: 148,
      cellHeight: 108,
      cells: createTerrainCells(CENTRAL_PATCH_COLUMNS, CENTRAL_PATCH_ROWS),
    },
  ],
  structureSockets: [CAPTURE_SOCKETS[1]],
};

export const LANE_BATTLEFIELD_MAP_SPEC: BattlefieldMapSpec = {
  schemaVersion: 1,
  id: "warcrest-full-lane-hybrid-v1",
  lanePath: LANE_PATH_NODES,
  terrainPatches: createLaneTerrainPatches(),
  structureSockets: CAPTURE_SOCKETS,
};
