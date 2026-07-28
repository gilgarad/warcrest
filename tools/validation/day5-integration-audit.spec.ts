import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/day5-integration-audit";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-top-down-phase1-before";

type AuditLayer = "ground" | "props" | "units" | "combat";

type AuditControl = {
  setPaused(paused: boolean): void;
  setVisualAuditLayer(layer: AuditLayer): void;
  prepareVisualAuditCombat(): void;
  stepVisualAuditCombat(deltaSec: number): void;
  snapshot(): Record<string, unknown>;
};

async function enterBattlefield(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.894 } });
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: AuditControl })
      .__terrainPrototypeControl.setPaused(true);
  });
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));
test.setTimeout(120_000);

test("captures the four integrated production visual layers", async ({ page }) => {
  const layerMetrics: Record<string, unknown> = {};
  for (const layer of ["ground", "props", "units"] as const) {
    await enterBattlefield(page);
    layerMetrics[layer] = await page.evaluate((nextLayer) => {
      const control = (window as unknown as { __terrainPrototypeControl: AuditControl })
        .__terrainPrototypeControl;
      control.setVisualAuditLayer(nextLayer);
      return control.snapshot();
    }, layer);
    await page.waitForTimeout(80);
    await page.screenshot({ path: `${ARTIFACT_DIR}/after-${layer}.png` });
  }

  await enterBattlefield(page);
  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: AuditControl })
      .__terrainPrototypeControl;
    control.prepareVisualAuditCombat();
    control.setVisualAuditLayer("combat");
  });
  const combatFrames: Record<string, unknown>[] = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const snapshot = await page.evaluate(() => {
      const control = (window as unknown as { __terrainPrototypeControl: AuditControl })
        .__terrainPrototypeControl;
      control.stepVisualAuditCombat(0.06);
      return control.snapshot();
    });
    combatFrames.push(snapshot);
    await page.screenshot({
      path: `${ARTIFACT_DIR}/after-combat-${String(frame + 1).padStart(2, "0")}.png`,
    });
  }

  const finalFrame = combatFrames[combatFrames.length - 1];
  const finalUnits = Array.isArray(finalFrame?.units)
    ? finalFrame.units as unknown[]
    : [];
  expect(finalUnits).toHaveLength(2);
  writeFileSync(`${ARTIFACT_DIR}/audit-snapshots.json`, JSON.stringify({
    layerUnitCounts: Object.fromEntries(Object.entries(layerMetrics).map(([layer, snapshot]) => [
      layer,
      Array.isArray((snapshot as { units?: unknown[] }).units)
        ? (snapshot as { units: unknown[] }).units.length
        : 0,
    ])),
    combatFrameCount: combatFrames.length,
    finalCombatUnitCount: finalUnits.length,
  }, null, 2));
});
