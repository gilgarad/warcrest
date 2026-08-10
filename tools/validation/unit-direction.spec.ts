import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/unit-direction";
const GAME_URL = "/warcrest/?preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-direction-v2";

interface UnitSnapshot {
  unitId: string;
  team: string;
  facingX: -1 | 1;
  flipX: boolean;
  motion: { x: number; y: number };
  pose: string;
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("default terrain mode visibly mirrors three left and right movement frames", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({ position: { x: 800 * box.width / 1600, y: 805 * box.height / 900 } });
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
  await page.evaluate(() => (
    (window as unknown as { __terrainPrototypeControl: { setPaused: (paused: boolean) => void } })
      .__terrainPrototypeControl.setPaused(true)
  ));

  const records: Record<string, UnitSnapshot[]> = { left: [], right: [] };
  for (const [label, direction] of [["left", -1], ["right", 1]] as const) {
    await page.evaluate((nextDirection) => {
      const control = (window as unknown as {
        __terrainPrototypeControl: {
          prepareDirectionProbe: (direction: -1 | 1) => void;
        };
      }).__terrainPrototypeControl;
      control.prepareDirectionProbe(nextDirection);
    }, direction);
    for (let frame = 1; frame <= 3; frame += 1) {
      await page.evaluate(() => {
        (window as unknown as { __terrainPrototypeControl: { stepDirectionProbe: () => void } })
          .__terrainPrototypeControl.stepDirectionProbe();
      });
      const unit = await page.evaluate(() => {
        const units = (window as unknown as { __gameDebug: { units: UnitSnapshot[] } }).__gameDebug.units;
        const found = units.find((entry) => entry.unitId === "stone_axeman" && entry.team === "player");
        if (!found) throw new Error("Direction probe unit not found");
        return found;
      });
      records[label].push(unit);
      await page.screenshot({ path: `${ARTIFACT_DIR}/${label}-${frame}.png` });
    }
  }

  expect(records.left.every((frame) => frame.motion.x < 0 && frame.facingX === -1)).toBe(true);
  expect(records.right.every((frame) => frame.motion.x > 0 && frame.facingX === 1)).toBe(true);
  writeFileSync(`${ARTIFACT_DIR}/direction-frames.json`, JSON.stringify(records, null, 2));
});
