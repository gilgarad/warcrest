import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/golden-reference";
test.describe.configure({ timeout: 120_000 });

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("captures old central field and the Day 2 golden reference at the same viewport", async ({ browser }) => {
  const oldPage = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await oldPage.goto("/game_project1/?terrain=world-surface&preset=balanced&scale=recommended&seed=golden-reference-old");
  const oldCanvas = oldPage.locator("canvas");
  const startOldGame = async (): Promise<void> => {
    await oldPage.waitForTimeout(1_000);
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await oldCanvas.click({ position: { x: 800, y: 805 } });
      await oldPage.waitForTimeout(750);
      if (await oldPage.evaluate(() => Boolean(
        (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
      ))) return;
    }
    throw new Error("Old-field golden reference probe did not initialize");
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
  await newPage.goto("/game_project1/?golden=1");
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

test("captures atomic pose transitions without interpolation", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/game_project1/?golden=1&sequence=1");
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __goldenReferenceControl?: unknown }).__goldenReferenceControl,
  ));
  const sequence = ["idle", "walk-a", "walk-b", "attack", "idle"] as const;
  const snapshots: Array<{ pose: string; texture: string | null; interpolation: string }> = [];
  for (const [index, pose] of sequence.entries()) {
    await page.evaluate((nextPose) => {
      (window as unknown as {
        __goldenReferenceControl: { setPose: (pose: string) => void };
      }).__goldenReferenceControl.setPose(nextPose);
    }, pose);
    await page.waitForTimeout(80);
    const state = await page.evaluate(() => (
      window as unknown as {
        __goldenReferenceDebug: GoldenReferenceDebugSnapshot;
      }
    ).__goldenReferenceDebug.animationProbe);
    expect(state.currentPose).toBe(pose);
    expect(state.currentTexture).toContain(pose === "attack" ? "attack-v2" : pose.replace("-", "-"));
    expect(state.interpolation).toBe("none-atomic-texture-swap");
    await page.screenshot({
      path: `${ARTIFACT_DIR}/pose-transition-${index}-${pose}.png`,
    });
    snapshots.push({ pose, texture: state.currentTexture, interpolation: state.interpolation });
  }
  writeFileSync(`${ARTIFACT_DIR}/pose-transition-debug.json`, JSON.stringify({ sequence: snapshots }, null, 2));
});

interface GoldenReferenceDebugSnapshot {
  animationProbe: {
    currentPose: string | null;
    currentTexture: string | null;
    interpolation: string;
  };
}
