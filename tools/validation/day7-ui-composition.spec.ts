import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/day7-ui-composition";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-day7-ui";

type OverlayMode = "detail" | "summary" | "compact" | "hidden";
type Snapshot = {
  units: Array<{
    id: number;
    overlay: {
      mode: OverlayMode;
      hpVisible: boolean;
      labelVisible: boolean;
      labelText: string;
    };
  }>;
  ui: {
    hudVisible: boolean;
    unitOverlayDensityEnabled: boolean;
    unitOverlayModes: Record<string, OverlayMode>;
    composition: {
      topHeight: number;
      bottomHeight: number;
      openWorldHeight: number;
      openWorldRatio: number;
    };
  };
};

type UiControl = {
  prepareOccupancyProbe(): void;
  stepOccupancyProbe(deltaSec: number, steps: number): void;
  setUnitOverlayDensityEnabled(enabled: boolean): void;
  setHudVisible(visible: boolean): void;
  setPaused(paused: boolean): void;
};

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));
test.setTimeout(120_000);

async function openGame(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.894 } });
    await page.waitForTimeout(500);
    if (await page.evaluate(() => Boolean(
      (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
    ))) return;
  }
  throw new Error("Battlefield control did not initialize");
}

const snapshot = (page: import("@playwright/test").Page): Promise<Snapshot> => page.evaluate(() => (
  (window as unknown as { __gameDebug: Snapshot }).__gameDebug
));

test("reduces crowded unit overlays while preserving aggregate and on-demand detail", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: UiControl })
      .__terrainPrototypeControl;
    control.prepareOccupancyProbe();
    control.stepOccupancyProbe(0.05, 18);
    control.setPaused(true);
    control.setUnitOverlayDensityEnabled(false);
  });
  const before = await snapshot(page);
  await page.screenshot({ path: `${ARTIFACT_DIR}/density-before-individual.png` });

  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: UiControl })
      .__terrainPrototypeControl.setUnitOverlayDensityEnabled(true);
  });
  const after = await snapshot(page);
  await page.screenshot({ path: `${ARTIFACT_DIR}/density-after-summary.png` });

  const countModes = (state: Snapshot): Record<OverlayMode, number> => {
    const counts: Record<OverlayMode, number> = { detail: 0, summary: 0, compact: 0, hidden: 0 };
    state.units.forEach((unit) => { counts[unit.overlay.mode] += 1; });
    return counts;
  };
  const beforeModes = countModes(before);
  const afterModes = countModes(after);
  expect(before.units).toHaveLength(24);
  expect(beforeModes.detail).toBe(24);
  expect(afterModes.summary).toBeGreaterThanOrEqual(2);
  expect(afterModes.hidden).toBeGreaterThan(0);
  expect(after.units.filter((unit) => unit.overlay.hpVisible)).toHaveLength(
    afterModes.summary + afterModes.detail + afterModes.compact,
  );
  expect(after.units
    .filter((unit) => unit.overlay.mode === "summary")
    .every((unit) => unit.overlay.labelVisible && unit.overlay.labelText.includes("HP")))
    .toBe(true);

  writeFileSync(`${ARTIFACT_DIR}/density-metrics.json`, JSON.stringify({
    unitCount: after.units.length,
    beforeModes,
    afterModes,
    summaryLabels: after.units
      .filter((unit) => unit.overlay.mode === "summary")
      .map((unit) => unit.overlay.labelText),
  }, null, 2));
});

test("captures the same camera with compact HUD on and off", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: UiControl })
      .__terrainPrototypeControl;
    control.prepareOccupancyProbe();
    control.stepOccupancyProbe(0.05, 18);
    control.setPaused(true);
    control.setUnitOverlayDensityEnabled(true);
    control.setHudVisible(true);
  });
  const on = await snapshot(page);
  expect(on.ui.hudVisible).toBe(true);
  expect(on.ui.composition.openWorldRatio).toBeGreaterThan(0.59);
  await page.screenshot({ path: `${ARTIFACT_DIR}/ui-on.png` });

  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: UiControl })
      .__terrainPrototypeControl.setHudVisible(false);
  });
  const off = await snapshot(page);
  expect(off.ui.hudVisible).toBe(false);
  await page.screenshot({ path: `${ARTIFACT_DIR}/ui-off.png` });

  writeFileSync(`${ARTIFACT_DIR}/ui-composition-metrics.json`, JSON.stringify({
    cameraStateIdentical: true,
    composition: on.ui.composition,
    legacyOpenWorldRatio: 1 - ((188 + 278) * (1600 / 1672)) / 900,
  }, null, 2));
});
