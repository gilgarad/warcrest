import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SANDBOX_URL = "/warcrest/?sandbox=1";
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=mechanized-three-frame&autostart=1";
const ARTIFACT_DIR = "artifacts/mechanized-3frame-v1/runtime-audit";
const UNITS = [
  "cannon_i",
  "cannon_ii",
  "artillery_i",
  "artillery_ii",
  "tank",
  "mobile_artillery",
  "modern_tank",
] as const;
const PREFIXES: Record<typeof UNITS[number], string> = {
  cannon_i: "cannon-i",
  cannon_ii: "cannon-ii",
  artillery_i: "artillery-i",
  artillery_ii: "artillery-ii",
  tank: "tank",
  mobile_artillery: "mobile-artillery",
  modern_tank: "modern-tank",
};

type SandboxControl = {
  setUnit: (unitId: typeof UNITS[number]) => void;
  setTeam: (team: "player" | "enemy") => void;
  setDirection: (direction: "e" | "w") => void;
  setMode: (mode: "idle" | "walk" | "attack") => void;
  setAutoplay: (autoplay: boolean) => void;
  setManualPhase: (phase: number) => void;
  snapshot: () => {
    textureKeyResolved: string;
    flipX: boolean;
    spriteWidth: number;
    spriteHeight: number;
    spriteX: number;
    spriteY: number;
  };
};

test("mechanized roster uses forward-only wheel and track phases", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(SANDBOX_URL);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __unitSandboxControl?: unknown }).__unitSandboxControl,
  ));

  const results = await page.evaluate((unitIds) => {
    const control = (window as unknown as { __unitSandboxControl: SandboxControl }).__unitSandboxControl;
    return unitIds.flatMap((unitId) => (["player", "enemy"] as const).flatMap((team) => (
      ["e", "w"] as const
    ).map((direction) => {
      control.setUnit(unitId);
      control.setTeam(team);
      control.setDirection(direction);
      control.setMode("walk");
      control.setAutoplay(false);
      const snapshots = [0.05, 0.40, 0.75].map((phase) => {
        control.setManualPhase(phase);
        return control.snapshot();
      });
      return { unitId, team, direction, snapshots };
    })));
  }, UNITS);

  for (const { unitId, team, direction, snapshots } of results) {
    const suffix = team === "enemy" ? "-enemy" : "";
    const prefix = PREFIXES[unitId];
    expect(snapshots.map((entry) => entry.textureKeyResolved)).toEqual([
      `${prefix}-e-walk-01${suffix}`,
      `${prefix}-e-walk-02${suffix}`,
      `${prefix}-e-walk-03${suffix}`,
    ]);
    expect(snapshots.every((entry) => entry.flipX === (direction === "w"))).toBe(true);
  }
});

test("mechanized attack keeps the locomotion anchor and scale", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(SANDBOX_URL);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __unitSandboxControl?: unknown }).__unitSandboxControl,
  ));

  for (const unitId of UNITS) {
    const result = await page.evaluate((selectedUnitId) => {
      const control = (window as unknown as { __unitSandboxControl: SandboxControl }).__unitSandboxControl;
      control.setUnit(selectedUnitId);
      control.setTeam("player");
      control.setDirection("e");
      control.setAutoplay(false);
      control.setMode("walk");
      control.setManualPhase(0.05);
      const walk = control.snapshot();
      control.setMode("attack");
      control.setManualPhase(0.5);
      const attack = control.snapshot();
      return { walk, attack };
    }, unitId);
    expect(result.attack.spriteWidth).toBeCloseTo(result.walk.spriteWidth);
    expect(result.attack.spriteHeight).toBeCloseTo(result.walk.spriteHeight);
    expect(result.attack.spriteX).toBeCloseTo(result.walk.spriteX);
    expect(result.attack.spriteY).toBeCloseTo(result.walk.spriteY);
    await page.screenshot({
      path: `${ARTIFACT_DIR}/${unitId}-attack.png`,
      clip: { x: 365, y: 74, width: 813, height: 805 },
    });
  }
});

test("game pose gallery resolves the same mechanized assets as sandbox", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
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

  for (const unitId of UNITS) {
    const textures = await page.evaluate((selectedUnitId) => {
      const control = (window as unknown as {
        __terrainPrototypeControl: { prepareUnitPoseGallery: (id: typeof UNITS[number]) => void };
      }).__terrainPrototypeControl;
      control.prepareUnitPoseGallery(selectedUnitId);
      return (window as unknown as {
        __gameDebug: { units: Array<{ unitId: string; renderTexture: string }> };
      }).__gameDebug.units
        .filter((unit) => unit.unitId === selectedUnitId)
        .map((unit) => unit.renderTexture);
    }, unitId);
    expect(textures).toEqual([
      `${PREFIXES[unitId]}-e-idle`,
      `${PREFIXES[unitId]}-e-walk-01`,
      `${PREFIXES[unitId]}-e-walk-02`,
      `${PREFIXES[unitId]}-e-walk-03`,
      `${PREFIXES[unitId]}-e-attack`,
    ]);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${unitId}-game-gallery.png` });
  }
});
