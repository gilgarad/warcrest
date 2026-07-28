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
  kind: "capture-point" | "defense-tower";
  progress: number;
  position: WorldPointSpec;
  footprint: StructureFootprintSpec;
  bypassSlots: WorldPointSpec[];
}

export interface TerrainPropSpec {
  id: string;
  textureKey: "rock-cluster" | "tree-cluster";
  position: WorldPointSpec;
  displayWidth: number;
  displayHeight: number;
  groundOriginY: number;
  footprint: StructureFootprintSpec;
  shadow: {
    offsetX: number;
    offsetY: number;
    widthScale: number;
    heightScale: number;
    rotationRad: number;
    alpha: number;
  };
  occludesUnits: boolean;
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
  terrainProps: TerrainPropSpec[];
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
  return `capture-point-${capturePointId}`;
}

export function getDefenseTowerSocketId(towerId: number): string {
  return `defense-tower-${towerId}`;
}

export function getLanePositionAtProgress(progress: number): WorldPointSpec {
  const clamped = Math.max(0, Math.min(1, progress));
  const endIndex = Math.max(1, LANE_PATH_NODES.findIndex((node) => node.progress >= clamped));
  const start = LANE_PATH_NODES[endIndex - 1];
  const end = LANE_PATH_NODES[endIndex] ?? LANE_PATH_NODES[LANE_PATH_NODES.length - 1];
  const local = (clamped - start.progress) / Math.max(0.0001, end.progress - start.progress);
  return {
    x: start.position.x + (end.position.x - start.position.x) * local,
    y: start.position.y + (end.position.y - start.position.y) * local,
  };
}

function createStructureSocket(
  id: string,
  kind: StructureSocketSpec["kind"],
  progress: number,
): StructureSocketSpec {
  const current = getLanePositionAtProgress(progress);
  const before = getLanePositionAtProgress(Math.max(0, progress - 0.01));
  const after = getLanePositionAtProgress(Math.min(1, progress + 0.01));
  const tangentX = after.x - before.x;
  const tangentY = after.y - before.y;
  const tangentLength = Math.hypot(tangentX, tangentY);
  const bypassDistance = 122;
  const perpendicularX = -tangentY / tangentLength;
  const perpendicularY = tangentX / tangentLength;

  return {
    id,
    kind,
    progress,
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

const CAPTURE_POINT_PROGRESS = [0.375, 0.767] as const;
export const DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID = [
  CAPTURE_POINT_PROGRESS[0] * 2,
  1 - (1 - CAPTURE_POINT_PROGRESS[1]) * 2,
] as const;

const STRUCTURE_SOCKETS = [
  ...CAPTURE_POINT_PROGRESS.map((progress, id) => createStructureSocket(getCapturePointSocketId(id), "capture-point", progress)),
  ...DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID.map((progress, id) => createStructureSocket(getDefenseTowerSocketId(id), "defense-tower", progress)),
];

const TERRAIN_PROPS: TerrainPropSpec[] = [
  { id: "rock-west-ridge", textureKey: "rock-cluster", position: { x: 1730, y: 2310 }, displayWidth: 210, displayHeight: 152, groundOriginY: 0.884, footprint: { shape: "ellipse", width: 178, height: 66, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "trees-west-south", textureKey: "tree-cluster", position: { x: 2360, y: 3110 }, displayWidth: 180, displayHeight: 238, groundOriginY: 0.902, footprint: { shape: "ellipse", width: 128, height: 62, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "rock-central-north", textureKey: "rock-cluster", position: { x: 3540, y: 1170 }, displayWidth: 196, displayHeight: 144, groundOriginY: 0.884, footprint: { shape: "ellipse", width: 164, height: 62, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "trees-central-south", textureKey: "tree-cluster", position: { x: 3880, y: 2720 }, displayWidth: 176, displayHeight: 232, groundOriginY: 0.902, footprint: { shape: "ellipse", width: 126, height: 62, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "rock-east-south", textureKey: "rock-cluster", position: { x: 5050, y: 2210 }, displayWidth: 188, displayHeight: 138, groundOriginY: 0.884, footprint: { shape: "ellipse", width: 158, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "trees-east-ridge", textureKey: "tree-cluster", position: { x: 5550, y: 1080 }, displayWidth: 174, displayHeight: 228, groundOriginY: 0.902, footprint: { shape: "ellipse", width: 124, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
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
  structureSockets: [],
  terrainProps: [],
};

export const LANE_BATTLEFIELD_MAP_SPEC: BattlefieldMapSpec = {
  schemaVersion: 1,
  id: "warcrest-full-lane-hybrid-v1",
  lanePath: LANE_PATH_NODES,
  terrainPatches: createLaneTerrainPatches(),
  structureSockets: STRUCTURE_SOCKETS,
  terrainProps: TERRAIN_PROPS,
};
