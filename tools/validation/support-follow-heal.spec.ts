import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const GAME_URL = "/game_project1/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=support-follow-heal&autostart=1";
const ARTIFACT_DIR = "artifacts/support-follow-heal";

type Team = "player" | "enemy";
type Relation = "ahead" | "behind" | "far";
type UnitSnapshot = {
  team: Team;
  role: "battle" | "support";
  progress: number;
  hp: number;
  maxHp: number;
  travelFacingX: -1 | 1;
  flipX: boolean;
  renderTexture: string;
  attackAnimTime: number;
};
type Snapshot = { units: UnitSnapshot[] };
type Control = {
  prepareSupportSeekProbe: (team: Team, relation: Relation) => void;
  stepSupportSeekProbe: (deltaSec: number) => void;
  setPaused: (paused: boolean) => void;
};

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

async function prepare(page: import("@playwright/test").Page, team: Team, relation: Relation): Promise<void> {
  await page.evaluate(({ selectedTeam, selectedRelation }) => {
    const control = (window as unknown as { __terrainPrototypeControl: Control }).__terrainPrototypeControl;
    control.prepareSupportSeekProbe(selectedTeam, selectedRelation);
  }, { selectedTeam: team, selectedRelation: relation });
  await page.waitForTimeout(50);
}

async function stepSeek(page: import("@playwright/test").Page, count: number): Promise<void> {
  await page.evaluate((steps) => {
    const control = (window as unknown as { __terrainPrototypeControl: Control }).__terrainPrototypeControl;
    for (let index = 0; index < steps; index += 1) control.stepSupportSeekProbe(0.1);
  }, count);
}

async function snapshot(page: import("@playwright/test").Page): Promise<Snapshot> {
  return page.evaluate(() => (window as unknown as { __gameDebug: Snapshot }).__gameDebug);
}

test("player and enemy support pursue nearby wounded allies and heal", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await openGame(page);

  for (const team of ["player", "enemy"] as const) {
    await prepare(page, team, "ahead");
    const before = await snapshot(page);
    const hpBefore = before.units.find((unit) => unit.team === team && unit.role === "battle")!.hp;
    await stepSeek(page, 40);
    const joined = await snapshot(page);
    const support = joined.units.find((unit) => unit.team === team && unit.role === "support");
    expect(support).toBeDefined();
    if (team === "player") expect(support!.progress).toBeGreaterThan(0.5);
    else expect(support!.progress).toBeLessThan(0.5);
    expect(support?.travelFacingX).toBe(team === "player" ? 1 : -1);
    expect(support?.flipX).toBe(team === "enemy");
    expect(support?.attackAnimTime).toBeGreaterThan(0);
    expect(joined.units.find((unit) => unit.team === team && unit.role === "battle")?.hp).toBe(hpBefore);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${team}-joined-and-healed.png` });
  }
});

test("support can turn back for a nearby wounded ally but waits for distant allies", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await openGame(page);

  await prepare(page, "player", "behind");
  const behindBefore = await snapshot(page);
  const behindStart = behindBefore.units.find((unit) => unit.role === "support")!.progress;
  await stepSeek(page, 8);
  const behindState = await snapshot(page);
  const behindSupport = behindState.units.find((unit) => unit.role === "support");
  expect(behindSupport?.progress).toBeLessThan(behindStart);
  expect(behindSupport?.travelFacingX).toBe(-1);
  expect(behindSupport?.flipX).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/player-turns-back-facing-left.png` });

  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: Control }).__terrainPrototypeControl;
    control.prepareSupportSeekProbe("player", "far");
  });
  await page.waitForTimeout(50);
  await stepSeek(page, 20);
  const farState = await snapshot(page);
  const farSupport = farState.units.find((unit) => unit.role === "support");
  expect(farSupport?.progress).toBeCloseTo(0.5, 3);
});
