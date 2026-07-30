import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { LaneBattleDebugSnapshot } from "../../src/scenes/laneBattleDebugSnapshot";

const ARTIFACT_DIR = "artifacts/capture-tower-separation";
const GAME_URL = "/game_project1/?terrain=world-surface&preset=balanced&scale=recommended&seed=capture-tower-separation-v1";

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("separates capture points and defense towers in data, position, and selection", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  const startGame = async (): Promise<void> => {
    await page.waitForTimeout(1_000);
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await canvas.click({ position: { x: 800 * box.width / 1600, y: 805 * box.height / 900 } });
      await page.waitForTimeout(750);
      if (await page.evaluate(() => Boolean(
        (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
      ))) return;
    }
    throw new Error("Capture-tower separation probe did not initialize");
  };
  await startGame().catch(async () => {
    await page.reload();
    await startGame().catch(() => {
      throw new Error(`Game did not initialize: ${runtimeErrors.join(" | ")}`);
    });
  });

  const snapshots: Array<{ side: string; captureProgress: number; towerProgress: number; selectedAfterClick: number | null }> = [];
  for (const id of [0, 1]) {
    const initial = await page.evaluate(() => (window as unknown as { __gameDebug: LaneBattleDebugSnapshot }).__gameDebug);
    const capture = initial.battlefield.controlPoints[id];
    const tower = initial.battlefield.defenseTowers[id];
    await page.evaluate((progress) => {
      (window as unknown as { __terrainPrototypeControl: { focusProgress: (value: number) => void } }).__terrainPrototypeControl.focusProgress(progress);
    }, tower.progress);
    await page.waitForTimeout(100);
    await page.evaluate((towerId) => {
      (window as unknown as {
        __terrainPrototypeControl: { selectDefenseTower: (id: number) => void };
      }).__terrainPrototypeControl.selectDefenseTower(towerId);
    }, id);
    await page.waitForTimeout(50);
    const clicked = await page.evaluate(() => (window as unknown as { __gameDebug: LaneBattleDebugSnapshot }).__gameDebug);
    expect(clicked.ui.selectedDefenseTowerId).toBe(id);
    expect(clicked.ui.selectedCapturePointId).toBeNull();
    await page.screenshot({ path: `${ARTIFACT_DIR}/${id === 0 ? "player" : "enemy"}-side-separated.png` });
    snapshots.push({
      side: id === 0 ? "player" : "enemy",
      captureProgress: capture.progress,
      towerProgress: tower.progress,
      selectedAfterClick: clicked.ui.selectedDefenseTowerId,
    });
  }

  expect(snapshots[0].towerProgress).toBeGreaterThan(snapshots[0].captureProgress);
  expect(snapshots[1].towerProgress).toBeLessThan(snapshots[1].captureProgress);
  const allProgresses = snapshots.flatMap((snapshot) => [snapshot.captureProgress, snapshot.towerProgress]);
  const pairwiseGaps = allProgresses.flatMap((progress, index) =>
    allProgresses.slice(index + 1).map((other) => Math.abs(progress - other))
  );
  expect(Math.min(...pairwiseGaps)).toBeGreaterThanOrEqual(0.15);
  writeFileSync(`${ARTIFACT_DIR}/coordinates.json`, JSON.stringify({
    rule: "tower is beyond its linked capture from own base; every structure pair has progress gap >= 0.15",
    minimumMeasuredGap: Math.min(...pairwiseGaps),
    pairwiseGaps,
    snapshots,
  }, null, 2));
});
