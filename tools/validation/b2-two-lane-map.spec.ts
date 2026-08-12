import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { LaneBattleDebugSnapshot } from "../../src/scenes/laneBattleDebugSnapshot";

const ARTIFACT_DIR = "artifacts/b2-two-lane-map";
const BASE_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&seed=b2-two-lane-map&autostart=1";
const CANDIDATE_MAP_ID = "warcrest-two-lane-v1";
const LEGACY_MAP_ID = "warcrest-full-lane-hybrid-v1";

test.beforeAll(() => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
});

test.setTimeout(120_000);

async function openGame(page: Page, mapId: string | null): Promise<void> {
  const url = mapId ? `${BASE_URL}&map=${mapId}` : BASE_URL;
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(url);
  await page.waitForTimeout(1_000);
  // `autostart=1` enters the battle once assets finish loading; a cold
  // load outlasts any fixed polling budget.
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

const snapshot = (page: Page): Promise<LaneBattleDebugSnapshot> => page.evaluate(() => (
  (window as unknown as { __gameDebug: LaneBattleDebugSnapshot }).__gameDebug
));

async function focusLane(page: Page, laneId: string, progress: number): Promise<void> {
  await page.evaluate(({ nextLaneId, nextProgress }) => {
    (window as unknown as {
      __terrainPrototypeControl: { focusLaneProgress: (laneId: string, progress: number) => void };
    }).__terrainPrototypeControl.focusLaneProgress(nextLaneId, nextProgress);
  }, { nextLaneId: laneId, nextProgress: progress });
  await page.waitForTimeout(220);
}

test("keeps the two-lane map as default and leaves the legacy full-lane map switchable", async ({ browser }) => {
  const baselinePage = await browser.newPage();
  await openGame(baselinePage, null);
  const baseline = await snapshot(baselinePage);
  expect(baseline.verification.terrain.mapSpecId).toBe(CANDIDATE_MAP_ID);
  await baselinePage.screenshot({ path: `${ARTIFACT_DIR}/baseline-default-map.png` });

  const candidatePage = await browser.newPage();
  await openGame(candidatePage, LEGACY_MAP_ID);
  const initial = await snapshot(candidatePage);

  expect(initial.verification.terrain.mapSpecId).toBe(LEGACY_MAP_ID);
  expect(initial.battlefield.lanes).toHaveLength(1);
  expect(initial.battlefield.controlPoints).toHaveLength(2);
  expect(initial.battlefield.defenseTowers).toHaveLength(2);

  const lanes = baseline.battlefield.lanes;
  const northLane = lanes.find((lane) => lane.id === "north");
  const southLane = lanes.find((lane) => lane.id === "south");
  expect(northLane).toBeTruthy();
  expect(southLane).toBeTruthy();

  const playerTowers = baseline.battlefield.defenseTowers.filter((tower) => tower.owner === "player");
  const enemyTowers = baseline.battlefield.defenseTowers.filter((tower) => tower.owner === "enemy");
  expect(playerTowers).toHaveLength(2);
  expect(enemyTowers).toHaveLength(2);
  playerTowers.forEach((tower) => expect(tower.progress).toBeLessThan(0.5));
  enemyTowers.forEach((tower) => expect(tower.progress).toBeGreaterThan(0.5));

  await expect.poll(async () => {
    const state = await snapshot(baselinePage);
    const playerBattleUnits = state.units.filter((unit) => unit.team === "player" && unit.role === "battle");
    return new Set(playerBattleUnits.map((unit) => unit.laneId)).size;
  }, {
    timeout: 12_000,
  }).toBe(2);

  await focusLane(baselinePage, "north", 0.18);
  await baselinePage.screenshot({ path: `${ARTIFACT_DIR}/candidate-north-player-front.png` });
  await focusLane(baselinePage, "south", 0.18);
  await baselinePage.screenshot({ path: `${ARTIFACT_DIR}/candidate-south-player-front.png` });

  await expect.poll(async () => (await snapshot(baselinePage)).engagement.uniqueAttackers, {
    timeout: 20_000,
  }).toBeGreaterThan(0);

  await focusLane(baselinePage, "north", 0.5);
  await baselinePage.screenshot({ path: `${ARTIFACT_DIR}/candidate-north-center-engaged.png` });
  await focusLane(baselinePage, "south", 0.5);
  await baselinePage.screenshot({ path: `${ARTIFACT_DIR}/candidate-south-center-engaged.png` });

  const engaged = await snapshot(baselinePage);
  const laneUnitCounts = engaged.units.reduce<Record<string, { player: number; enemy: number }>>((acc, unit) => {
    const lane = acc[unit.laneId] ?? { player: 0, enemy: 0 };
    lane[unit.team] += 1;
    acc[unit.laneId] = lane;
    return acc;
  }, {});

  writeFileSync(
    `${ARTIFACT_DIR}/two-lane-summary.json`,
    JSON.stringify({
      baselineMap: baseline.verification.terrain.mapSpecId,
      candidateMap: initial.verification.terrain.mapSpecId,
      lanes,
      laneUnitCounts,
      controlPoints: engaged.battlefield.controlPoints.map((point) => ({
        id: point.id,
        laneId: point.laneId,
        owner: point.owner,
        progress: point.progress,
        worldX: point.worldX,
        worldY: point.worldY,
      })),
      defenseTowers: engaged.battlefield.defenseTowers.map((tower) => ({
        id: tower.id,
        laneId: tower.laneId,
        owner: tower.owner,
        progress: tower.progress,
        built: tower.built,
      })),
      engagement: engaged.engagement,
    }, null, 2),
  );

  await baselinePage.close();
  await candidatePage.close();
});
