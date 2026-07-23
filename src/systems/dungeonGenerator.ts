import { pickRandomForkKind } from "../data/encounterTypes";

export const TILE = { WALL: "#", FLOOR: "." } as const;

export interface TileCoord {
  x: number;
  y: number;
}

export interface DungeonResult {
  width: number;
  height: number;
  grid: string[][]; // grid[y][x] — "#" or "."
  playerStart: TileCoord;
  enemies: TileCoord[];
  captives: TileCoord[];
  exit: TileCoord;
}

const DIRS: TileCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 1 && y >= 1 && x < w - 1 && y < h - 1;
}

function carve(grid: string[][], x: number, y: number): void {
  grid[y][x] = TILE.FLOOR;
}

function carveRoom(grid: string[][], cx: number, cy: number, w: number, h: number, radius = 1): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (inBounds(x, y, w, h)) carve(grid, x, y);
    }
  }
}

function distance(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Walks a single corridor of `segmentLength`-tile straight-ish runs (a small
 * chance to turn each step, and only forced to turn at the map edge),
 * carving a small room every run. Guarantees reachability from `start` by
 * construction — it's one continuous path. Returns the room centers in
 * walk order (last one is the far end, used as the mission exit).
 */
function walkCorridor(
  grid: string[][],
  start: TileCoord,
  initialDir: TileCoord,
  steps: number,
  segmentLength: number,
  width: number,
  height: number
): TileCoord[] {
  const rooms: TileCoord[] = [];
  let x = start.x;
  let y = start.y;
  let dir = initialDir;

  for (let r = 0; r < steps; r++) {
    for (let step = 0; step < segmentLength; step++) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (!inBounds(nx, ny, width, height)) {
        dir = DIRS[Math.floor(Math.random() * DIRS.length)];
        continue;
      }
      x = nx;
      y = ny;
      carve(grid, x, y);
      if (Math.random() < 0.12) dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    }
    carveRoom(grid, x, y, width, height, 1);
    rooms.push({ x, y });
  }
  return rooms;
}

/**
 * Corridor-walk dungeon: one main path of room-stops, plus a couple of short
 * side branches peeling off it, so there are real forks to explore (not just
 * a straight line) without the room count exploding. Reachability is
 * guaranteed by construction (every room sits on a walked, carved path).
 * Enemy/rescue placement at each room reuses the same weighted pick used by
 * the old fork system (`pickRandomForkKind`), so that balance stays
 * data-driven in one place.
 */
export function generateDungeon(
  width = 34,
  height = 20,
  mainRoomCount = 5,
  segmentLength = 7
): DungeonResult {
  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(TILE.WALL));

  const startX = 2;
  const startY = Math.floor(height / 2);
  carveRoom(grid, startX, startY, width, height, 1);

  const mainRooms = walkCorridor(
    grid,
    { x: startX, y: startY },
    { x: 1, y: 0 },
    mainRoomCount,
    segmentLength,
    width,
    height
  );

  const branchRooms: TileCoord[] = [];
  const branchOrigins = [mainRooms[1], mainRooms[Math.floor(mainRooms.length / 2)]].filter(
    (r): r is TileCoord => Boolean(r)
  );
  for (const origin of branchOrigins) {
    const branchDir = DIRS[Math.floor(Math.random() * DIRS.length)];
    const rooms = walkCorridor(grid, origin, branchDir, 2, segmentLength, width, height);
    branchRooms.push(...rooms.filter((r) => distance(r, origin) > 1));
  }

  const exit = mainRooms[mainRooms.length - 1] ?? { x: startX, y: startY };
  const contentRooms = [...mainRooms.slice(0, -1), ...branchRooms];

  const enemies: TileCoord[] = [];
  const captives: TileCoord[] = [];
  for (const room of contentRooms) {
    const kind = pickRandomForkKind(); // reuses the combat/rescue weight table
    if (kind === "combat") enemies.push(room);
    else captives.push(room);
  }

  return {
    width,
    height,
    grid,
    playerStart: { x: startX, y: startY },
    enemies,
    captives,
    exit,
  };
}
