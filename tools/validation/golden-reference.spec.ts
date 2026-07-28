import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/golden-reference";

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("captures old central field and the Day 2 golden reference at the same viewport", async ({ browser }) => {
  const oldPage = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await oldPage.goto("/?terrain=world-surface&preset=balanced&scale=recommended&seed=golden-reference-old");
  const oldCanvas = oldPage.locator("canvas");
  const startOldGame = async (): Promise<void> => {
    await oldPage.waitForTimeout(300);
    await oldCanvas.click({ position: { x: 800, y: 805 } });
    await oldPage.waitForFunction(() => Boolean(
      (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
    ), undefined, { timeout: 8_000 });
  };
  await startOldGame().catch(async () => {
    await oldPage.reload();
    await startOldGame();
  });
  await oldPage.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: { focusProgress: (progress: number) => void } })
      .__terrainPrototypeControl.focusProgress(0.6);
  });
  await oldPage.waitForTimeout(250);
  await oldPage.screenshot({ path: `${ARTIFACT_DIR}/old-oblique-central.png` });

  const newPage = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await newPage.goto("/?golden=1");
  await newPage.waitForFunction(() => Boolean(
    (window as unknown as { __goldenReferenceDebug?: { ready: boolean } }).__goldenReferenceDebug?.ready,
  ));
  const debug = await newPage.evaluate(() => (
    window as unknown as { __goldenReferenceDebug: { uniqueTerrainStates: number[]; assets: string[] } }
  ).__goldenReferenceDebug);
  expect(debug.assets).toHaveLength(6);
  expect(debug.uniqueTerrainStates.length).toBeGreaterThanOrEqual(4);
  await newPage.screenshot({ path: `${ARTIFACT_DIR}/new-topdown-golden.png` });
  writeFileSync(`${ARTIFACT_DIR}/golden-reference-debug.json`, JSON.stringify(debug, null, 2));

  await oldPage.close();
  await newPage.close();
});
