import { expect, test, type Page } from "@playwright/test";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import type { LaneBattleDebugSnapshot } from "../../src/scenes/laneBattleDebugSnapshot";

const ARTIFACT_DIR = "artifacts/a-bugfix-review";
const BASE_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&seed=a-bugfix-review&autostart=1";

test.beforeAll(() => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
});

test.setTimeout(120_000);

async function openGame(page: Page, query: string): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`${BASE_URL}${query}`);
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

async function focusProgress(page: Page, progress: number): Promise<void> {
  await page.evaluate((nextProgress) => {
    (window as unknown as {
      __terrainPrototypeControl: { focusProgress: (progress: number) => void };
    }).__terrainPrototypeControl.focusProgress(nextProgress);
  }, progress);
  await page.waitForTimeout(200);
}

test("captures bugfix evidence for split-sprite cleanup, tower alignment, and tower targeting", async ({ browser }) => {
  cpSync(
    "artifacts/day3-second-cycle-map-review/candidate-center-engaged.png",
    `${ARTIFACT_DIR}/a1-before-candidate-center-engaged.png`,
    { force: true },
  );

  const candidatePage = await browser.newPage();
  await openGame(candidatePage, "&camera=central&map=warcrest-day3-three-fronts-v1");
  await expect.poll(async () => (await snapshot(candidatePage)).units.some((unit) => unit.attackAnimTime > 0), {
    timeout: 20_000,
  }).toBe(true);
  await focusProgress(candidatePage, 0.5);
  await candidatePage.screenshot({ path: `${ARTIFACT_DIR}/a1-after-candidate-center-engaged.png` });
  await candidatePage.close();

  const baselinePage = await browser.newPage();
  await openGame(baselinePage, "&camera=central&map=warcrest-full-lane-hybrid-v1");
  const initial = await snapshot(baselinePage);
  const playerTower = initial.battlefield.defenseTowers.find((tower) => tower.owner === "player");
  const enemyTower = initial.battlefield.defenseTowers.find((tower) => tower.owner === "enemy");
  const playerCapture = initial.battlefield.controlPoints.find((point) => point.id === 0);
  const enemyCapture = initial.battlefield.controlPoints.find((point) => point.id === 1);
  expect(playerTower).toBeTruthy();
  expect(enemyTower).toBeTruthy();
  expect(playerCapture).toBeTruthy();
  expect(enemyCapture).toBeTruthy();
  expect(playerTower!.progress).toBeGreaterThan(playerCapture!.progress);
  expect(playerTower!.progress).toBeLessThan(0.5);
  expect(enemyTower!.progress).toBeLessThan(enemyCapture!.progress);
  expect(enemyTower!.progress).toBeGreaterThan(0.5);

  await focusProgress(baselinePage, playerTower!.progress);
  await baselinePage.screenshot({ path: `${ARTIFACT_DIR}/a2-player-tower-own-side.png` });
  await baselinePage.evaluate(() => {
    (window as unknown as {
      __terrainPrototypeControl: { prepareStructureAttackProbe: (unitId: "stone_axeman") => void };
    }).__terrainPrototypeControl.prepareStructureAttackProbe("stone_axeman");
  });
  await baselinePage.waitForTimeout(250);
  await expect.poll(async () => {
    const state = await snapshot(baselinePage);
    return state.units.filter((unit) =>
      unit.team === "player"
      && unit.role === "battle"
      && unit.unitId === "stone_axeman"
      && unit.attackTargetKind === "structure",
    ).length;
  }, {
    timeout: 5_000,
  }).toBeGreaterThan(0);
  await baselinePage.screenshot({ path: `${ARTIFACT_DIR}/a3-enemy-melee-attacks-player-tower.png` });
  const towerAttackers = (await snapshot(baselinePage)).units
    .filter((unit) =>
      unit.team === "player"
      && unit.role === "battle"
      && unit.unitId === "stone_axeman"
      && unit.attackTargetKind === "structure"
    )
    .map((unit) => ({ id: unit.id, renderTexture: unit.renderTexture, progress: unit.progress }));
  writeFileSync(
    `${ARTIFACT_DIR}/a-bugfix-summary.json`,
    JSON.stringify({
      playerTower,
      enemyTower,
      playerCapture,
      enemyCapture,
      towerAttackers,
    }, null, 2),
  );
  await baselinePage.close();
});
