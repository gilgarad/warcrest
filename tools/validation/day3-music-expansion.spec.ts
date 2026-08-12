import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { OfflineArrangementMeasurement } from "../../src/systems/audio/backend";

const ARTIFACT_DIR = "artifacts/day3-music";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-day3-music&audioDebug=1";

interface AudioState {
  currentBgmId: string | null;
  bgmState: string | null;
  activeBgmVoices: number;
  contextState: string;
}

test.beforeAll(() => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
});

async function startBattle(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

async function annotateState(page: Page, title: string, state: AudioState): Promise<void> {
  await page.evaluate(({ nextTitle, nextState }) => {
    let note = document.getElementById("day3-audio-note");
    if (!note) {
      note = document.createElement("div");
      note.id = "day3-audio-note";
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

test("captures layered offline measurements for all four looping BGM states", async ({ page }) => {
  await page.goto(GAME_URL);
  await startBattle(page);

  const measureArrangement = (assetId: string): Promise<OfflineArrangementMeasurement | null> => page.evaluate((nextAssetId) => (
    (window as unknown as {
      __audioDebugControl: {
        measureArrangement: (assetId: string, durationMs: number) => Promise<OfflineArrangementMeasurement | null>;
      };
    }).__audioDebugControl.measureArrangement(nextAssetId, 8000)
  ), assetId);

  const measurements: Record<string, OfflineArrangementMeasurement> = {};
  for (const assetId of ["bgm.menu", "bgm.preparation", "bgm.battle.low", "bgm.battle.high"] as const) {
    const measurement = await measureArrangement(assetId);
    expect(measurement).not.toBeNull();
    expect(measurement?.mix.rms ?? 0).toBeGreaterThan(assetId === "bgm.menu" ? 0.001 : 0.006);
    expect(measurement?.mix.peak ?? 0).toBeLessThan(0.95);
    expect(measurement?.layers.percussion?.rms ?? 0).toBeGreaterThan(0.0005);
    expect(measurement?.layers.bass?.rms ?? 0).toBeGreaterThan(0.0005);
    expect(measurement?.layers.harmony?.rms ?? 0).toBeGreaterThan(0.0005);
    expect(measurement?.layers.lowColor?.rms ?? 0).toBeGreaterThan(0.0005);
    expect(measurement?.layers.lead?.rms ?? 0).toBeGreaterThan(0.0005);
    if (assetId === "bgm.battle.high") {
      expect(measurement?.layers.counterline?.rms ?? 0).toBeGreaterThan(0.0005);
    }
    measurements[assetId] = measurement as OfflineArrangementMeasurement;
  }

  expect(measurements["bgm.battle.high"].mix.rms).toBeGreaterThan(measurements["bgm.battle.low"].mix.rms);
  expect(measurements["bgm.preparation"].mix.rms).toBeGreaterThan(measurements["bgm.menu"].mix.rms * 0.9);

  writeFileSync(`${ARTIFACT_DIR}/offline-arrangements.json`, JSON.stringify(measurements, null, 2));
});

test("captures in-game state transitions for the expanded BGM set", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  await startBattle(page);

  await page.evaluate(() => (
    (window as unknown as {
      __terrainPrototypeControl: { setPaused: (paused: boolean) => void };
    }).__terrainPrototypeControl.setPaused(true)
  ));

  const getState = (): Promise<AudioState> => page.evaluate(() => (
    (window as unknown as {
      __audioDebugControl: { getState: () => AudioState };
    }).__audioDebugControl.getState()
  ));

  const setState = async (bgmState: "menu" | "preparation" | "battle-low" | "battle-high", screenshotName: string) => {
    await page.evaluate((nextState) => (
      (window as unknown as {
        __audioDebugControl: { setState: (state: string) => void };
      }).__audioDebugControl.setState(nextState)
    ), bgmState);
    await page.waitForTimeout(240);
    const state = await getState();
    expect(state.bgmState).toBe(bgmState);
    expect(state.activeBgmVoices).toBeGreaterThan(0);
    await annotateState(page, screenshotName.toUpperCase(), state);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${screenshotName}.png` });
    return state;
  };

  const menuState = await setState("menu", "transition-menu");
  const preparationState = await setState("preparation", "transition-preparation");
  const battleLowState = await setState("battle-low", "transition-battle-low");
  const battleHighState = await setState("battle-high", "transition-battle-high");
  const battleLowReturnState = await setState("battle-low", "transition-battle-low-return");

  expect(menuState.currentBgmId).toBe("bgm.menu");
  expect(preparationState.currentBgmId).toBe("bgm.preparation");
  expect(battleLowState.currentBgmId).toBe("bgm.battle.low");
  expect(battleHighState.currentBgmId).toBe("bgm.battle.high");
  expect(battleLowReturnState.currentBgmId).toBe("bgm.battle.low");

  writeFileSync(
    `${ARTIFACT_DIR}/in-game-transitions.json`,
    JSON.stringify({
      menuState,
      preparationState,
      battleLowState,
      battleHighState,
      battleLowReturnState,
    }, null, 2),
  );
});
