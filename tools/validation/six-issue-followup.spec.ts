import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/six-issue-followup";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&seed=warcrest-six-issue-v1";

type Snapshot = {
  units: Array<{
    unitId: string;
    pose: string;
    attackAnimTime: number;
    attackTargetKind: "unit" | "structure";
  }>;
  activeProjectiles: Array<{ textureKey: string; x: number; y: number }>;
  engagement: { uniqueAttackers: number; battleUnits: number; currentlyAnimating: number };
  battlefield: {
    defenseTowers: Array<{ id: number; hp: number; maxHp: number }>;
  };
  verification: {
    terrain: {
      propGrounding: Array<{
        id: string;
        groundOriginY: number;
        shadow: { offsetY: number; widthScale: number; heightScale: number };
      }>;
    };
  };
};

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function openGame(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({ position: { x: box.width / 2, y: box.height * 0.9 } });
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

const snapshot = (page: import("@playwright/test").Page): Promise<Snapshot> => page.evaluate(() => (
  (window as unknown as { __gameDebug: Snapshot }).__gameDebug
));

test("melee structure damage lands on contact rather than at wind-up", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    (window as unknown as {
      __terrainPrototypeControl: { prepareStructureAttackProbe: (unitId: "stone_axeman") => void };
    }).__terrainPrototypeControl.prepareStructureAttackProbe("stone_axeman");
  });
  const hpBefore = (await snapshot(page)).battlefield.defenseTowers[1].hp;
  await page.waitForFunction(() => {
    const state = (window as unknown as { __gameDebug: Snapshot }).__gameDebug;
    return state.units[0]?.attackAnimTime > 0 && state.units[0]?.attackTargetKind === "structure";
  });
  await page.screenshot({ path: `${ARTIFACT_DIR}/axeman-structure-windup.png` });
  expect((await snapshot(page)).battlefield.defenseTowers[1].hp).toBe(hpBefore);

  await page.waitForFunction((before) => (
    (window as unknown as { __gameDebug: Snapshot }).__gameDebug.battlefield.defenseTowers[1].hp < before
  ), hpBefore);
  const contact = await snapshot(page);
  await page.screenshot({ path: `${ARTIFACT_DIR}/axeman-structure-contact.png` });
  expect(contact.battlefield.defenseTowers[1].hp).toBeLessThan(hpBefore);
  expect(contact.units[0].attackTargetKind).toBe("structure");

  await page.waitForTimeout(180);
  await page.screenshot({ path: `${ARTIFACT_DIR}/axeman-structure-recover.png` });
  writeFileSync(`${ARTIFACT_DIR}/melee-structure-timing.json`, JSON.stringify({
    hpBefore,
    hpAtContact: contact.battlefield.defenseTowers[1].hp,
    contactDelayMs: 240,
  }, null, 2));
});

test("ranged structure attack releases before projectile hit and HP loss", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    (window as unknown as {
      __terrainPrototypeControl: { prepareStructureAttackProbe: (unitId: "stone_slinger") => void };
    }).__terrainPrototypeControl.prepareStructureAttackProbe("stone_slinger");
  });
  const hpBefore = (await snapshot(page)).battlefield.defenseTowers[1].hp;
  await page.waitForFunction(() => (
    (window as unknown as { __gameDebug: Snapshot }).__gameDebug.activeProjectiles.length > 0
  ));
  const released = await snapshot(page);
  expect(released.battlefield.defenseTowers[1].hp).toBe(hpBefore);
  await page.screenshot({ path: `${ARTIFACT_DIR}/slinger-structure-release.png` });
  await page.waitForFunction((before) => (
    (window as unknown as { __gameDebug: Snapshot }).__gameDebug.battlefield.defenseTowers[1].hp < before
  ), hpBefore);
  const hit = await snapshot(page);
  await page.screenshot({ path: `${ARTIFACT_DIR}/slinger-structure-hit.png` });
  writeFileSync(`${ARTIFACT_DIR}/ranged-structure-timing.json`, JSON.stringify({
    hpBefore,
    hpAfter: hit.battlefield.defenseTowers[1].hp,
    projectileAtRelease: released.activeProjectiles,
  }, null, 2));
});

test("captures grounded rock tree and tower examples", async ({ page }) => {
  await openGame(page);
  const focusAndCapture = async (progress: number, fileName: string): Promise<void> => {
    await page.evaluate((value) => {
      (window as unknown as {
        __terrainPrototypeControl: { focusProgress: (progress: number) => void };
      }).__terrainPrototypeControl.focusProgress(value);
    }, progress);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${fileName}` });
  };
  await focusAndCapture(0.2, "grounding-rock-after.png");
  await focusAndCapture(0.32, "grounding-tree-after.png");
  await focusAndCapture(0.375, "grounding-tower-after.png");
  const grounding = (await snapshot(page)).verification.terrain.propGrounding;
  expect(grounding.every((prop) => prop.shadow.offsetY <= 3)).toBe(true);
  expect(grounding.every((prop) => prop.groundOriginY >= 0.884)).toBe(true);
  writeFileSync(`${ARTIFACT_DIR}/ground-anchor-profiles.json`, JSON.stringify(grounding, null, 2));
});

test("captures role-specific unit combat presentation sequences", async ({ page }) => {
  await openGame(page);
  const captureRole = async (
    role: "melee" | "ranged" | "support",
    unitId: "stone_axeman" | "stone_slinger" | "supply_wagon",
  ): Promise<void> => {
    await page.evaluate(({ selectedRole, selectedUnit }) => {
      const control = (window as unknown as {
        __terrainPrototypeControl: {
          focusAttackPair: (unitId: string, team: "player") => void;
          prepareSupportProbe: () => void;
          setPaused: (paused: boolean) => void;
          setAttackVisualPhase: (unitId: string, team: "player", phase: number) => void;
        };
      }).__terrainPrototypeControl;
      if (selectedRole === "support") control.prepareSupportProbe();
      else control.focusAttackPair(selectedUnit, "player");
      control.setPaused(true);
    }, { selectedRole: role, selectedUnit: unitId });
    for (const [label, phase] of [["windup", 0.2], ["contact", 0.55], ["recover", 0.84]] as const) {
      await page.evaluate(({ selectedUnit, selectedPhase }) => {
        (window as unknown as {
          __terrainPrototypeControl: {
            setAttackVisualPhase: (unitId: string, team: "player", phase: number) => void;
          };
        }).__terrainPrototypeControl.setAttackVisualPhase(selectedUnit, "player", selectedPhase);
      }, { selectedUnit: unitId, selectedPhase: phase });
      await page.screenshot({ path: `${ARTIFACT_DIR}/${role}-unit-${label}.png` });
    }
    await page.evaluate(() => {
      (window as unknown as {
        __terrainPrototypeControl: { setPaused: (paused: boolean) => void };
      }).__terrainPrototypeControl.setPaused(false);
    });
  };

  await captureRole("melee", "stone_axeman");
  await captureRole("ranged", "stone_slinger");
  await captureRole("support", "supply_wagon");
});

test("dense 12v12 battle routes rear units into reachable combat slots", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    (window as unknown as {
      __terrainPrototypeControl: {
        prepareOccupancyProbe: () => void;
        stepOccupancyProbe: (deltaSec: number, steps: number) => void;
      };
    }).__terrainPrototypeControl.prepareOccupancyProbe();
    (window as unknown as {
      __terrainPrototypeControl: { stepOccupancyProbe: (deltaSec: number, steps: number) => void };
    }).__terrainPrototypeControl.stepOccupancyProbe(0.05, 300);
  });
  await page.waitForTimeout(100);
  const result = await snapshot(page);
  await page.screenshot({ path: `${ARTIFACT_DIR}/occupancy-12v12-after.png` });
  writeFileSync(`${ARTIFACT_DIR}/occupancy-comparison.json`, JSON.stringify({
    beforeReachableSlotsPerTarget: 6,
    afterReachableSlotsPerTarget: 9,
    oldRules: { rowStep: 1, progressFronts: 2, friendlyGap: 0.013 },
    newRules: { rowStep: 1, progressFronts: 3, friendlyGap: 0.011, laneRowSpacing: 62 },
    result: result.engagement,
    units: result.units,
  }, null, 2));
  expect(result.engagement.battleUnits).toBe(24);
  expect(result.engagement.uniqueAttackers).toBeGreaterThanOrEqual(20);
});
