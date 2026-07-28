import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/capture-tower-separation";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&seed=capture-tower-separation-v1";

interface DebugSnapshot {
  battlefield: {
    controlPoints: Array<{ id: number; progress: number; owner: string }>;
    defenseTowers: Array<{ id: number; progress: number; owner: string; built: boolean }>;
  };
  ui: { selectedCapturePointId: number | null; selectedDefenseTowerId: number | null; visibleCaptureActions: string[] };
  verification: { camera: { scrollX: number; scrollY: number; zoom: number; centerX: number; centerY: number }; presentation: { captureTowers: Array<{ id: number; worldX: number; worldY: number }> } };
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("separates capture points and defense towers in data, position, and selection", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  await page.waitForTimeout(300);
  await canvas.click({ position: { x: 800, y: 805 } });
  await page.waitForFunction(() => Boolean((window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl), undefined, { timeout: 10_000 })
    .catch(async () => {
      await canvas.click({ position: { x: 800, y: 805 } });
      await page.waitForFunction(() => Boolean(
        (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
      ), undefined, { timeout: 10_000 }).catch(() => {
        throw new Error(`Game did not initialize: ${runtimeErrors.join(" | ")}`);
      });
    });

  const snapshots: Array<{ side: string; captureProgress: number; towerProgress: number; selectedAfterClick: number | null }> = [];
  for (const id of [0, 1]) {
    const initial = await page.evaluate(() => (window as unknown as { __gameDebug: DebugSnapshot }).__gameDebug);
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
    const clicked = await page.evaluate(() => (window as unknown as { __gameDebug: DebugSnapshot }).__gameDebug);
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
