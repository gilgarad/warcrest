import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/audio-integration";
const GAME_URL = "/?terrain=prototype-v2&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-central-v1&audioDebug=1";
test.describe.configure({ timeout: 150_000 });

interface AudioDebugState {
  initialized: boolean;
  unlocked: boolean;
  contextState: string;
  bgmState: string | null;
  currentBgmId: string | null;
  activeBgmVoices: number;
  activeSfxVoices: number;
  focusMuted: boolean;
  unlockAttemptCount: number;
  skippedEventCount: number;
  settings: {
    masterVolume: number;
    bgmVolume: number;
    sfxVolume: number;
    mute: boolean;
    muteWhenUnfocused: boolean;
    combatSfxMode: string;
  };
  recentEvents: Array<{ id: string; result: string; atMs: number }>;
}

interface AudioBrowserDebugState {
  activeBgmVoices: number;
  recentEvents: Array<{ id: string; result: string }>;
}

async function audioState(page: Page): Promise<AudioDebugState> {
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __audioDebugControl?: unknown }).__audioDebugControl,
  ));
  return page.evaluate(() => {
    const control = (window as unknown as { __audioDebugControl: { getState: () => AudioDebugState } }).__audioDebugControl;
    return control.getState();
  });
}

async function clickCanvasLogical(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({ position: { x: x * box.width / 1600, y: y * box.height / 900 }, force: true });
}

async function startGame(page: Page): Promise<void> {
  await expect.poll(async () => (await audioState(page)).bgmState).toBe("menu");
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await clickCanvasLogical(page, 800, 805);
    try {
      await page.waitForFunction(() => (
        (window as unknown as { __gameDebug?: { phase?: string } }).__gameDebug?.phase === "lane-siege"
      ), { timeout: 1_500 });
      break;
    } catch (error) {
      if (attempt === 14) throw error;
    }
  }
  await expect.poll(async () => (await audioState(page)).unlocked).toBe(true);
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function openAudioBrowser(page: Page): Promise<void> {
  await page.goto("/game_project1/tools/audio-browser/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#unlockBtn")).toBeVisible({ timeout: 60_000 });
}

async function selectAudioBrowserAssetByFileName(page: Page, fileName: string): Promise<void> {
  const clicked = await page.evaluate((nextFileName) => {
    const rows = [...document.querySelectorAll(".file")];
    for (const row of rows) {
      const name = row.querySelector(".file-name")?.textContent?.trim();
      if (name === nextFileName) {
        (row.querySelector("button") as HTMLButtonElement | null)?.click();
        return true;
      }
    }
    return false;
  }, fileName);
  expect(clicked).toBe(true);
}

async function playSelectedAudioBrowserAsset(page: Page): Promise<void> {
  await page.locator("#playSelectedBtn").click();
}

test("Audio browser plays the layered score and distinct combat synthesis families", async ({ page }) => {
  const runtimeErrors: string[] = [];
  const warnings: string[] = [];
  const failedResponses: Array<{ status: number; url: string }> = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      runtimeErrors.push(`${message.text()} @ ${location.url || "unknown"}:${location.lineNumber ?? 0}`);
    }
    if (message.type() === "warning") warnings.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });

  await openAudioBrowser(page);
  await page.locator("#unlockBtn").click();
  await expect(page.locator("#unlockStatus")).toContainText("오디오 활성화 완료");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => page.evaluate(() => (
    window.__audioDebugControl.getState().contextState
  ))).toBe("running");
  await page.evaluate(() => {
    window.__audioDebugControl.setCombatSfxMode("full");
    window.__audioDebugControl.setVolumes(1, 1, 1);
  });

  await selectAudioBrowserAssetByFileName(page, "battle-low.mp3");
  await expect(page.locator("#selectedType")).toContainText("BGM");
  await playSelectedAudioBrowserAsset(page);
  await page.waitForTimeout(900);
  await selectAudioBrowserAssetByFileName(page, "battle-high.mp3");
  await expect(page.locator("#selectedPath")).toContainText("battle-high.mp3");
  await playSelectedAudioBrowserAsset(page);

  await selectAudioBrowserAssetByFileName(page, "combat-meleeHit.mp3");
  await expect(page.locator("#selectedSynth")).toContainText("blade");
  await playSelectedAudioBrowserAsset(page);
  await selectAudioBrowserAssetByFileName(page, "combat-projectileHit.mp3");
  await expect(page.locator("#selectedSynth")).toContainText("impact");
  await playSelectedAudioBrowserAsset(page);
  await selectAudioBrowserAssetByFileName(page, "combat-unitHit.mp3");
  await expect(page.locator("#selectedSynth")).toContainText("grunt");
  await playSelectedAudioBrowserAsset(page);
  await selectAudioBrowserAssetByFileName(page, "combat-unitDeath.mp3");
  await expect(page.locator("#selectedSynth")).toContainText("grunt");
  await playSelectedAudioBrowserAsset(page);
  await selectAudioBrowserAssetByFileName(page, "support-heal.mp3");
  await expect(page.locator("#selectedSynth")).toContainText("healChime");
  await playSelectedAudioBrowserAsset(page);

  await page.waitForTimeout(700);
  const state = await page.evaluate(() => (
    window.__audioDebugControl.getState() as unknown as AudioBrowserDebugState
  ));
  expect(state.recentEvents.some((event) => event.id === "sfx.support.heal" && event.result === "played")).toBe(true);
  expect(state.activeBgmVoices).toBeGreaterThan(0);
  expect(failedResponses).toEqual([]);
  expect(runtimeErrors).toEqual([]);
  expect(warnings).toEqual([]);

  await page.screenshot({ path: `${ARTIFACT_DIR}/audio-browser-layered-synthesis.png`, fullPage: true });
});

test("complete audio lifecycle, settings, focus, terminal states, and restart", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedResponses: Array<{ status: number; url: string }> = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      consoleErrors.push(`${message.text()} @ ${location.url || "unknown"}:${location.lineNumber ?? 0}`);
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() });
    }
  });

  await page.setViewportSize({ width: 1365, height: 768 });
  await page.goto(GAME_URL);
  const beforeInput = await audioState(page);
  expect(beforeInput.initialized).toBe(true);
  expect(beforeInput.unlocked).toBe(false);
  expect(beforeInput.contextState).toBe("not-created");
  expect(beforeInput.activeBgmVoices).toBe(0);

  await startGame(page);
  await expect.poll(async () => (await audioState(page)).activeBgmVoices).toBe(1);
  await expect.poll(async () => (await audioState(page)).bgmState).toBe("battle-high");
  const afterStart = await audioState(page);
  expect(afterStart.unlockAttemptCount).toBe(1);

  await page.screenshot({ path: `${ARTIFACT_DIR}/recommended-gameplay-1365x768.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${ARTIFACT_DIR}/audio-settings-1365x768.png` });

  const beforeVolumeAdjust = (await audioState(page)).settings.masterVolume;
  await clickCanvasLogical(page, 940, 624);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await audioState(page)).settings.combatSfxMode).toBe("full");
  expect((await audioState(page)).settings.masterVolume).toBeLessThan(beforeVolumeAdjust);

  await page.keyboard.press("Escape");
  await page.keyboard.press("KeyM");
  expect((await audioState(page)).settings.mute).toBe(true);
  await page.keyboard.press("KeyM");
  expect((await audioState(page)).settings.mute).toBe(false);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
  });
  await expect.poll(async () => (await audioState(page)).focusMuted).toBe(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await audioState(page)).focusMuted).toBe(false);

  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        setPlayerBaseHpRatio: (ratio: number) => void;
        setCentralFortressHpRatio: (ratio: number) => void;
      };
    }).__terrainPrototypeControl;
    control.setPlayerBaseHpRatio(0.3);
    control.setCentralFortressHpRatio(0.3);
  });
  await expect.poll(async () => (await audioState(page)).bgmState).toBe("fortress-under-attack");
  expect((await audioState(page)).activeBgmVoices).toBeLessThanOrEqual(2);
  await page.waitForTimeout(1900);
  expect((await audioState(page)).activeBgmVoices).toBe(1);

  const regression = await page.evaluate(() => {
    const terrain = (window as unknown as {
      __terrainPrototypeControl: {
        setPaused: (paused: boolean) => void;
        snapshot: () => unknown;
      };
      __audioDebugControl: {
        setVolumes: (master: number, bgm: number, sfx: number) => void;
        setCombatSfxMode: (mode: string) => void;
        playSfx: (id: string) => void;
      };
    });
    terrain.__terrainPrototypeControl.setPaused(true);
    const before = JSON.stringify(terrain.__terrainPrototypeControl.snapshot());
    terrain.__audioDebugControl.setVolumes(0.61, 0.52, 0.43);
    terrain.__audioDebugControl.setCombatSfxMode("reduced");
    terrain.__audioDebugControl.playSfx("sfx.ui.confirm");
    const after = JSON.stringify(terrain.__terrainPrototypeControl.snapshot());
    terrain.__terrainPrototypeControl.setPaused(false);
    return { exact: before === after, beforeLength: before.length, afterLength: after.length };
  });
  expect(regression.exact).toBe(true);

  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: { forceGameOver: (win: boolean) => void } }).__terrainPrototypeControl;
    control.forceGameOver(true);
  });
  await expect.poll(async () => (await audioState(page)).bgmState).toBe("victory");
  expect((await audioState(page)).activeBgmVoices).toBe(1);
  await clickCanvasLogical(page, 800, 532);
  await page.waitForFunction(() => (
    (window as unknown as { __gameDebug?: { phase?: string } }).__gameDebug?.phase === "gameover"
      ? false
      : true
  ));
  await startGame(page);
  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: { forceGameOver: (win: boolean) => void } }).__terrainPrototypeControl;
    control.forceGameOver(false);
  });
  await expect.poll(async () => (await audioState(page)).bgmState).toBe("defeat");
  await clickCanvasLogical(page, 800, 532);
  await startGame(page);
  expect((await audioState(page)).activeBgmVoices).toBe(1);

  const finalState = await audioState(page);
  const persistedSettings = finalState.settings;
  await page.reload();
  const afterReloadBeforeInput = await audioState(page);
  expect(afterReloadBeforeInput.unlocked).toBe(false);
  expect(afterReloadBeforeInput.contextState).toBe("not-created");
  expect(afterReloadBeforeInput.settings).toEqual(persistedSettings);
  await startGame(page);
  const afterReloadStart = await audioState(page);
  expect(afterReloadStart.unlockAttemptCount).toBe(1);
  expect(afterReloadStart.activeBgmVoices).toBe(1);

  writeFileSync(`${ARTIFACT_DIR}/playwright-audio-validation.json`, JSON.stringify({
    beforeInput,
    afterStart,
    regression,
    finalState,
    afterReloadBeforeInput,
    afterReloadStart,
    consoleErrors,
    failedResponses,
  }, null, 2));
  expect(failedResponses).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

for (const viewport of [
  { width: 1024, height: 576, name: "1024x576" },
  { width: 1600, height: 900, name: "1600x900" },
]) {
  test(`audio settings stays on-screen at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(GAME_URL);
    await startGame(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${ARTIFACT_DIR}/audio-settings-${viewport.name}.png` });
    const canvas = await page.locator("canvas").boundingBox();
    expect(canvas).not.toBeNull();
    expect(canvas!.x).toBeGreaterThanOrEqual(0);
    expect(canvas!.y).toBeGreaterThanOrEqual(0);
    expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(viewport.height + 1);
  });
}
