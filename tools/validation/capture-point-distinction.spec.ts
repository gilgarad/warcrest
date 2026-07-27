import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/capture-point-distinction";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-capture-distinction-v1";

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("fixed fortress is visually distinct and exposes only fortress maintenance on actual click", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  const clickLogical = (x: number, y: number): Promise<void> => canvas.click({
    position: { x: x * box.width / 1600, y: y * box.height / 900 },
  });
  await clickLogical(800, 805);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        selectCapturePoint: (id: number) => void;
        prepareCapturePointInteraction: (id: number, hpRatio: number) => void;
      };
    }).__terrainPrototypeControl;
    control.selectCapturePoint(0);
    control.prepareCapturePointInteraction(1, 0.5);
  });
  await clickLogical(800, 450);
  const fixed = await page.evaluate(() => (
    (window as unknown as { __gameDebug: Record<string, unknown> }).__gameDebug
  ));
  await page.screenshot({ path: `${ARTIFACT_DIR}/fixed-fortress-clicked.png` });
  writeFileSync(`${ARTIFACT_DIR}/fixed-debug.json`, JSON.stringify(fixed, null, 2));
  expect((fixed.ui as { selectedCapturePointId: number }).selectedCapturePointId).toBe(1);
  expect((fixed.ui as { visibleCaptureActions: string[] }).visibleCaptureActions).toEqual(["repair-fortress"]);
  const fixedTowers = ((fixed.verification as { presentation: { captureTowers: Array<Record<string, unknown>> } })
    .presentation.captureTowers);
  expect(fixedTowers.find((tower) => tower.id === 1)?.textureKey).toBe("fixed-fortress-v1");

  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        selectCapturePoint: (id: number) => void;
        prepareCapturePointInteraction: (id: number, hpRatio: number) => void;
      };
    }).__terrainPrototypeControl;
    control.selectCapturePoint(1);
    control.prepareCapturePointInteraction(0, 1);
  });
  await clickLogical(800, 450);
  const buildable = await page.evaluate(() => (
    (window as unknown as { __gameDebug: Record<string, unknown> }).__gameDebug
  ));
  expect((buildable.ui as { selectedCapturePointId: number }).selectedCapturePointId).toBe(0);
  expect((buildable.ui as { visibleCaptureActions: string[] }).visibleCaptureActions).toEqual([
    "build-supply-depot",
    "build-mint",
  ]);
  await page.screenshot({ path: `${ARTIFACT_DIR}/buildable-point-clicked.png` });

  const towerMetrics = fixedTowers.map((tower) => ({
    id: tower.id as number,
    pointType: tower.pointType as string,
    x: tower.worldX as number,
    y: tower.worldY as number,
    textureKey: tower.textureKey as string,
  }));
  const screenDistances = towerMetrics.slice(0, -1).map((tower, index) => {
    const next = towerMetrics[index + 1];
    return {
      pair: [tower.id, next.id],
      world: Math.hypot(next.x - tower.x, next.y - tower.y),
      screenAtDefaultZoom: Math.hypot(next.x - tower.x, next.y - tower.y) * 0.46,
    };
  });
  expect(Math.min(...screenDistances.map((entry) => entry.screenAtDefaultZoom))).toBeGreaterThan(400);
  writeFileSync(
    `${ARTIFACT_DIR}/interaction-and-distance.json`,
    JSON.stringify({ towerMetrics, screenDistances, fixedUi: fixed.ui, buildableUi: buildable.ui }, null, 2),
  );
});
