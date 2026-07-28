import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/bronze-spearman-fixes";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-bronze-spearman-fixes";

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("bronze spearman keeps source colors at gameplay scale", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({ position: { x: 800 * box.width / 1600, y: 805 * box.height / 900 } });
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: { prepareBronzeWaveProbe: () => void; setPaused: (paused: boolean) => void };
    }).__terrainPrototypeControl;
    control.prepareBronzeWaveProbe();
    control.setPaused(true);
  });
  const spearmen = await page.evaluate(() => (
    (window as unknown as {
      __gameDebug: { units: Array<{ unitId: string; pose: string; tint: number }> };
    }).__gameDebug.units.filter((unit) => unit.unitId === "bronze_spearman")
  ));
  expect(spearmen).toHaveLength(1);
  expect(spearmen[0]).toMatchObject({ pose: "bronze-spearman-idle", tint: 0xffffff });
  await page.screenshot({ path: `${ARTIFACT_DIR}/a1-after-source-color.png` });
  writeFileSync(`${ARTIFACT_DIR}/a1-render-state.json`, JSON.stringify({ spearmen }, null, 2));
});
