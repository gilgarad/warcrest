import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/audio-integration";
const GAME_URL = "/?terrain=prototype-v2&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-central-v1&audioDebug=1";

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
  await canvas.click({ position: { x: x * box.width / 1600, y: y * box.height / 900 } });
}

async function startGame(page: Page): Promise<void> {
  await expect.poll(async () => (await audioState(page)).bgmState).toBe("menu");
  await clickCanvasLogical(page, 800, 805);
  await page.waitForFunction(() => (
    (window as unknown as { __gameDebug?: { phase?: string } }).__gameDebug?.phase === "lane-siege"
  ));
  await expect.poll(async () => (await audioState(page)).unlocked).toBe(true);
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test("Audio Lab plays the layered score and distinct combat synthesis families", async ({ page }) => {
  const runtimeErrors: string[] = [];
  const failedResponses: Array<{ status: number; url: string }> = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      runtimeErrors.push(`${message.text()} @ ${location.url || "unknown"}:${location.lineNumber ?? 0}`);
    }
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });

  await page.goto("/tools/audio-lab/index.html");
  await page.locator("#unlockBtn").click();
  await expect(page.locator("#unlockStatus")).toContainText("활성화됨");
  await page.locator("#combatSfxMode").selectOption("full");

  await page.locator('[data-asset-id="bgm.battle.low"]').click();
  await expect(page.locator("#state")).toContainText('"currentBgmId": "bgm.battle.low"');
  await page.waitForTimeout(900);
  await page.locator('[data-asset-id="bgm.battle.high"]').click();
  await expect(page.locator("#state")).toContainText('"currentBgmId": "bgm.battle.high"');

  for (const id of [
    "sfx.combat.meleeHit",
    "sfx.combat.projectileHit",
    "sfx.combat.unitHit",
    "sfx.combat.unitDeath",
    "sfx.support.heal",
  ]) {
    await page.locator(`[data-asset-id="${id}"]`).click();
    await page.waitForTimeout(120);
  }

  await page.waitForTimeout(700);
  const state = JSON.parse(await page.locator("#state").innerText()) as {
    currentBgmId: string;
    activeBgmVoices: number;
    lastError: string | null;
    missingAssetCounts: { bgm: number; sfx: number };
  };
  expect(state.currentBgmId).toBe("bgm.battle.high");
  expect(state.activeBgmVoices).toBeGreaterThan(0);
  expect(state.lastError).toBeNull();
  expect(state.missingAssetCounts).toEqual({ bgm: 6, sfx: 33 });
  expect(failedResponses).toEqual([]);
  expect(runtimeErrors).toEqual([]);

  await page.screenshot({ path: `${ARTIFACT_DIR}/audio-lab-layered-synthesis.png`, fullPage: true });
});

test("complete audio lifecycle, settings, focus, terminal states, and restart", async ({ page }) => {
  test.setTimeout(90_000);
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

  await clickCanvasLogical(page, 940, 624);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await audioState(page)).settings.combatSfxMode).toBe("full");
  expect((await audioState(page)).settings.masterVolume).toBeCloseTo(0.75, 2);

  await page.keyboard.press("Escape");
  await page.keyboard.press("KeyM");
  expect((await audioState(page)).settings.mute).toBe(true);
  await page.keyboard.press("KeyM");
  expect((await audioState(page)).settings.mute).toBe(false);

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(async () => (await audioState(page)).focusMuted).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(async () => (await audioState(page)).focusMuted).toBe(false);

  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: { setPlayerBaseHpRatio: (ratio: number) => void } }).__terrainPrototypeControl;
    control.setPlayerBaseHpRatio(0.3);
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
