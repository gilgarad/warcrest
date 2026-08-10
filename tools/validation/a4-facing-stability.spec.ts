import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { LaneBattleDebugSnapshot } from "../../src/scenes/laneBattleDebugSnapshot";

const ARTIFACT_DIR = "artifacts/a4-facing-stability";
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&seed=a4-facing-stability";

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function openGame(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await page.waitForTimeout(1_000);
  await canvas.click({ position: { x: 800 * box.width / 1600, y: 805 * box.height / 900 } });
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

const snapshot = (page: import("@playwright/test").Page): Promise<LaneBattleDebugSnapshot> => page.evaluate(() => (
  (window as unknown as { __gameDebug: LaneBattleDebugSnapshot }).__gameDebug
));

test("keeps melee facing stable during sustained combat instead of flipping every frame", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        prepareUnitAttackProbe: (unitId: "stone_axeman") => void;
        setPaused: (paused: boolean) => void;
      };
    }).__terrainPrototypeControl;
    control.prepareUnitAttackProbe("stone_axeman");
    control.setPaused(false);
  });

  await expect.poll(async () => {
    const unit = (await snapshot(page)).units.find((entry) => entry.team === "player" && entry.unitId === "stone_axeman");
    return unit?.attackAnimTime ?? 0;
  }, {
    timeout: 5_000,
  }).toBeGreaterThan(0);

  const timeline: Array<{
    tMs: number;
    facingDirection: string;
    motionX: number;
    motionY: number;
    attackFacingLockSec: number;
    combatFacingHoldSec: number;
    pose: string;
  }> = [];

  for (let index = 0; index < 18; index += 1) {
    const unit = (await snapshot(page)).units.find((entry) => entry.team === "player" && entry.unitId === "stone_axeman");
    if (!unit) throw new Error("player stone_axeman missing");
    timeline.push({
      tMs: index * 100,
      facingDirection: unit.facingDirection,
      motionX: unit.motion.x,
      motionY: unit.motion.y,
      attackFacingLockSec: unit.attackFacingLockSec,
      combatFacingHoldSec: unit.combatFacingHoldSec,
      pose: unit.pose,
    });
    if (index === 3) {
      await page.screenshot({ path: `${ARTIFACT_DIR}/engaged-early.png` });
    }
    if (index === 9) {
      await page.screenshot({ path: `${ARTIFACT_DIR}/engaged-mid.png` });
    }
    if (index === 15) {
      await page.screenshot({ path: `${ARTIFACT_DIR}/engaged-late.png` });
    }
    await page.waitForTimeout(100);
  }

  const steadyWindow = timeline.slice(6);
  const uniqueDirections = [...new Set(steadyWindow.map((entry) => entry.facingDirection))];
  writeFileSync(
    `${ARTIFACT_DIR}/facing-timeline.json`,
    JSON.stringify({
      steadyWindowUniqueDirections: uniqueDirections,
      timeline,
    }, null, 2),
  );

  expect(uniqueDirections).toHaveLength(1);
});
