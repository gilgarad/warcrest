import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/support-mana";
const GAME_URL = "/?terrain=prototype-v2&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-support-mana-v1";

type UnitSnapshot = {
  unitId: string;
  team: string;
  hp: number;
  manaCurrent: number;
  manaMax: number;
  healPower: number;
};

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("captures support mana burst, depletion, and recovery", async ({ page }) => {
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
      __terrainPrototypeControl: {
        setPaused: (paused: boolean) => void;
        prepareSupportProbe: () => void;
      };
    }).__terrainPrototypeControl;
    control.setPaused(true);
    control.prepareSupportProbe();
  });

  const snapshot = async (): Promise<UnitSnapshot[]> => page.evaluate(() => (
    (window as unknown as { __gameDebug: { units: UnitSnapshot[] } }).__gameDebug.units
  ));
  const support = (units: UnitSnapshot[]): UnitSnapshot => {
    const found = units.find((unit) => unit.team === "player" && unit.unitId === "supply_wagon");
    if (!found) throw new Error("Support unit not found");
    return found;
  };
  const step = (seconds: number): Promise<void> => page.evaluate((deltaSec) => {
    (window as unknown as {
      __terrainPrototypeControl: { stepSupportProbe: (stepSec: number) => void };
    }).__terrainPrototypeControl.stepSupportProbe(deltaSec);
  }, seconds);

  const initial = await snapshot();
  await page.screenshot({ path: `${ARTIFACT_DIR}/01-full-mana.png` });
  await step(0.01);
  await step(1.2);
  await step(1.2);
  const depleted = await snapshot();
  await page.screenshot({ path: `${ARTIFACT_DIR}/02-depleted-after-three-heals.png` });
  await step(2.0);
  const waiting = await snapshot();
  await page.screenshot({ path: `${ARTIFACT_DIR}/03-waiting-for-mana.png` });
  await step(0.4);
  const recoveredCast = await snapshot();
  await page.screenshot({ path: `${ARTIFACT_DIR}/04-recovered-cast.png` });

  expect(support(initial).manaCurrent).toBe(18);
  expect(support(depleted).manaCurrent).toBeLessThan(4);
  expect(support(waiting).manaCurrent).toBeGreaterThan(support(depleted).manaCurrent);
  expect(support(waiting).manaCurrent).toBeLessThan(6);
  expect(support(recoveredCast).manaCurrent).toBeLessThan(support(waiting).manaCurrent);
  expect(support(initial).healPower).toBe(4);

  writeFileSync(
    `${ARTIFACT_DIR}/support-mana-timeline.json`,
    JSON.stringify({ initial, depleted, waiting, recoveredCast }, null, 2),
  );
});
