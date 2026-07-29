import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/day3-second-cycle-map-review";
const BASE_URL = "/game_project1/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&seed=warcrest-second-cycle-map-review";
const CANDIDATE_MAP_ID = "warcrest-day3-three-fronts-v1";

test.beforeAll(() => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
});

test.setTimeout(120_000);

interface ReviewSnapshot {
  battlefield: {
    controlPoints: Array<{ id: number; progress: number; owner: string }>;
    defenseTowers: Array<{ id: number; progress: number; owner: string }>;
  };
  engagement: {
    uniqueAttackers: number;
    battleUnits: number;
    currentlyAnimating: number;
  };
  verification: {
    terrain: {
      mapSpecId: string;
      propGrounding: Array<{ id: string }>;
    };
  };
}

async function clickLogical(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({
    position: { x: x * box.width / 1600, y: y * box.height / 900 },
    force: true,
  });
}

async function openGame(page: Page, mapId: string | null): Promise<void> {
  const url = mapId ? `${BASE_URL}&map=${mapId}` : BASE_URL;
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(url);
  await page.waitForTimeout(1_000);
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await clickLogical(page, 800, 805);
    await page.waitForTimeout(750);
    if (await page.evaluate(() => Boolean(
      (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
    ))) return;
  }
  throw new Error(`Map review probe did not initialize for ${mapId ?? "baseline"}`);
}

const snapshot = (page: Page): Promise<ReviewSnapshot> => page.evaluate(() => (
  (window as unknown as { __gameDebug: ReviewSnapshot }).__gameDebug
));

async function focusProgress(page: Page, progress: number): Promise<void> {
  await page.evaluate((nextProgress) => {
    (window as unknown as {
      __terrainPrototypeControl: { focusProgress: (progress: number) => void };
    }).__terrainPrototypeControl.focusProgress(nextProgress);
  }, progress);
  await page.waitForTimeout(180);
}

async function captureLiveReview(page: Page, prefix: string): Promise<ReviewSnapshot> {
  await focusProgress(page, 0.18);
  await page.screenshot({ path: `${ARTIFACT_DIR}/${prefix}-player-front-live.png` });

  await expect.poll(async () => (await snapshot(page)).engagement.uniqueAttackers, {
    timeout: 20_000,
  }).toBeGreaterThan(0);
  await focusProgress(page, 0.5);
  await page.screenshot({ path: `${ARTIFACT_DIR}/${prefix}-center-engaged.png` });

  await page.waitForTimeout(12_000);
  const end = await snapshot(page);
  await page.screenshot({ path: `${ARTIFACT_DIR}/${prefix}-center-after-wave.png` });
  return {
    ...end,
    engagement: {
      uniqueAttackers: end.engagement.uniqueAttackers,
      battleUnits: end.engagement.battleUnits,
      currentlyAnimating: end.engagement.currentlyAnimating,
    },
    battlefield: end.battlefield,
    verification: end.verification,
  };
}

test("captures baseline and three-fronts candidate during an actual first-wave battle", async ({ browser }) => {
  const baselinePage = await browser.newPage();
  await openGame(baselinePage, null);
  const baselineStart = await snapshot(baselinePage);
  const baselineEnd = await captureLiveReview(baselinePage, "baseline");
  await baselinePage.close();

  const candidatePage = await browser.newPage();
  await openGame(candidatePage, CANDIDATE_MAP_ID);
  const candidateStart = await snapshot(candidatePage);
  const candidateEnd = await captureLiveReview(candidatePage, "candidate");
  await candidatePage.close();

  expect(baselineStart.verification.terrain.mapSpecId).toBe("warcrest-full-lane-hybrid-v1");
  expect(candidateStart.verification.terrain.mapSpecId).toBe(CANDIDATE_MAP_ID);
  expect(candidateStart.verification.terrain.propGrounding.length).toBeGreaterThan(
    baselineStart.verification.terrain.propGrounding.length,
  );
  expect(candidateEnd.engagement.uniqueAttackers).toBeGreaterThan(0);

  writeFileSync(
    `${ARTIFACT_DIR}/review-summary.json`,
    JSON.stringify({
      baseline: {
        start: baselineStart,
        end: baselineEnd,
      },
      candidate: {
        start: candidateStart,
        end: candidateEnd,
      },
      reviewRule: "Do not promote automatically; compare live clutter/occlusion against baseline.",
    }, null, 2),
  );
});
