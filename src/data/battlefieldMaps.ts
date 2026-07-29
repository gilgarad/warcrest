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

export type TerrainPropTextureKey =
  | "field-oak"
  | "field-pine"
  | "rock-cluster"
  | "fallen-log"
  | "field-boulder";

export interface TerrainPropSpec {
  id: string;
  textureKey: TerrainPropTextureKey;
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

export type BattlefieldMapId =
  | "warcrest-full-lane-hybrid-v1"
  | "warcrest-day2-player-front-v1";

export const LANE_PATH_NODES: LanePathNodeSpec[] = [
  { progress: 0, position: { x: 1240, y: 3130 } },
  { progress: 0.375, position: { x: 3080, y: 2280 } },
  { progress: 0.588, position: { x: 4095, y: 1740 } },
  { progress: 0.767, position: { x: 4960, y: 1305 } },
  { progress: 1, position: { x: 5995, y: 580 } },
];

const CENTRAL_CAPTURE = LANE_PATH_NODES[2].position;
const CENTRAL_LANE_ROTATION = Math.atan2(1305 - 2280, 4960 - 3080);

interface TerrainBandProfile {
  stoneHalfRows: number;
  dirtHalfRows: number;
}

const DEFAULT_TERRAIN_BANDS: TerrainBandProfile = {
  stoneHalfRows: 1,
  dirtHalfRows: 2,
};

function createTerrainCells(
  columns: number,
  rows: number,
  variantSeed = 0,
  bands: TerrainBandProfile = DEFAULT_TERRAIN_BANDS,
): TerrainCellSpec[] {
  const centerRow = (rows - 1) / 2;
  const cells: TerrainCellSpec[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const laneDistance = Math.abs(row - centerRow);
      const material: TerrainMaterial = laneDistance <= bands.stoneHalfRows
        ? "stone"
        : laneDistance <= bands.dirtHalfRows
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

function createLaneTerrainPatchesForPath(
  lanePath: readonly LanePathNodeSpec[],
  patchRows: readonly number[],
  bandProfiles: readonly TerrainBandProfile[],
  idPrefix: string,
): TerrainPatchSpec[] {
  return lanePath.slice(0, -1).map((start, index) => {
    const endNode = lanePath[index + 1];
    const dx = endNode.position.x - start.position.x;
    const dy = endNode.position.y - start.position.y;
    const segmentLength = Math.hypot(dx, dy) + LANE_PATCH_OVERLAP;
    const columns = Math.ceil(segmentLength / LANE_PATCH_TARGET_CELL_WIDTH);
    const rows = patchRows[index] ?? LANE_PATCH_ROWS;
    const bands = bandProfiles[index] ?? DEFAULT_TERRAIN_BANDS;

    return {
      id: `${idPrefix}-${index + 1}`,
      center: {
        x: (start.position.x + endNode.position.x) / 2,
        y: (start.position.y + endNode.position.y) / 2,
      },
      rotationRad: Math.atan2(dy, dx),
      columns,
      rows,
      cellWidth: segmentLength / columns,
      cellHeight: LANE_PATCH_CELL_HEIGHT,
      cells: createTerrainCells(columns, rows, index + 1, bands),
    };
  });
}

function createLaneTerrainPatches(): TerrainPatchSpec[] {
  return createLaneTerrainPatchesForPath(
    LANE_PATH_NODES,
    Array(LANE_PATH_NODES.length - 1).fill(LANE_PATCH_ROWS),
    Array(LANE_PATH_NODES.length - 1).fill(DEFAULT_TERRAIN_BANDS),
    "playable-lane-segment",
  );
}

export function getCapturePointSocketId(capturePointId: number): string {
  return `capture-point-${capturePointId}`;
}

export function getDefenseTowerSocketId(towerId: number): string {
  return `defense-tower-${towerId}`;
}

export function getStructureSocket(
  mapSpec: BattlefieldMapSpec,
  socketId: string,
): StructureSocketSpec | undefined {
  return mapSpec.structureSockets.find((socket) => socket.id === socketId);
}

export function getLanePositionAtProgressOnPath(
  lanePath: readonly LanePathNodeSpec[],
  progress: number,
): WorldPointSpec {
  const clamped = Math.max(0, Math.min(1, progress));
  const endIndex = Math.max(1, lanePath.findIndex((node) => node.progress >= clamped));
  const start = lanePath[endIndex - 1];
  const end = lanePath[endIndex] ?? lanePath[lanePath.length - 1];
  const local = (clamped - start.progress) / Math.max(0.0001, end.progress - start.progress);
  return {
    x: start.position.x + (end.position.x - start.position.x) * local,
    y: start.position.y + (end.position.y - start.position.y) * local,
  };
}

export function getLanePositionAtProgress(progress: number): WorldPointSpec {
  return getLanePositionAtProgressOnPath(LANE_PATH_NODES, progress);
}

function createStructureSocketForPath(
  lanePath: readonly LanePathNodeSpec[],
  id: string,
  kind: StructureSocketSpec["kind"],
  progress: number,
): StructureSocketSpec {
  const current = getLanePositionAtProgressOnPath(lanePath, progress);
  const before = getLanePositionAtProgressOnPath(lanePath, Math.max(0, progress - 0.01));
  const after = getLanePositionAtProgressOnPath(lanePath, Math.min(1, progress + 0.01));
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

function createStructureSocket(
  id: string,
  kind: StructureSocketSpec["kind"],
  progress: number,
): StructureSocketSpec {
  return createStructureSocketForPath(LANE_PATH_NODES, id, kind, progress);
}

const CAPTURE_POINT_PROGRESS = [0.375, 0.767] as const;
export const MIN_STRUCTURE_SOCKET_PROGRESS_GAP = 0.15;
export const DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID = [0.6, 0.2] as const;

const STRUCTURE_SOCKETS = [
  ...CAPTURE_POINT_PROGRESS.map((progress, id) => createStructureSocket(getCapturePointSocketId(id), "capture-point", progress)),
  ...DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID.map((progress, id) => createStructureSocket(getDefenseTowerSocketId(id), "defense-tower", progress)),
];

const TERRAIN_PROPS: TerrainPropSpec[] = [
  { id: "rock-west-ridge", textureKey: "field-boulder", position: { x: 1730, y: 2310 }, displayWidth: 220, displayHeight: 220, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 178, height: 66, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "trees-west-south", textureKey: "field-oak", position: { x: 2360, y: 3110 }, displayWidth: 250, displayHeight: 250, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 128, height: 62, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "rock-central-north", textureKey: "rock-cluster", position: { x: 3540, y: 1170 }, displayWidth: 210, displayHeight: 210, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 164, height: 62, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "trees-central-south", textureKey: "fallen-log", position: { x: 3880, y: 2720 }, displayWidth: 230, displayHeight: 230, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 126, height: 62, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "rock-east-south", textureKey: "field-boulder", position: { x: 5050, y: 2210 }, displayWidth: 208, displayHeight: 208, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 158, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "trees-east-ridge", textureKey: "field-pine", position: { x: 5550, y: 1080 }, displayWidth: 248, displayHeight: 248, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 124, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
];

export const DAY2_PLAYER_FRONT_LANE_PATH_NODES: LanePathNodeSpec[] = [
  { progress: 0, position: { x: 1240, y: 3130 } },
  { progress: 0.08, position: { x: 1580, y: 3015 } },
  { progress: 0.16, position: { x: 1955, y: 2890 } },
  { progress: 0.24, position: { x: 2380, y: 2615 } },
  { progress: 0.34, position: { x: 2950, y: 2285 } },
  { progress: 0.58, position: { x: 4095, y: 1740 } },
  { progress: 0.78, position: { x: 4980, y: 1280 } },
  { progress: 1, position: { x: 5995, y: 580 } },
];

const DAY2_PLAYER_FRONT_PATCH_ROWS = [10, 10, 8, 6, 8, 8, 10] as const;
const DAY2_PLAYER_FRONT_BANDS: readonly TerrainBandProfile[] = [
  { stoneHalfRows: 2, dirtHalfRows: 4 },
  { stoneHalfRows: 1, dirtHalfRows: 4 },
  { stoneHalfRows: 2, dirtHalfRows: 3 },
  { stoneHalfRows: 2, dirtHalfRows: 2 },
  { stoneHalfRows: 1, dirtHalfRows: 3 },
  { stoneHalfRows: 1, dirtHalfRows: 3 },
  { stoneHalfRows: 2, dirtHalfRows: 4 },
];

const DAY2_PLAYER_FRONT_STRUCTURE_SOCKETS = [
  createStructureSocketForPath(
    DAY2_PLAYER_FRONT_LANE_PATH_NODES,
    getCapturePointSocketId(0),
    "capture-point",
    0.17,
  ),
  createStructureSocketForPath(
    DAY2_PLAYER_FRONT_LANE_PATH_NODES,
    getDefenseTowerSocketId(0),
    "defense-tower",
    0.37,
  ),
  createStructureSocketForPath(
    DAY2_PLAYER_FRONT_LANE_PATH_NODES,
    getDefenseTowerSocketId(1),
    "defense-tower",
    0.64,
  ),
  createStructureSocketForPath(
    DAY2_PLAYER_FRONT_LANE_PATH_NODES,
    getCapturePointSocketId(1),
    "capture-point",
    0.84,
  ),
];

const DAY2_PLAYER_FRONT_PROPS: TerrainPropSpec[] = [
  { id: "day2-west-oak-cluster-a", textureKey: "field-oak", position: { x: 1680, y: 3380 }, displayWidth: 258, displayHeight: 258, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 134, height: 62, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day2-west-pine-cluster-b", textureKey: "field-pine", position: { x: 1960, y: 3465 }, displayWidth: 236, displayHeight: 236, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 122, height: 58, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day2-west-boulder-boundary", textureKey: "field-boulder", position: { x: 1505, y: 2685 }, displayWidth: 214, displayHeight: 214, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 162, height: 62, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "day2-west-rock-rim", textureKey: "rock-cluster", position: { x: 2355, y: 3335 }, displayWidth: 204, displayHeight: 204, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 162, height: 62, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "day2-pass-fallen-log", textureKey: "fallen-log", position: { x: 2585, y: 2110 }, displayWidth: 224, displayHeight: 224, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 126, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day2-pass-pine", textureKey: "field-pine", position: { x: 3170, y: 2640 }, displayWidth: 238, displayHeight: 238, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 122, height: 58, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day2-landmark-oak", textureKey: "field-oak", position: { x: 2795, y: 1800 }, displayWidth: 252, displayHeight: 252, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 132, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day2-pass-rock", textureKey: "rock-cluster", position: { x: 3285, y: 1865 }, displayWidth: 196, displayHeight: 196, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 154, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
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

export const DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC: BattlefieldMapSpec = {
  schemaVersion: 1,
  id: "warcrest-day2-player-front-v1",
  lanePath: DAY2_PLAYER_FRONT_LANE_PATH_NODES,
  terrainPatches: createLaneTerrainPatchesForPath(
    DAY2_PLAYER_FRONT_LANE_PATH_NODES,
    DAY2_PLAYER_FRONT_PATCH_ROWS,
    DAY2_PLAYER_FRONT_BANDS,
    "day2-player-front-segment",
  ),
  structureSockets: DAY2_PLAYER_FRONT_STRUCTURE_SOCKETS,
  terrainProps: DAY2_PLAYER_FRONT_PROPS,
};

export const BATTLEFIELD_MAP_SPECS: readonly BattlefieldMapSpec[] = [
  LANE_BATTLEFIELD_MAP_SPEC,
  DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC,
];

export function getBattlefieldMapSpec(mapId?: string | null): BattlefieldMapSpec {
  return BATTLEFIELD_MAP_SPECS.find((spec) => spec.id === mapId) ?? LANE_BATTLEFIELD_MAP_SPEC;
}
