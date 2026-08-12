import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { LaneBattleDebugSnapshot, LaneBattleDebugUnitSnapshot } from "../../src/scenes/laneBattleDebugSnapshot";

const ARTIFACT_DIR = "artifacts/day7-5-unit-art";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&seed=warcrest-day7-5&autostart=1";
test.describe.configure({ timeout: 120_000 });

type AgeId = "stone" | "bronze" | "iron_early" | "iron_mid" | "iron_late";

const EXPECTED_ROSTERS: Record<AgeId, string[]> = {
  stone: ["stone_slinger", "stone_axeman", "stone_axeman", "supply_wagon"],
  bronze: ["stone_slinger", "bronze_swordsman", "bronze_spearman", "supply_wagon"],
  iron_early: ["stone_slinger", "archer", "iron_swordsman", "supply_wagon"],
  iron_mid: ["archer", "iron_swordsman", "iron_spearman", "supply_wagon"],
  iron_late: ["archer", "knight", "musketeer", "supply_wagon"],
};

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function openGame(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

test("all five age rosters render production unit art", async ({ page }) => {
  await openGame(page);
  const snapshots: Partial<Record<AgeId, LaneBattleDebugUnitSnapshot[]>> = {};

  for (const ageId of Object.keys(EXPECTED_ROSTERS) as AgeId[]) {
    await page.evaluate((age) => {
      const control = (window as unknown as {
        __terrainPrototypeControl: {
          prepareAgeWaveProbe: (value: AgeId) => void;
          setPaused: (paused: boolean) => void;
        };
      }).__terrainPrototypeControl;
      control.prepareAgeWaveProbe(age);
      control.setPaused(true);
    }, ageId);

    const snapshot = await page.evaluate(() => (
      (window as unknown as { __gameDebug: LaneBattleDebugSnapshot }).__gameDebug
    ));
    const playerUnits = snapshot.units.filter((unit) => unit.renderTexture && !unit.renderTexture.endsWith("-enemy"));
    expect(snapshot.player.ageId).toBe(ageId);
    expect(playerUnits.map((unit) => unit.unitId).sort()).toEqual([...EXPECTED_ROSTERS[ageId]].sort());
    expect(playerUnits.every((unit) => unit.pose.endsWith("-idle"))).toBe(true);
    expect(playerUnits.every((unit) => unit.renderTexture === unit.pose)).toBe(true);
    expect(playerUnits.every((unit) => !unit.renderTexture.includes("token"))).toBe(true);
    snapshots[ageId] = playerUnits;
    await page.screenshot({ path: `${ARTIFACT_DIR}/wave-${ageId}.png` });

    await page.evaluate(() => {
      (window as unknown as {
        __terrainPrototypeControl: { setPaused: (paused: boolean) => void };
      }).__terrainPrototypeControl.setPaused(false);
    });
  }

  writeFileSync(
    `${ARTIFACT_DIR}/five-age-wave-snapshots.json`,
    JSON.stringify(snapshots, null, 2),
  );
});
