import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import type { LaneBattleDebugSnapshot } from "../../src/scenes/laneBattleDebugSnapshot";

const ARTIFACT_DIR = "artifacts/unit-animation-tower-v2";
const GAME_URL = "/game_project1/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-animation-tower-v2";

type UnitId = "stone_axeman" | "stone_slinger" | "supply_wagon" | "bronze_spearman";

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function openGame(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({ position: { x: 800 * box.width / 1600, y: 805 * box.height / 900 } });
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

test("normalized pose assets share canvas and ground anchor without edge clipping", async ({ page }) => {
  await openGame(page);
  const keys = [
    "stone-axeman-w-idle", "stone-axeman-w-walk-a", "stone-axeman-w-walk-b",
    "stone-axeman-w-attack",
    "stone-slinger-w-idle", "stone-slinger-w-walk-a", "stone-slinger-w-walk-b", "stone-slinger-w-attack",
    "supply-wagon-w-idle", "supply-wagon-w-walk-a", "supply-wagon-w-walk-b", "supply-wagon-w-attack",
    "bronze-spearman-w-idle", "bronze-spearman-w-walk-a", "bronze-spearman-w-walk-b",
    "bronze-spearman-w-attack",
  ];
  const metrics = await page.evaluate(async (assetKeys) => Promise.all(assetKeys.map(async (key) => {
    const image = new Image();
    image.src = `/game_project1/assets/production/units/${key}.png`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas unavailable");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] <= 12) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    return { key, width: canvas.width, height: canvas.height, minX, minY, maxX, maxY };
  })), keys);

  expect(metrics.every((entry) => (entry.width === 384 || entry.width === 512) && entry.height === 384)).toBe(true);
  expect(metrics.every((entry) => Math.abs(entry.maxY - 335) <= 1)).toBe(true);
  expect(metrics.every((entry) => entry.minX > 0 && entry.maxX < entry.width - 1)).toBe(true);
  writeFileSync(`${ARTIFACT_DIR}/normalized-frame-metrics.json`, JSON.stringify(metrics, null, 2));
});

test("captures all four shared-registry unit pose galleries", async ({ page }) => {
  await openGame(page);
  const controlType = {} as {
    prepareUnitPoseGallery: (unitId: UnitId) => void;
    setPaused: (paused: boolean) => void;
  };
  void controlType;
  for (const unitId of ["stone_axeman", "stone_slinger", "supply_wagon", "bronze_spearman"] as const) {
    await page.evaluate((id) => {
      const control = (window as unknown as { __terrainPrototypeControl: typeof controlType }).__terrainPrototypeControl;
      control.prepareUnitPoseGallery(id);
      control.setPaused(true);
    }, unitId);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${unitId}-idle-walk-a-walk-b-attack.png` });
    await page.evaluate(() => {
      (window as unknown as { __terrainPrototypeControl: typeof controlType }).__terrainPrototypeControl.setPaused(false);
    });
  }

});

test("renders authored player and enemy team-color regions without whole tint", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: { prepareTeamPaletteProbe: (unitId: UnitId) => void; setPaused: (paused: boolean) => void };
    }).__terrainPrototypeControl;
    control.prepareTeamPaletteProbe("bronze_spearman");
    control.setPaused(true);
  });
  const units = (await page.evaluate(() => (
    (window as unknown as { __gameDebug: LaneBattleDebugSnapshot }).__gameDebug.units
  ))).filter((unit) => unit.unitId === "bronze_spearman");
  expect(units).toHaveLength(2);
  expect(units.every((unit) => unit.renderTexture.endsWith("-idle") || unit.renderTexture.endsWith("-idle-enemy"))).toBe(true);
  expect(units.some((unit) => unit.renderTexture.endsWith("-enemy"))).toBe(true);
  await page.screenshot({ path: `${ARTIFACT_DIR}/bronze-spearman-team-palette.png` });
});

test("captures the axeman attack motion phases with the production frame", async ({ page }) => {
  await openGame(page);
  const controlType = {} as {
    setAttackVisualPhase: (unitId: UnitId, team: "player", phase: number) => void;
    focusAttackPair: (unitId: "stone_axeman", team: "player") => void;
    setPaused: (paused: boolean) => void;
  };
  void controlType;
  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: typeof controlType }).__terrainPrototypeControl;
    control.focusAttackPair("stone_axeman", "player");
    control.setPaused(true);
  });
  const attackFrames: Array<{ phase: number; pose: string }> = [];
  for (const [label, phase] of [["windup", 0.12], ["contact", 0.5], ["recover", 0.88]] as const) {
    await page.evaluate((nextPhase) => {
      (window as unknown as { __terrainPrototypeControl: typeof controlType })
        .__terrainPrototypeControl.setAttackVisualPhase("stone_axeman", "player", nextPhase);
    }, phase);
    const pose = await page.evaluate(() => (
      (window as unknown as { __gameDebug: LaneBattleDebugSnapshot }).__gameDebug.units
        .find((unit) => unit.unitId === "stone_axeman")?.pose ?? "missing"
    ));
    attackFrames.push({ phase, pose });
    await page.screenshot({ path: `${ARTIFACT_DIR}/stone-axeman-attack-${label}.png` });
  }
  expect(attackFrames.every((entry) => entry.pose.endsWith("-attack"))).toBe(true);
  writeFileSync(`${ARTIFACT_DIR}/axeman-attack-sequence.json`, JSON.stringify(attackFrames, null, 2));
});

test("spawns the bronze spearman art in an actual bronze roster", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: { prepareBronzeWaveProbe: () => void; setPaused: (paused: boolean) => void };
    }).__terrainPrototypeControl;
    control.prepareBronzeWaveProbe();
    control.setPaused(true);
  });
  const snapshot = await page.evaluate(() => (
    (window as unknown as { __gameDebug: LaneBattleDebugSnapshot }).__gameDebug
  ));
  const spearman = snapshot.units.find((unit) => unit.unitId === "bronze_spearman");
  expect(spearman?.pose.endsWith("-idle")).toBe(true);
  expect(spearman?.pose).not.toContain("token");
  await page.screenshot({ path: `${ARTIFACT_DIR}/bronze-wave-real-spearman.png` });
  writeFileSync(`${ARTIFACT_DIR}/bronze-wave-snapshot.json`, JSON.stringify(snapshot.units, null, 2));
});

test("freezes two simultaneous full-strength tower stones in flight", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: { prepareTowerVolleyProbe: () => void } })
      .__terrainPrototypeControl.prepareTowerVolleyProbe();
  });
  const snapshot = await page.evaluate(() => (
    (window as unknown as { __gameDebug: LaneBattleDebugSnapshot }).__gameDebug
  ));
  expect(snapshot.activeProjectiles).toHaveLength(2);
  expect(snapshot.activeProjectiles.every((projectile) => projectile.textureKey === "projectile-stone")).toBe(true);
  expect(
    Math.abs(snapshot.activeProjectiles[1].x - snapshot.activeProjectiles[0].x),
  ).toBeGreaterThan(20);
  expect(snapshot.towerAttackPatterns.stone).toMatchObject({
    projectileCount: 2,
    perProjectileDamage: 7,
    cooldownSec: 1.3,
  });
  await page.screenshot({ path: `${ARTIFACT_DIR}/tower-two-stones-in-flight.png` });
  writeFileSync(
    `${ARTIFACT_DIR}/tower-volley-snapshot.json`,
    JSON.stringify({
      activeProjectiles: snapshot.activeProjectiles,
      tower: snapshot.towerAttackPatterns.stone,
      stoneSlinger: snapshot.verification.unitStats.stone_slinger,
    }, null, 2),
  );
});
