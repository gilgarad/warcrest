import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/bronze-spearman-fixes";
const GAME_URL = "/game_project1/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-bronze-spearman-fixes";

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
  expect(spearmen[0].pose.endsWith("-idle")).toBe(true);
  expect(spearmen[0].tint).toBe(0xffffff);
  await page.screenshot({ path: `${ARTIFACT_DIR}/a1-after-source-color.png` });
  writeFileSync(`${ARTIFACT_DIR}/a1-render-state.json`, JSON.stringify({ spearmen }, null, 2));
});

test("bronze spearman keeps one silhouette height through attack poses", async ({ page }) => {
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

  const sequence: Array<{ label: string; pose: string; cssVisibleHeight: number; cssFrameHeight: number }> = [];
  for (const [label, phase] of [["idle-before", 0], ["windup", 0.1], ["contact", 0.75], ["idle-after", 1]] as const) {
    await page.evaluate((nextPhase) => {
      (window as unknown as {
        __terrainPrototypeControl: { setAttackVisualPhase: (unitId: string, team: string, phase: number) => void };
      }).__terrainPrototypeControl.setAttackVisualPhase("bronze_spearman", "player", nextPhase);
    }, phase);
    const frame = await page.evaluate(() => {
      const snapshot = (window as unknown as {
        __gameDebug: {
          units: Array<{ unitId: string; pose: string }>;
          verification: { presentation: { sampledUnits: Array<{ unitId: string; cssVisibleHeight: number; cssFrameHeight: number }> } };
        };
      }).__gameDebug;
      const unit = snapshot.units.find((entry) => entry.unitId === "bronze_spearman");
      const presentation = snapshot.verification.presentation.sampledUnits
        .find((entry) => entry.unitId === "bronze_spearman");
      if (!unit || !presentation) throw new Error("Bronze spearman snapshot missing");
      return { pose: unit.pose, cssVisibleHeight: presentation.cssVisibleHeight, cssFrameHeight: presentation.cssFrameHeight };
    });
    sequence.push({ label, ...frame });
    await page.screenshot({ path: `${ARTIFACT_DIR}/a2-${label}.png` });
  }

  expect(sequence.map((entry) => entry.pose.endsWith("-idle") ? "idle" : "attack")).toEqual([
    "idle",
    "attack",
    "attack",
    "idle",
  ]);
  const visibleHeights = sequence.map((entry) => entry.cssVisibleHeight);
  expect(Math.max(...visibleHeights) - Math.min(...visibleHeights)).toBeLessThan(0.05);
  writeFileSync(`${ARTIFACT_DIR}/a2-attack-height-sequence.json`, JSON.stringify(sequence, null, 2));
});
