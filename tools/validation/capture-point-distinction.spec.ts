import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/capture-point-distinction";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-capture-layout-v2";

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("keeps two buildable points separate from the defense tower collection", async ({ page }) => {
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
    (window as unknown as {
      __terrainPrototypeControl: { prepareCaptureLayoutProbe: () => void };
    }).__terrainPrototypeControl.prepareCaptureLayoutProbe();
  });
  const layout = await page.evaluate(() => (
    (window as unknown as { __gameDebug: Record<string, unknown> }).__gameDebug
  ));
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-two-buildable-points.png` });

  const controlPoints = (layout.battlefield as {
    controlPoints: Array<{ id: number; pointType: string; progress: number }>;
  }).controlPoints;
  expect(controlPoints).toHaveLength(2);
  expect(controlPoints.every((point) => point.pointType === "buildable")).toBe(true);
  expect(controlPoints.map((point) => point.progress)).toEqual([0.375, 0.767]);

  const towers = ((layout.verification as {
    presentation: { captureTowers: Array<{ id: number; worldX: number; worldY: number }> };
  }).presentation.captureTowers);
  const worldDistance = Math.hypot(
    towers[1].worldX - towers[0].worldX,
    towers[1].worldY - towers[0].worldY,
  );
  const screenDistance = worldDistance * 0.46;
  expect(screenDistance).toBeGreaterThan(500);

  await page.evaluate(() => {
    (window as unknown as {
      __terrainPrototypeControl: { prepareCapturePointInteraction: (id: number, hpRatio: number) => void };
    }).__terrainPrototypeControl.prepareCapturePointInteraction(1, 0.5);
  });
  const prepared = await page.evaluate(() => (
    (window as unknown as { __gameDebug: Record<string, unknown> }).__gameDebug
  ));
  const preparedPoint = (prepared.battlefield as { controlPoints: Array<{ labelWorldX: number; labelWorldY: number }> }).controlPoints[1];
  const camera = (prepared.verification as { camera: { centerX: number; centerY: number; zoom: number } }).camera;
  await clickLogical(
    800 + (preparedPoint.labelWorldX - camera.centerX) * camera.zoom,
    450 + (preparedPoint.labelWorldY - camera.centerY) * camera.zoom,
  );
  const clicked = await page.evaluate(() => (
    (window as unknown as { __gameDebug: Record<string, unknown> }).__gameDebug
  ));
  expect((clicked.ui as { selectedCapturePointId: number }).selectedCapturePointId).toBe(1);
  expect((clicked.ui as { visibleCaptureActions: string[] }).visibleCaptureActions).toEqual([
    "build-supply-depot",
    "build-mint",
  ]);
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-east-buildable-clicked.png` });

  writeFileSync(
    `${ARTIFACT_DIR}/layout-v2.json`,
    JSON.stringify({
      optionA: "remove-fixed-fortress",
      progressDistances: { beforeMinimum: 0.179, after: 0.392 },
      worldDistance,
      screenDistance,
      controlPoints,
      clickedUi: clicked.ui,
    }, null, 2),
  );
});
