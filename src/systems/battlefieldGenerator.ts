export interface BattlefieldPoint {
  x: number;
  y: number;
}

export interface BattlefieldResult {
  width: number;
  height: number;
  laneTiles: BattlefieldPoint[];
  playerBaseTiles: BattlefieldPoint[];
  enemyBaseTiles: BattlefieldPoint[];
  capturePoints: BattlefieldPoint[];
  playerSpawn: BattlefieldPoint;
  enemySpawn: BattlefieldPoint;
  playerCore: BattlefieldPoint;
  enemyCore: BattlefieldPoint;
}

export function generateBattlefield(): BattlefieldResult {
  const laneY = 10;
  const width = 40;
  const height = 22;
  const laneTiles: BattlefieldPoint[] = [];
  const playerBaseTiles: BattlefieldPoint[] = [];
  const enemyBaseTiles: BattlefieldPoint[] = [];

  for (let x = 4; x <= 35; x++) {
    laneTiles.push({ x, y: laneY });
    laneTiles.push({ x, y: laneY - 1 });
    laneTiles.push({ x, y: laneY + 1 });
  }

  for (let x = 1; x <= 5; x++) {
    for (let y = laneY - 2; y <= laneY + 2; y++) playerBaseTiles.push({ x, y });
  }
  for (let x = 35; x <= 38; x++) {
    for (let y = laneY - 2; y <= laneY + 2; y++) enemyBaseTiles.push({ x, y });
  }

  return {
    width,
    height,
    laneTiles,
    playerBaseTiles,
    enemyBaseTiles,
    capturePoints: [
      { x: 12, y: laneY },
      { x: 20, y: laneY },
      { x: 28, y: laneY },
    ],
    playerSpawn: { x: 4, y: laneY },
    enemySpawn: { x: 35, y: laneY },
    playerCore: { x: 2, y: laneY },
    enemyCore: { x: 37, y: laneY },
  };
}
