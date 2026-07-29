import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/day2-triple-checkpoint";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-day2-triple&audioDebug=1";
const MAP_CANDIDATE_ID = "warcrest-day2-player-front-v1";

interface GoldenDirectionProbe {
  currentDirection: string;
  currentPose: string;
  currentTexture: string | null;
}

interface ArrangementMeasurement {
  assetId: string;
  durationMs: number;
  layers: Array<{ id: string; rms: number; peak: number }>;
}

interface AudioState {
  currentBgmId: string | null;
  bgmState: string | null;
  activeBgmVoices: number;
  contextState: string;
}

interface TerrainSnapshot {
  verification: {
    terrain: {
      mapSpecId: string;
      patchCount: number;
      structureSocketCount: number;
    };
  };
  battlefield: {
    controlPoints: Array<{ id: number; progress: number }>;
    defenseTowers: Array<{ id: number; progress: number }>;
  };
}

test.beforeAll(() => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  mkdirSync(`${ARTIFACT_DIR}/bronze-spearman-8dir`, { recursive: true });
  mkdirSync(`${ARTIFACT_DIR}/audio`, { recursive: true });
  mkdirSync(`${ARTIFACT_DIR}/map`, { recursive: true });
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

async function annotateAudioState(page: Page, title: string, state: AudioState): Promise<void> {
  await page.evaluate(({ nextTitle, nextState }) => {
    let note = document.getElementById("day2-audio-state-note");
    if (!note) {
      note = document.createElement("div");
      note.id = "day2-audio-state-note";
      Object.assign(note.style, {
        position: "fixed",
        right: "18px",
        bottom: "18px",
        zIndex: "99999",
        padding: "10px 12px",
        background: "rgba(9, 13, 18, 0.9)",
        color: "#f4e2ab",
        border: "1px solid rgba(212, 168, 89, 0.8)",
        fontFamily: "monospace",
        fontSize: "14px",
        lineHeight: "1.4",
        whiteSpace: "pre",
      });
      document.body.appendChild(note);
    }
    note.textContent = `${nextTitle}\n${nextState.bgmState} | ${nextState.currentBgmId}\nvoices ${nextState.activeBgmVoices}`;
  }, { nextTitle: title, nextState: state });
}

test("captures bronze spearman 8-direction turnaround using the new directional registry", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?golden=1&directions=1");
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __goldenDirectionControl?: unknown }).__goldenDirectionControl,
  ));

  const directions = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
  const records: GoldenDirectionProbe[] = [];
  for (const direction of directions) {
    await page.evaluate((nextDirection) => {
      (window as unknown as {
        __goldenDirectionControl: {
          setDirection: (direction: string) => void;
          setPose: (pose: string) => void;
        };
      }).__goldenDirectionControl.setDirection(nextDirection);
      (window as unknown as {
        __goldenDirectionControl: {
          setDirection: (direction: string) => void;
          setPose: (pose: string) => void;
        };
      }).__goldenDirectionControl.setPose("idle");
    }, direction);
    await page.waitForTimeout(80);
    const probe = await page.evaluate(() => (
      (window as unknown as {
        __goldenReferenceDebug: { directionProbe: GoldenDirectionProbe };
      }).__goldenReferenceDebug.directionProbe
    ));
    expect(probe.currentDirection).toBe(direction);
    expect(probe.currentPose).toBe("idle");
    expect(probe.currentTexture).toContain(`bronze-spearman-${direction}-idle`);
    records.push(probe);
    await page.screenshot({ path: `${ARTIFACT_DIR}/bronze-spearman-8dir/${direction}.png` });
  }

  writeFileSync(
    `${ARTIFACT_DIR}/bronze-spearman-8dir/direction-sequence.json`,
    JSON.stringify(records, null, 2),
  );
});

test("measures the layered battle-low arrangement and captures preparation -> battle-low transition", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  await startBattle(page);
  const arrangement = await page.evaluate(() => (
    (window as unknown as {
      __audioDebugControl: {
        measureArrangement: (assetId: string, durationMs: number) => Promise<ArrangementMeasurement | null>;
      };
    }).__audioDebugControl.measureArrangement("bgm.battle.low", 8000)
  ));
  expect(arrangement).not.toBeNull();
  expect(arrangement?.mix.rms ?? 0).toBeGreaterThan(0.01);
  for (const layerId of ["percussion", "bass", "harmony", "lowColor", "lead"] as const) {
    expect(arrangement?.layers[layerId]?.rms ?? 0).toBeGreaterThan(0.001);
  }
  expect(arrangement?.mix.peak ?? 0).toBeLessThan(0.95);
  writeFileSync(`${ARTIFACT_DIR}/audio/battle-low-arrangement.json`, JSON.stringify(arrangement, null, 2));

  await page.evaluate(() => (
    (window as unknown as {
      __terrainPrototypeControl: { setPaused: (paused: boolean) => void };
    }).__terrainPrototypeControl.setPaused(true)
  ));
  await page.evaluate(() => (
    (window as unknown as { __audioDebugControl: { setState: (state: string) => void } })
      .__audioDebugControl.setState("preparation")
  ));
  await page.waitForTimeout(180);
  const preparationState = await page.evaluate(() => (
    (window as unknown as { __audioDebugControl: { getState: () => AudioState } })
      .__audioDebugControl.getState()
  ));
  expect(preparationState.bgmState).toBe("preparation");
  await annotateAudioState(page, "PREPARATION", preparationState);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audio/in-game-preparation.png` });

  await page.evaluate(() => (
    (window as unknown as { __audioDebugControl: { setState: (state: string) => void } })
      .__audioDebugControl.setState("battle-low")
  ));
  await page.waitForTimeout(180);
  const battleLowState = await page.evaluate(() => (
    (window as unknown as { __audioDebugControl: { getState: () => AudioState } })
      .__audioDebugControl.getState()
  ));
  expect(battleLowState.bgmState).toBe("battle-low");
  expect(battleLowState.currentBgmId).toBe("bgm.battle.low");
  expect(battleLowState.activeBgmVoices).toBeGreaterThan(0);
  await annotateAudioState(page, "BATTLE LOW", battleLowState);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audio/in-game-battle-low.png` });
  writeFileSync(
    `${ARTIFACT_DIR}/audio/in-game-transition.json`,
    JSON.stringify({ preparationState, battleLowState }, null, 2),
  );
});

test("captures the player-front map candidate as a switchable data-only alternative", async ({ browser }) => {
  const capture = async (mapId: string | null, name: string): Promise<TerrainSnapshot> => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const url = mapId ? `${GAME_URL}&map=${mapId}` : GAME_URL;
    await page.goto(url);
    await startBattle(page);
    await page.evaluate(() => {
      const control = (window as unknown as {
        __terrainPrototypeControl: {
          setPaused: (paused: boolean) => void;
          focusProgress: (progress: number) => void;
        };
      }).__terrainPrototypeControl;
      control.setPaused(true);
      control.focusProgress(0.2);
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${ARTIFACT_DIR}/map/${name}.png` });
    const snapshot = await page.evaluate(() => (
      (window as unknown as { __gameDebug: TerrainSnapshot }).__gameDebug
    ));
    await page.close();
    return snapshot;
  };

  const baseline = await capture(null, "existing-player-front");
  const candidate = await capture(MAP_CANDIDATE_ID, "candidate-player-front");
  expect(baseline.verification.terrain.mapSpecId).toBe("warcrest-full-lane-hybrid-v1");
  expect(candidate.verification.terrain.mapSpecId).toBe(MAP_CANDIDATE_ID);
  expect(candidate.battlefield.controlPoints.map((point) => point.progress)).toEqual([0.17, 0.84]);
  expect(candidate.battlefield.defenseTowers.map((tower) => tower.progress)).toEqual([0.37, 0.64]);
  writeFileSync(
    `${ARTIFACT_DIR}/map/map-candidate-comparison.json`,
    JSON.stringify({ baseline, candidate }, null, 2),
  );
});
