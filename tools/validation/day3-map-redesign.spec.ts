import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/day3-map";
const BASE_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-day3-map";
const CANDIDATE_MAP_ID = "warcrest-day3-three-fronts-v1";

test.setTimeout(90_000);

interface BattlefieldSnapshot {
  verification: {
    terrain: {
      mapSpecId: string;
      patchCount: number;
      structureSocketCount: number;
      propGrounding: Array<{ id: string }>;
    };
  };
}

test.beforeAll(() => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
});

async function clickCanvasLogical(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({ position: { x: x * box.width / 1600, y: y * box.height / 900 } });
}

async function startBattle(page: Page): Promise<void> {
  await clickCanvasLogical(page, 800, 805);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

async function captureProgress(page: Page, progress: number, screenshotPath: string): Promise<void> {
  await page.evaluate((nextProgress) => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        setPaused: (paused: boolean) => void;
        focusProgress: (progress: number) => void;
      };
    }).__terrainPrototypeControl;
    control.setPaused(true);
    control.focusProgress(nextProgress);
  }, progress);
  await page.waitForTimeout(180);
  await page.screenshot({ path: screenshotPath });
}

test("captures full-map redesign candidate against the legacy production map", async ({ browser }) => {
  const captureMap = async (mapId: string | null, prefix: string) => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const url = mapId ? `${BASE_URL}&map=${mapId}` : BASE_URL;
    await page.goto(url);
    await startBattle(page);
    await captureProgress(page, 0.18, `${ARTIFACT_DIR}/${prefix}-player-front.png`);
    await captureProgress(page, 0.5, `${ARTIFACT_DIR}/${prefix}-center.png`);
    await captureProgress(page, 0.82, `${ARTIFACT_DIR}/${prefix}-enemy-front.png`);
    const snapshot = await page.evaluate(() => (
      (window as unknown as { __gameDebug: BattlefieldSnapshot }).__gameDebug
    ));
    await page.close();
    return snapshot;
  };

  const baseline = await captureMap(null, "baseline");
  const candidate = await captureMap(CANDIDATE_MAP_ID, "candidate");

  expect(baseline.verification.terrain.mapSpecId).toBe("warcrest-full-lane-hybrid-v1");
  expect(candidate.verification.terrain.mapSpecId).toBe(CANDIDATE_MAP_ID);
  expect(candidate.verification.terrain.patchCount).toBe(8);
  expect(candidate.verification.terrain.propGrounding).toHaveLength(20);
  expect(candidate.verification.terrain.structureSocketCount).toBe(4);

  writeFileSync(
    `${ARTIFACT_DIR}/comparison.json`,
    JSON.stringify({ baseline, candidate }, null, 2),
  );
});
