import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { getWaveRoster } from "../../src/data/unitRosters";

const ARTIFACT_DIR = "artifacts/day8-regression";
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&seed=warcrest-day8&audioDebug=1&map=warcrest-full-lane-hybrid-v1&autostart=1";

type AgeId = "stone" | "bronze" | "iron_early" | "iron_mid" | "iron_late";

interface UnitSnapshot {
  id: number;
  team: "player" | "enemy";
  unitId: string;
  pose: string;
  renderTexture: string;
}

interface GameSnapshot {
  player: { ageId: AgeId; resources: Record<string, number> };
  units: UnitSnapshot[];
  battlefield: {
    controlPoints: Array<{
      id: number;
      owner: string;
      control: number;
      buildingId: string | null;
      buildingLevel: number;
      markerTexture: string;
    }>;
    defenseTowers: Array<{
      id: number;
      owner: string;
      built: boolean;
      hp: number;
      maxHp: number;
      buildRemainingSec: number;
    }>;
  };
  ui: { ageLabel: string; visibleCaptureActions: string[] };
}

interface AudioState {
  currentBgmId: string | null;
  bgmState: string | null;
  activeBgmVoices: number;
  recentEvents: Array<{ id: string; result: string }>;
}

/**
 * Derived from the roster table rather than copied from it. The hardcoded copy
 * fell out of date when `iron_early` swapped a slinger for a spearman, and the
 * spec then reported a roster "failure" that was really just a stale
 * expectation. What is worth asserting is that spawning honours the table —
 * so read the table.
 */
const rosterFor = (ageId: AgeId): string[] => {
  const roster = getWaveRoster(ageId);
  return [...roster.battleline, ...roster.support]
    .flatMap((entry) => Array.from({ length: entry.count }, () => entry.unitId as string))
    .sort();
};

const AGE_LABELS: Record<AgeId, string> = {
  stone: "시대 석기 시대",
  bronze: "시대 청동기",
  iron_early: "시대 초기 철기",
  iron_mid: "시대 중기 철기",
  iron_late: "시대 후기 철기",
};

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));
test.describe.configure({ timeout: 120_000 });

async function clickLogical(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({
    position: { x: x * box.width / 1600, y: y * box.height / 900 },
    force: true,
  });
}

interface HudButtonRect { x: number; y: number; width: number; height: number; visible: boolean }

/**
 * Clicks a HUD action button at wherever it actually is. Hardcoded button
 * coordinates are what made this spec rot: the HUD moved, the clicks landed on
 * empty canvas, and the failure surfaced as an unrelated assertion.
 */
async function clickHudAction(page: Page, actionId: string): Promise<void> {
  const rect = await page.evaluate((id) => (
    (window as unknown as {
      __terrainPrototypeControl: { getHudButtonLayout: () => Record<string, HudButtonRect> };
    }).__terrainPrototypeControl.getHudButtonLayout()[id]
  ), actionId);
  if (!rect) throw new Error(`HUD action "${actionId}" is not present`);
  if (!rect.visible) throw new Error(`HUD action "${actionId}" is not visible`);
  await clickLogical(page, rect.x, rect.y);
}

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  // `autostart=1` enters the battle once assets finish loading.
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

const snapshot = (page: Page): Promise<GameSnapshot> => page.evaluate(() => (
  (window as unknown as { __gameDebug: GameSnapshot }).__gameDebug
));

const audioState = (page: Page): Promise<AudioState> => page.evaluate(() => (
  (window as unknown as { __audioDebugControl: { getState: () => AudioState } })
    .__audioDebugControl.getState()
));

test("plays through all five ages using the real age-up and instant-wave buttons", async ({ page }) => {
  await openGame(page);
  const evidence: Partial<Record<AgeId, {
    ageLabel: string;
    units: UnitSnapshot[];
    transitionAudio?: AudioState;
  }>> = {};

  let current = await snapshot(page);
  let playerUnits = current.units.filter((unit) => unit.team === "player");
  expect(playerUnits.map((unit) => unit.unitId).sort()).toEqual(rosterFor("stone"));
  expect(current.ui.ageLabel).toBe(AGE_LABELS.stone);
  evidence.stone = { ageLabel: current.ui.ageLabel, units: playerUnits };
  await page.screenshot({ path: `${ARTIFACT_DIR}/age-stone.png` });

  for (const ageId of ["bronze", "iron_early", "iron_mid", "iron_late"] as const) {
    const previousMaxId = Math.max(...current.units.map((unit) => unit.id));
    await page.evaluate(() => {
      (window as unknown as {
        __terrainPrototypeControl: { fundDay8Regression: () => void };
      }).__terrainPrototypeControl.fundDay8Regression();
    });
    await clickHudAction(page, "age-up");
    await expect.poll(async () => (await snapshot(page)).player.ageId).toBe(ageId);
    const transitionAudio = await audioState(page);
    expect(transitionAudio.recentEvents.some(
      (event) => event.id === "sfx.ui.confirm" && event.result === "played",
    )).toBe(true);
    await page.evaluate(() => {
      (window as unknown as {
        __terrainPrototypeControl: { fundDay8Regression: () => void };
      }).__terrainPrototypeControl.fundDay8Regression();
    });
    await clickHudAction(page, "use-instant-wave");
    // Wait for the wave to actually exist rather than for a fixed span that a
    // slow frame can outlast.
    await expect.poll(async () => (await snapshot(page)).units.some(
      (unit) => unit.team === "player" && unit.id > previousMaxId,
    )).toBe(true);

    current = await snapshot(page);
    playerUnits = current.units.filter((unit) => unit.team === "player" && unit.id > previousMaxId);
    expect(playerUnits.map((unit) => unit.unitId).sort()).toEqual(rosterFor(ageId));
    expect(playerUnits.every((unit) => unit.renderTexture === unit.pose)).toBe(true);
    expect(playerUnits.every((unit) => !unit.renderTexture.includes("token"))).toBe(true);
    expect(current.ui.ageLabel).toBe(AGE_LABELS[ageId]);
    evidence[ageId] = { ageLabel: current.ui.ageLabel, units: playerUnits, transitionAudio };
    await page.evaluate(() => {
      (window as unknown as {
        __terrainPrototypeControl: { focusProgress: (progress: number) => void };
      }).__terrainPrototypeControl.focusProgress(0.14);
    });
    await page.screenshot({ path: `${ARTIFACT_DIR}/age-${ageId}.png` });
  }

  const audio = await audioState(page);
  // Gameplay BGM is chosen per age (`audioDirector.resolveBgmId`); the old
  // `bgm.battle.*` ids are legacy and no longer play during a battle.
  expect(audio.currentBgmId).toMatch(/^bgm\.age\./);
  expect(audio.activeBgmVoices).toBeGreaterThan(0);
  writeFileSync(`${ARTIFACT_DIR}/five-age-playthrough.json`, JSON.stringify({ evidence, audio }, null, 2));
});

test("builds dismantles rebuilds and captures structures through production interactions", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        fundDay8Regression: () => void;
        prepareCapturePointInteraction: (id: number) => void;
      };
    }).__terrainPrototypeControl;
    control.fundDay8Regression();
    control.prepareCapturePointInteraction(0);
  });
  expect((await snapshot(page)).ui.visibleCaptureActions).toContain("build-supply-depot");

  await clickHudAction(page, "build-supply-depot");
  // Poll instead of sleeping a fixed span: one frame is ~16ms on a fast
  // machine but far longer under software rendering, and a bare wait shorter
  // than a frame made these assertions fail for timing reasons alone.
  await expect.poll(async () => (await snapshot(page)).battlefield.controlPoints[0].buildingId).toBe("supply_depot");
  let current = await snapshot(page);
  expect(current.battlefield.controlPoints[0]).toMatchObject({
    owner: "player",
    buildingId: "supply_depot",
    buildingLevel: 1,
  });
  const buildAudio = await audioState(page);
  expect(buildAudio.recentEvents.some(
    (event) => event.id === "sfx.construction.start" && event.result === "played",
  )).toBe(true);
  await expect.poll(async () => (await audioState(page)).recentEvents.some(
    (event) => event.id === "sfx.construction.complete" && event.result === "played",
  )).toBe(true);
  const completedBuildAudio = await audioState(page);

  await clickHudAction(page, "dismantle");
  await expect.poll(async () => (await snapshot(page)).battlefield.controlPoints[0].buildingId).toBe(null);
  current = await snapshot(page);
  expect(current.battlefield.controlPoints[0]).toMatchObject({ buildingId: null, buildingLevel: 0 });

  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        prepareTowerStateProbe: (state: "ruins", owner: "player") => void;
        fundDay8Regression: () => void;
        selectDefenseTower: (id: number) => void;
        setPaused: (paused: boolean) => void;
      };
    }).__terrainPrototypeControl;
    control.prepareTowerStateProbe("ruins", "player");
    control.fundDay8Regression();
    control.selectDefenseTower(0);
    control.setPaused(false);
  });
  await clickHudAction(page, "rebuild-defense-tower");
  await expect.poll(async () => (await snapshot(page)).battlefield.defenseTowers[0].buildRemainingSec).toBeGreaterThan(0);
  current = await snapshot(page);
  expect(current.battlefield.defenseTowers[0].built).toBe(false);
  expect(current.battlefield.defenseTowers[0].buildRemainingSec).toBeGreaterThan(9);
  expect(current.battlefield.defenseTowers[0].buildRemainingSec).toBeLessThanOrEqual(10);
  await page.evaluate(() => {
    (window as unknown as {
      __terrainPrototypeControl: { advanceStructureProbe: (seconds: number) => void };
    }).__terrainPrototypeControl.advanceStructureProbe(10.1);
  });
  current = await snapshot(page);
  expect(current.battlefield.defenseTowers[0].built).toBe(true);
  expect(current.battlefield.defenseTowers[0].hp).toBe(current.battlefield.defenseTowers[0].maxHp);
  const rebuildAudio = await audioState(page);
  expect(rebuildAudio.recentEvents.some(
    (event) => event.id === "sfx.construction.complete" && event.result === "played",
  )).toBe(true);

  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        prepareCaptureOwnershipProbe: () => void;
        setPaused: (paused: boolean) => void;
        advanceStructureProbe: (seconds: number) => void;
      };
    }).__terrainPrototypeControl;
    control.prepareCaptureOwnershipProbe();
    control.setPaused(true);
    control.advanceStructureProbe(10);
    control.advanceStructureProbe(10);
    control.advanceStructureProbe(10);
  });
  current = await snapshot(page);
  expect(current.battlefield.controlPoints[0].owner).toBe("player");
  expect(current.battlefield.controlPoints[0].control).toBe(1);
  expect(current.battlefield.controlPoints[0].markerTexture).toBe("capture-marker");
  expect(current.battlefield.controlPoints[0].buildingLevel).toBeLessThan(4);

  const captureAudio = await audioState(page);
  expect(captureAudio.recentEvents.some(
    (event) => event.id === "sfx.capture.complete" && event.result === "played",
  )).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/structure-interactions.png` });
  writeFileSync(`${ARTIFACT_DIR}/structure-interactions.json`, JSON.stringify({
    current,
    audio: { build: buildAudio, completedBuild: completedBuildAudio, rebuild: rebuildAudio, capture: captureAudio },
  }, null, 2));
});
