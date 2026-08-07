import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/rifleman-stage1";
const SANDBOX_URL = "/game_project1/?sandbox=1";
const GAME_URL = "/game_project1/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=rifleman-stage1&autostart=1";
const WALK_PHASE = 0.55;

type SandboxDirection = "e" | "w";

type SandboxSnapshot = {
  unitId: string;
  direction: SandboxDirection;
  mode: "idle" | "walk" | "attack";
  textureKey: string;
  textureKeyResolved: string;
  flipX: boolean;
  spriteWidth: number;
  spriteHeight: number;
};

type GameUnitSnapshot = {
  unitId: string;
  team: "player" | "enemy";
  facingDirection: SandboxDirection;
  renderTexture: string;
  flipX: boolean;
  presentation: {
    spriteDisplayWidth: number;
    spriteDisplayHeight: number;
  };
};

type GameControl = {
  prepareDirectionalAuditProbe: (unitId: "rifleman", team: "player", direction: -1 | 1) => void;
  setDirectionalAuditPhase: (phase: number) => void;
  setPaused: (paused: boolean) => void;
};

type SandboxControl = {
  setUnit: (unitId: "rifleman") => void;
  setTeam: (team: "player") => void;
  setDirection: (direction: SandboxDirection) => void;
  setMode: (mode: "walk") => void;
  setAutoplay: (autoplay: boolean) => void;
  setManualPhase: (phase: number) => void;
  snapshot: () => SandboxSnapshot;
};

test.setTimeout(120_000);
test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function openSandbox(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(SANDBOX_URL);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __unitSandboxControl?: unknown }).__unitSandboxControl,
  ));
}

async function openGame(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => {
    const boot = (window as unknown as {
      __warcrestGame?: { scene: { getScene: (key: string) => { battleAssetsReady?: boolean } | undefined } };
    }).__warcrestGame?.scene.getScene("boot");
    return Boolean(boot?.battleAssetsReady);
  }, undefined, { timeout: 80_000 });
  await page.evaluate(() => {
    const boot = (window as unknown as {
      __warcrestGame?: { scene: { getScene: (key: string) => { startBattle?: () => Promise<void> } | undefined } };
    }).__warcrestGame?.scene.getScene("boot");
    return boot?.startBattle?.();
  });
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ), undefined, { timeout: 15_000 });
}

test("matches sandbox and in-game rifleman 3-frame walk phase for east/west", async ({ browser, page }) => {
  await openGame(page);
  const sandboxPage = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await openSandbox(sandboxPage);

  const comparisons: Array<Record<string, unknown>> = [];

  for (const direction of ["e", "w"] as const) {
    await sandboxPage.evaluate(({ direction, phase }) => {
      const control = (window as unknown as { __unitSandboxControl: SandboxControl }).__unitSandboxControl;
      control.setUnit("rifleman");
      control.setTeam("player");
      control.setDirection(direction);
      control.setMode("walk");
      control.setAutoplay(false);
      control.setManualPhase(phase);
    }, { direction, phase: WALK_PHASE });

    await page.evaluate(({ direction, phase }) => {
      const control = (window as unknown as { __terrainPrototypeControl: GameControl }).__terrainPrototypeControl;
      control.prepareDirectionalAuditProbe("rifleman", "player", direction === "e" ? -1 : 1);
      control.setDirectionalAuditPhase(phase);
      control.setPaused(true);
    }, { direction, phase: WALK_PHASE });

    const sandboxShot = `${ARTIFACT_DIR}/sandbox-${direction}-walk-03.png`;
    const gameShot = `${ARTIFACT_DIR}/game-${direction}-walk-03.png`;
    await sandboxPage.screenshot({ path: sandboxShot });
    await page.screenshot({ path: gameShot });

    const sandboxSnapshot = await sandboxPage.evaluate(() => (
      (window as unknown as { __unitSandboxControl: SandboxControl }).__unitSandboxControl.snapshot()
    ));
    const gameUnit = await page.evaluate(() => {
      const units = (window as unknown as { __gameDebug: { units: GameUnitSnapshot[] } }).__gameDebug.units;
      return units.find((unit) => unit.unitId === "rifleman" && unit.team === "player") ?? null;
    });

    expect(gameUnit).not.toBeNull();
    const resolvedTexture = sandboxSnapshot.textureKeyResolved.replace(/-enemy$/, "");
    expect(gameUnit?.renderTexture).toBe(resolvedTexture);
    expect(gameUnit?.flipX).toBe(sandboxSnapshot.flipX);
    expect(gameUnit?.facingDirection).toBe(direction);
    comparisons.push({
      direction,
      phase: WALK_PHASE,
      sandbox: sandboxSnapshot,
      game: gameUnit,
      screenshots: { sandbox: sandboxShot, game: gameShot },
    });
  }

  writeFileSync(`${ARTIFACT_DIR}/sandbox-vs-game-rifleman.json`, JSON.stringify(comparisons, null, 2));
  await sandboxPage.close();
});
