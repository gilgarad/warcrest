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
  laneId?: string;
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

export interface BattlefieldLaneSpec {
  id: string;
  role: "north" | "south" | "center" | "custom";
  path: LanePathNodeSpec[];
}

export interface LaneSocketProgressRef {
  laneId: string;
  progress: number;
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
  laneRef: LaneSocketProgressRef;
  progress: number;
  position: WorldPointSpec;
  footprint: StructureFootprintSpec;
  bypassSlots: WorldPointSpec[];
  teamOwner?: "player" | "enemy" | "neutral";
  linkedSocketId?: string;
}

export type TerrainPropTextureKey =
  | "field-oak"
  | "field-pine"
  | "rock-cluster"
  | "fallen-log"
  | "field-boulder";

export interface TerrainPropSpec {
  id: string;
  laneId?: string;
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
  schemaVersion: 2;
  id: string;
  lanes: BattlefieldLaneSpec[];
  terrainPatches: TerrainPatchSpec[];
  structureSockets: StructureSocketSpec[];
  terrainProps: TerrainPropSpec[];
}

export type BattlefieldMapId =
  | "warcrest-full-lane-hybrid-v1"
  | "warcrest-day2-player-front-v1"
  | "warcrest-day3-three-fronts-v1"
  | "warcrest-two-lane-v1"
  | "warcrest-two-lane-compact-v1";

/**
 * Centred in the 7000x3900 world: each endpoint now sits 1122px from its own
 * vertical edge and 675px from its own horizontal edge.
 *
 * The lane used to end closer to the world edge on the enemy side (1005px
 * right / 580px top) than on the player side (1240px left / 770px bottom), so
 * the player's base had visibly more open ground behind it than the enemy's.
 * Terrain in `world-surface` mode is drawn procedurally from this path — the
 * painted backgrounds are hidden in that mode — so moving the path moves the
 * road and every structure socket with it.
 */
export const LANE_PATH_NODES: LanePathNodeSpec[] = [
  { progress: 0, position: { x: 1123, y: 3225 } },
  { progress: 0.375, position: { x: 2963, y: 2375 } },
  { progress: 0.588, position: { x: 3978, y: 1835 } },
  { progress: 0.767, position: { x: 4843, y: 1400 } },
  { progress: 1, position: { x: 5878, y: 675 } },
];

export const MAIN_LANE_ID = "main";
export const NORTH_LANE_ID = "north";
export const SOUTH_LANE_ID = "south";

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
  laneId: string,
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
      laneId,
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
    MAIN_LANE_ID,
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

export function getLaneSpec(
  mapSpec: BattlefieldMapSpec,
  laneId: string,
): BattlefieldLaneSpec | undefined {
  return mapSpec.lanes.find((lane) => lane.id === laneId);
}

export function getPrimaryLaneSpec(mapSpec: BattlefieldMapSpec): BattlefieldLaneSpec {
  return mapSpec.lanes[0];
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

export function getLanePositionAtProgress(progress: number, lanePath = LANE_PATH_NODES): WorldPointSpec {
  return getLanePositionAtProgressOnPath(lanePath, progress);
}

function createStructureSocketForPath(
  laneId: string,
  lanePath: readonly LanePathNodeSpec[],
  id: string,
  kind: StructureSocketSpec["kind"],
  progress: number,
  options: Pick<StructureSocketSpec, "teamOwner" | "linkedSocketId"> = {},
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
    laneRef: { laneId, progress },
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
    ...options,
  };
}

function createStructureSocket(
  id: string,
  kind: StructureSocketSpec["kind"],
  progress: number,
): StructureSocketSpec {
  return createStructureSocketForPath(MAIN_LANE_ID, LANE_PATH_NODES, id, kind, progress);
}

export const PLAYER_SIDE_PROGRESS_MAX = 0.5;
export const ENEMY_SIDE_PROGRESS_MIN = 0.5;
export const CAPTURE_POINT_PROGRESS = [0.17, 0.83] as const;
export const MIN_STRUCTURE_SOCKET_PROGRESS_GAP = 0.15;
export const DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID = [0.37, 0.63] as const;

const STRUCTURE_SOCKETS = [
  ...CAPTURE_POINT_PROGRESS.map((progress, id) => createStructureSocket(getCapturePointSocketId(id), "capture-point", progress)),
  ...DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID.map((progress, id) => createStructureSocketForPath(
    MAIN_LANE_ID,
    LANE_PATH_NODES,
    getDefenseTowerSocketId(id),
    "defense-tower",
    progress,
    {
      teamOwner: id === 0 ? "player" : "enemy",
      linkedSocketId: getCapturePointSocketId(id),
    },
  )),
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

export const DAY3_THREE_FRONTS_LANE_PATH_NODES: LanePathNodeSpec[] = [
  { progress: 0.00, position: { x: 1240, y: 3130 } },
  { progress: 0.10, position: { x: 1710, y: 3065 } },
  { progress: 0.20, position: { x: 2235, y: 2840 } },
  { progress: 0.32, position: { x: 2825, y: 2425 } },
  { progress: 0.46, position: { x: 3525, y: 1935 } },
  { progress: 0.60, position: { x: 4300, y: 1715 } },
  { progress: 0.72, position: { x: 4925, y: 1420 } },
  { progress: 0.86, position: { x: 5525, y: 980 } },
  { progress: 1.00, position: { x: 5995, y: 580 } },
];

export const TWO_LANE_NORTH_PATH_NODES: LanePathNodeSpec[] = [
  { progress: 0.00, position: { x: 1160, y: 1980 } },
  { progress: 0.09, position: { x: 1460, y: 1280 } },
  { progress: 0.21, position: { x: 2020, y: 980 } },
  { progress: 0.35, position: { x: 2860, y: 860 } },
  { progress: 0.50, position: { x: 3840, y: 860 } },
  { progress: 0.65, position: { x: 4720, y: 930 } },
  { progress: 0.79, position: { x: 5380, y: 1080 } },
  { progress: 0.91, position: { x: 5780, y: 1280 } },
  { progress: 1.00, position: { x: 5960, y: 1980 } },
];

export const TWO_LANE_SOUTH_PATH_NODES: LanePathNodeSpec[] = [
  { progress: 0.00, position: { x: 1160, y: 1980 } },
  { progress: 0.09, position: { x: 1460, y: 2680 } },
  { progress: 0.21, position: { x: 2020, y: 2980 } },
  { progress: 0.35, position: { x: 2860, y: 3100 } },
  { progress: 0.50, position: { x: 3840, y: 3100 } },
  { progress: 0.65, position: { x: 4720, y: 3030 } },
  { progress: 0.79, position: { x: 5380, y: 2880 } },
  { progress: 0.91, position: { x: 5780, y: 2680 } },
  { progress: 1.00, position: { x: 5960, y: 1980 } },
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
    MAIN_LANE_ID,
    DAY2_PLAYER_FRONT_LANE_PATH_NODES,
    getCapturePointSocketId(0),
    "capture-point",
    0.17,
  ),
  createStructureSocketForPath(
    MAIN_LANE_ID,
    DAY2_PLAYER_FRONT_LANE_PATH_NODES,
    getDefenseTowerSocketId(0),
    "defense-tower",
    0.37,
    { teamOwner: "player", linkedSocketId: getCapturePointSocketId(0) },
  ),
  createStructureSocketForPath(
    MAIN_LANE_ID,
    DAY2_PLAYER_FRONT_LANE_PATH_NODES,
    getDefenseTowerSocketId(1),
    "defense-tower",
    0.64,
    { teamOwner: "enemy", linkedSocketId: getCapturePointSocketId(1) },
  ),
  createStructureSocketForPath(
    MAIN_LANE_ID,
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

const DAY3_THREE_FRONTS_PATCH_ROWS = [10, 10, 8, 6, 8, 8, 6, 10] as const;
const DAY3_THREE_FRONTS_BANDS: readonly TerrainBandProfile[] = [
  { stoneHalfRows: 2, dirtHalfRows: 4 },
  { stoneHalfRows: 1, dirtHalfRows: 4 },
  { stoneHalfRows: 1, dirtHalfRows: 3 },
  { stoneHalfRows: 2, dirtHalfRows: 2 },
  { stoneHalfRows: 2, dirtHalfRows: 3 },
  { stoneHalfRows: 1, dirtHalfRows: 3 },
  { stoneHalfRows: 2, dirtHalfRows: 2 },
  { stoneHalfRows: 2, dirtHalfRows: 4 },
];

const DAY3_THREE_FRONTS_STRUCTURE_SOCKETS = [
  createStructureSocketForPath(
    MAIN_LANE_ID,
    DAY3_THREE_FRONTS_LANE_PATH_NODES,
    getCapturePointSocketId(0),
    "capture-point",
    0.17,
  ),
  createStructureSocketForPath(
    MAIN_LANE_ID,
    DAY3_THREE_FRONTS_LANE_PATH_NODES,
    getDefenseTowerSocketId(0),
    "defense-tower",
    0.37,
    { teamOwner: "player", linkedSocketId: getCapturePointSocketId(0) },
  ),
  createStructureSocketForPath(
    MAIN_LANE_ID,
    DAY3_THREE_FRONTS_LANE_PATH_NODES,
    getDefenseTowerSocketId(1),
    "defense-tower",
    0.64,
    { teamOwner: "enemy", linkedSocketId: getCapturePointSocketId(1) },
  ),
  createStructureSocketForPath(
    MAIN_LANE_ID,
    DAY3_THREE_FRONTS_LANE_PATH_NODES,
    getCapturePointSocketId(1),
    "capture-point",
    0.84,
  ),
];

const DAY3_THREE_FRONTS_PROPS: TerrainPropSpec[] = [
  { id: "day3-west-ridge-oak-a", textureKey: "field-oak", position: { x: 1520, y: 3385 }, displayWidth: 248, displayHeight: 248, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 132, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-west-ridge-pine-a", textureKey: "field-pine", position: { x: 1775, y: 3450 }, displayWidth: 238, displayHeight: 238, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 122, height: 58, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-west-boundary-boulder", textureKey: "field-boulder", position: { x: 1450, y: 2750 }, displayWidth: 212, displayHeight: 212, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 160, height: 62, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "day3-west-landmark-rock", textureKey: "rock-cluster", position: { x: 2110, y: 3335 }, displayWidth: 208, displayHeight: 208, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 158, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "day3-west-log", textureKey: "fallen-log", position: { x: 2460, y: 2355 }, displayWidth: 224, displayHeight: 224, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 126, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-west-passage-pine", textureKey: "field-pine", position: { x: 2825, y: 2710 }, displayWidth: 236, displayHeight: 236, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 122, height: 58, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-west-passage-oak", textureKey: "field-oak", position: { x: 3175, y: 1760 }, displayWidth: 252, displayHeight: 252, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 132, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-west-passage-rock", textureKey: "rock-cluster", position: { x: 3330, y: 2225 }, displayWidth: 198, displayHeight: 198, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 154, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "day3-central-oak-south", textureKey: "field-oak", position: { x: 3535, y: 2485 }, displayWidth: 246, displayHeight: 246, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 130, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-central-oak-north", textureKey: "field-oak", position: { x: 3770, y: 1285 }, displayWidth: 248, displayHeight: 248, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 130, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-central-rock-southwest", textureKey: "field-boulder", position: { x: 3360, y: 2265 }, displayWidth: 214, displayHeight: 214, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 160, height: 62, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "day3-central-rock-northeast", textureKey: "rock-cluster", position: { x: 4155, y: 1290 }, displayWidth: 208, displayHeight: 208, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 158, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "day3-central-log", textureKey: "fallen-log", position: { x: 4305, y: 2210 }, displayWidth: 224, displayHeight: 224, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 126, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-east-passage-pine-a", textureKey: "field-pine", position: { x: 4680, y: 2135 }, displayWidth: 236, displayHeight: 236, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 122, height: 58, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-east-passage-pine-b", textureKey: "field-pine", position: { x: 4865, y: 895 }, displayWidth: 236, displayHeight: 236, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 122, height: 58, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-east-passage-boulder", textureKey: "field-boulder", position: { x: 5125, y: 2045 }, displayWidth: 210, displayHeight: 210, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 158, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "day3-east-passage-rock", textureKey: "rock-cluster", position: { x: 5360, y: 1510 }, displayWidth: 198, displayHeight: 198, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 154, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "day3-east-basin-oak", textureKey: "field-oak", position: { x: 5630, y: 1760 }, displayWidth: 248, displayHeight: 248, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 132, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-east-basin-pine", textureKey: "field-pine", position: { x: 5905, y: 1565 }, displayWidth: 236, displayHeight: 236, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 122, height: 58, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "day3-east-basin-log", textureKey: "fallen-log", position: { x: 5750, y: 640 }, displayWidth: 224, displayHeight: 224, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 126, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
];

const TWO_LANE_PATCH_ROWS = [10, 10, 8, 8, 8, 8, 10, 10] as const;
const TWO_LANE_BANDS: readonly TerrainBandProfile[] = [
  { stoneHalfRows: 2, dirtHalfRows: 4 },
  { stoneHalfRows: 2, dirtHalfRows: 4 },
  { stoneHalfRows: 1, dirtHalfRows: 4 },
  { stoneHalfRows: 1, dirtHalfRows: 3 },
  { stoneHalfRows: 1, dirtHalfRows: 3 },
  { stoneHalfRows: 1, dirtHalfRows: 4 },
  { stoneHalfRows: 2, dirtHalfRows: 4 },
  { stoneHalfRows: 2, dirtHalfRows: 4 },
];

const TWO_LANE_STRUCTURE_SOCKETS: StructureSocketSpec[] = [
  createStructureSocketForPath(NORTH_LANE_ID, TWO_LANE_NORTH_PATH_NODES, "north-capture-player", "capture-point", 0.18),
  createStructureSocketForPath(NORTH_LANE_ID, TWO_LANE_NORTH_PATH_NODES, "north-tower-player", "defense-tower", 0.38, { teamOwner: "player", linkedSocketId: "north-capture-player" }),
  createStructureSocketForPath(NORTH_LANE_ID, TWO_LANE_NORTH_PATH_NODES, "north-tower-enemy", "defense-tower", 0.62, { teamOwner: "enemy", linkedSocketId: "north-capture-enemy" }),
  createStructureSocketForPath(NORTH_LANE_ID, TWO_LANE_NORTH_PATH_NODES, "north-capture-enemy", "capture-point", 0.82),
  createStructureSocketForPath(SOUTH_LANE_ID, TWO_LANE_SOUTH_PATH_NODES, "south-capture-player", "capture-point", 0.18),
  createStructureSocketForPath(SOUTH_LANE_ID, TWO_LANE_SOUTH_PATH_NODES, "south-tower-player", "defense-tower", 0.38, { teamOwner: "player", linkedSocketId: "south-capture-player" }),
  createStructureSocketForPath(SOUTH_LANE_ID, TWO_LANE_SOUTH_PATH_NODES, "south-tower-enemy", "defense-tower", 0.62, { teamOwner: "enemy", linkedSocketId: "south-capture-enemy" }),
  createStructureSocketForPath(SOUTH_LANE_ID, TWO_LANE_SOUTH_PATH_NODES, "south-capture-enemy", "capture-point", 0.82),
];

const TWO_LANE_PROPS: TerrainPropSpec[] = [
  { id: "two-lane-north-west-pines", laneId: NORTH_LANE_ID, textureKey: "field-pine", position: { x: 1620, y: 1090 }, displayWidth: 238, displayHeight: 238, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 122, height: 58, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "two-lane-north-west-rock", laneId: NORTH_LANE_ID, textureKey: "rock-cluster", position: { x: 2320, y: 1010 }, displayWidth: 208, displayHeight: 208, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 158, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "two-lane-center-divider-oak", textureKey: "field-oak", position: { x: 3470, y: 1970 }, displayWidth: 256, displayHeight: 256, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 134, height: 62, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "two-lane-center-divider-boulder", textureKey: "field-boulder", position: { x: 3925, y: 1985 }, displayWidth: 212, displayHeight: 212, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 160, height: 62, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "two-lane-south-west-log", laneId: SOUTH_LANE_ID, textureKey: "fallen-log", position: { x: 2260, y: 3050 }, displayWidth: 224, displayHeight: 224, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 126, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "two-lane-south-west-oaks", laneId: SOUTH_LANE_ID, textureKey: "field-oak", position: { x: 1760, y: 3200 }, displayWidth: 252, displayHeight: 252, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 132, height: 60, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
  { id: "two-lane-north-east-boulder", laneId: NORTH_LANE_ID, textureKey: "field-boulder", position: { x: 5175, y: 990 }, displayWidth: 210, displayHeight: 210, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 158, height: 60, blocksMovement: false }, shadow: { offsetX: 4, offsetY: 2, widthScale: 0.92, heightScale: 0.5, rotationRad: -0.08, alpha: 0.3 }, occludesUnits: true },
  { id: "two-lane-south-east-pines", laneId: SOUTH_LANE_ID, textureKey: "field-pine", position: { x: 5210, y: 2935 }, displayWidth: 236, displayHeight: 236, groundOriginY: 0.875, footprint: { shape: "ellipse", width: 122, height: 58, blocksMovement: false }, shadow: { offsetX: 7, offsetY: 3, widthScale: 0.84, heightScale: 0.52, rotationRad: -0.1, alpha: 0.34 }, occludesUnits: true },
];
export const CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC: BattlefieldMapSpec = {
  schemaVersion: 2,
  id: "warcrest-central-terrain-prototype-v1",
  lanes: [{ id: MAIN_LANE_ID, role: "center", path: LANE_PATH_NODES }],
  terrainPatches: [
    {
      id: "central-capture-prototype",
      laneId: MAIN_LANE_ID,
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
  schemaVersion: 2,
  id: "warcrest-full-lane-hybrid-v1",
  lanes: [{ id: MAIN_LANE_ID, role: "center", path: LANE_PATH_NODES }],
  terrainPatches: createLaneTerrainPatches(),
  structureSockets: STRUCTURE_SOCKETS,
  terrainProps: TERRAIN_PROPS,
};

export const DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC: BattlefieldMapSpec = {
  schemaVersion: 2,
  id: "warcrest-day2-player-front-v1",
  lanes: [{ id: MAIN_LANE_ID, role: "center", path: DAY2_PLAYER_FRONT_LANE_PATH_NODES }],
  terrainPatches: createLaneTerrainPatchesForPath(
    MAIN_LANE_ID,
    DAY2_PLAYER_FRONT_LANE_PATH_NODES,
    DAY2_PLAYER_FRONT_PATCH_ROWS,
    DAY2_PLAYER_FRONT_BANDS,
    "day2-player-front-segment",
  ),
  structureSockets: DAY2_PLAYER_FRONT_STRUCTURE_SOCKETS,
  terrainProps: DAY2_PLAYER_FRONT_PROPS,
};

export const DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC: BattlefieldMapSpec = {
  schemaVersion: 2,
  // Archived on July 30, 2026 after the user approved the two-lane redesign
  // as the production default. Keep this switchable for historical comparison.
  id: "warcrest-day3-three-fronts-v1",
  lanes: [{ id: MAIN_LANE_ID, role: "center", path: DAY3_THREE_FRONTS_LANE_PATH_NODES }],
  terrainPatches: createLaneTerrainPatchesForPath(
    MAIN_LANE_ID,
    DAY3_THREE_FRONTS_LANE_PATH_NODES,
    DAY3_THREE_FRONTS_PATCH_ROWS,
    DAY3_THREE_FRONTS_BANDS,
    "day3-three-fronts-segment",
  ),
  structureSockets: DAY3_THREE_FRONTS_STRUCTURE_SOCKETS,
  terrainProps: DAY3_THREE_FRONTS_PROPS,
};

export const TWO_LANE_MAP_CANDIDATE_SPEC: BattlefieldMapSpec = {
  schemaVersion: 2,
  id: "warcrest-two-lane-v1",
  lanes: [
    { id: NORTH_LANE_ID, role: "north", path: TWO_LANE_NORTH_PATH_NODES },
    { id: SOUTH_LANE_ID, role: "south", path: TWO_LANE_SOUTH_PATH_NODES },
  ],
  terrainPatches: [
    ...createLaneTerrainPatchesForPath(
      NORTH_LANE_ID,
      TWO_LANE_NORTH_PATH_NODES,
      TWO_LANE_PATCH_ROWS,
      TWO_LANE_BANDS,
      "two-lane-north-segment",
    ),
    ...createLaneTerrainPatchesForPath(
      SOUTH_LANE_ID,
      TWO_LANE_SOUTH_PATH_NODES,
      TWO_LANE_PATCH_ROWS,
      TWO_LANE_BANDS,
      "two-lane-south-segment",
    ),
  ],
  structureSockets: TWO_LANE_STRUCTURE_SOCKETS,
  terrainProps: TWO_LANE_PROPS,
};

/**
 * Compact two-lane layout, built for a phone held sideways.
 *
 * Same shape as `warcrest-two-lane-v1`, scaled about the midfield: 0.60 across
 * and 0.33 vertically. The vertical squeeze is the point -- the original lanes
 * sit 2240 units apart, and a phone's battlefield strip only shows about 1650,
 * so the two fronts could never be on screen together. At 740 apart they fit
 * with room for the units standing in them.
 *
 * Shrinking the map is what buys bigger units: the camera fits a smaller box, so
 * everything in it is drawn larger. A phone goes from 0.31 to 0.45 zoom -- units
 * about 1.44x -- while a desktop lands back on 0.46, where it already was.
 *
 * The geometry is shared by every player. Two people in the same match must be
 * on the same battlefield, so this cannot vary by device; only the camera does.
 *
 * The south lane sits further out than the north one. That asymmetry is
 * deliberate and it is about the HUD, not the map: the top band takes 156 units
 * of screen and the bottom band takes about 115, so the space left for the field
 * is not centred on it. Pushing the south lane down fills the room that is
 * actually there, and the camera frames content rather than the world's middle,
 * so the result still reads as centred.
 */
export const COMPACT_TWO_LANE_NORTH_PATH_NODES: LanePathNodeSpec[] = [
  { progress: 0.00, position: { x: 2120, y: 1980 } },
  { progress: 0.09, position: { x: 2300, y: 1749 } },
  { progress: 0.21, position: { x: 2636, y: 1650 } },
  { progress: 0.35, position: { x: 3140, y: 1610 } },
  { progress: 0.50, position: { x: 3728, y: 1610 } },
  { progress: 0.65, position: { x: 4256, y: 1634 } },
  { progress: 0.79, position: { x: 4652, y: 1683 } },
  { progress: 0.91, position: { x: 4892, y: 1749 } },
  { progress: 1.00, position: { x: 5000, y: 1980 } },
];

export const COMPACT_TWO_LANE_SOUTH_PATH_NODES: LanePathNodeSpec[] = [
  { progress: 0.00, position: { x: 2120, y: 1980 } },
  { progress: 0.09, position: { x: 2300, y: 2380 } },
  { progress: 0.21, position: { x: 2636, y: 2551 } },
  { progress: 0.35, position: { x: 3140, y: 2620 } },
  { progress: 0.50, position: { x: 3728, y: 2620 } },
  { progress: 0.65, position: { x: 4256, y: 2578 } },
  { progress: 0.79, position: { x: 4652, y: 2494 } },
  { progress: 0.91, position: { x: 4892, y: 2380 } },
  { progress: 1.00, position: { x: 5000, y: 1980 } },
];

const COMPACT_TWO_LANE_STRUCTURE_SOCKETS: StructureSocketSpec[] = [
  createStructureSocketForPath(NORTH_LANE_ID, COMPACT_TWO_LANE_NORTH_PATH_NODES, "north-capture-player", "capture-point", 0.18),
  createStructureSocketForPath(NORTH_LANE_ID, COMPACT_TWO_LANE_NORTH_PATH_NODES, "north-tower-player", "defense-tower", 0.38, { teamOwner: "player", linkedSocketId: "north-capture-player" }),
  createStructureSocketForPath(NORTH_LANE_ID, COMPACT_TWO_LANE_NORTH_PATH_NODES, "north-tower-enemy", "defense-tower", 0.62, { teamOwner: "enemy", linkedSocketId: "north-capture-enemy" }),
  createStructureSocketForPath(NORTH_LANE_ID, COMPACT_TWO_LANE_NORTH_PATH_NODES, "north-capture-enemy", "capture-point", 0.82),
  createStructureSocketForPath(SOUTH_LANE_ID, COMPACT_TWO_LANE_SOUTH_PATH_NODES, "south-capture-player", "capture-point", 0.18),
  createStructureSocketForPath(SOUTH_LANE_ID, COMPACT_TWO_LANE_SOUTH_PATH_NODES, "south-tower-player", "defense-tower", 0.38, { teamOwner: "player", linkedSocketId: "south-capture-player" }),
  createStructureSocketForPath(SOUTH_LANE_ID, COMPACT_TWO_LANE_SOUTH_PATH_NODES, "south-tower-enemy", "defense-tower", 0.62, { teamOwner: "enemy", linkedSocketId: "south-capture-enemy" }),
  createStructureSocketForPath(SOUTH_LANE_ID, COMPACT_TWO_LANE_SOUTH_PATH_NODES, "south-capture-enemy", "capture-point", 0.82),
];

export const COMPACT_TWO_LANE_MAP_SPEC: BattlefieldMapSpec = {
  schemaVersion: 2,
  id: "warcrest-two-lane-compact-v1",
  lanes: [
    { id: NORTH_LANE_ID, role: "north", path: COMPACT_TWO_LANE_NORTH_PATH_NODES },
    { id: SOUTH_LANE_ID, role: "south", path: COMPACT_TWO_LANE_SOUTH_PATH_NODES },
  ],
  terrainPatches: [
    ...createLaneTerrainPatchesForPath(
      NORTH_LANE_ID,
      COMPACT_TWO_LANE_NORTH_PATH_NODES,
      TWO_LANE_PATCH_ROWS,
      TWO_LANE_BANDS,
      "compact-two-lane-north-segment",
    ),
    ...createLaneTerrainPatchesForPath(
      SOUTH_LANE_ID,
      COMPACT_TWO_LANE_SOUTH_PATH_NODES,
      TWO_LANE_PATCH_ROWS,
      TWO_LANE_BANDS,
      "compact-two-lane-south-segment",
    ),
  ],
  structureSockets: COMPACT_TWO_LANE_STRUCTURE_SOCKETS,
  terrainProps: TWO_LANE_PROPS,
};

export const BATTLEFIELD_MAP_SPECS: readonly BattlefieldMapSpec[] = [
  LANE_BATTLEFIELD_MAP_SPEC,
  DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC,
  DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC,
  TWO_LANE_MAP_CANDIDATE_SPEC,
  COMPACT_TWO_LANE_MAP_SPEC,
];

// The wide original stays available by id for comparison.
export const DEFAULT_BATTLEFIELD_MAP_SPEC = COMPACT_TWO_LANE_MAP_SPEC;

export function getBattlefieldMapSpec(mapId?: string | null): BattlefieldMapSpec {
  return BATTLEFIELD_MAP_SPECS.find((spec) => spec.id === mapId) ?? DEFAULT_BATTLEFIELD_MAP_SPEC;
}
