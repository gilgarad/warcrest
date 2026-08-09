import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/day5-structures";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&scenario=visual-validation&seed=warcrest-day5-structures&map=warcrest-full-lane-hybrid-v1";

type TowerState = "full" | "damaged" | "critical" | "ruins" | "construction";

interface Snapshot {
  battlefield: {
    controlPoints: Array<{ owner: string; markerTexture: string }>;
  };
  verification: {
    presentation: {
      captureTowers: Array<{ textureKey: string; cssVisibleHeight: number; originY: number }>;
    };
  };
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function openGame(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.894 } });
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

const snapshot = (page: import("@playwright/test").Page): Promise<Snapshot> => page.evaluate(() => (
  (window as unknown as { __gameDebug: Snapshot }).__gameDebug
));

test("renders all five tower states at one stable visible height", async ({ page }) => {
  await openGame(page);
  const results: Array<{ state: TowerState; textureKey: string; cssVisibleHeight: number }> = [];
  for (const [state, owner] of [
    ["full", "player"],
    ["damaged", "enemy"],
    ["critical", "player"],
    ["ruins", "enemy"],
    ["construction", "player"],
  ] as const) {
    await page.evaluate(({ nextState, nextOwner }) => {
      (window as unknown as {
        __terrainPrototypeControl: {
          prepareTowerStateProbe: (state: TowerState, owner: "player" | "enemy") => void;
        };
      }).__terrainPrototypeControl.prepareTowerStateProbe(nextState, nextOwner);
    }, { nextState: state, nextOwner: owner });
    const tower = (await snapshot(page)).verification.presentation.captureTowers[0];
    expect(tower.textureKey).toBe(`defense-tower-palisade-${state}${owner === "enemy" ? "-enemy" : ""}`);
    expect(tower.cssVisibleHeight).toBeCloseTo(144, 0);
    expect(tower.originY).toBe(0.875);
    results.push({ state, textureKey: tower.textureKey, cssVisibleHeight: tower.cssVisibleHeight });
    await page.screenshot({ path: `${ARTIFACT_DIR}/tower-${state}.png` });
  }
  writeFileSync(`${ARTIFACT_DIR}/tower-state-metrics.json`, JSON.stringify(results, null, 2));
});

test("renders neutral player and enemy capture marker palettes", async ({ page }) => {
  await openGame(page);
  const results: Array<{ owner: string; markerTexture: string }> = [];
  for (const [owner, textureKey] of [
    ["neutral", "capture-marker-neutral"],
    ["player", "capture-marker"],
    ["enemy", "capture-marker-enemy"],
  ] as const) {
    await page.evaluate((nextOwner) => {
      (window as unknown as {
        __terrainPrototypeControl: {
          prepareCaptureMarkerProbe: (owner: "neutral" | "player" | "enemy") => void;
        };
      }).__terrainPrototypeControl.prepareCaptureMarkerProbe(nextOwner);
    }, owner);
    const point = (await snapshot(page)).battlefield.controlPoints[0];
    expect(point.markerTexture).toBe(textureKey);
    results.push({ owner, markerTexture: point.markerTexture });
    await page.screenshot({ path: `${ARTIFACT_DIR}/capture-marker-${owner}.png` });
  }
  writeFileSync(`${ARTIFACT_DIR}/capture-marker-metrics.json`, JSON.stringify(results, null, 2));
});

test("captures both production bases and construction silhouette", async ({ page }) => {
  await openGame(page);
  for (const [label, progress] of [["player-base", 0], ["enemy-base", 1]] as const) {
    await page.evaluate((value) => {
      (window as unknown as {
        __terrainPrototypeControl: { focusProgress: (progress: number) => void };
      }).__terrainPrototypeControl.focusProgress(value);
    }, progress);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${label}.png` });
  }
  await page.evaluate(() => {
    (window as unknown as {
      __terrainPrototypeControl: { prepareTowerConstructionProbe: () => void };
    }).__terrainPrototypeControl.prepareTowerConstructionProbe();
  });
  await page.screenshot({ path: `${ARTIFACT_DIR}/tower-construction-review.png` });
});
