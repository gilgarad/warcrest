import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SANDBOX_URL = "/warcrest/?sandbox=1";
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=cavalry-three-frame&autostart=1";
const ARTIFACT_DIR = "artifacts/cavalry-3frame-v1/sandbox-audit";
const CAVALRY = ["knight", "heavy_cavalry", "light_cavalry", "cavalry"] as const;
const PREFIXES: Record<typeof CAVALRY[number], string> = {
  knight: "knight",
  heavy_cavalry: "heavy-cavalry",
  light_cavalry: "light-cavalry",
  cavalry: "cavalry",
};

type SandboxControl = {
  setUnit: (unitId: typeof CAVALRY[number]) => void;
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
  };
};

test("all cavalry use the shared east-authored three-frame cycle", async ({ page }) => {
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
      const snapshots = [0.05, 0.30, 0.55, 0.80].map((phase) => {
        control.setUnit(unitId);
        control.setTeam(team);
        control.setDirection(direction);
        control.setMode("walk");
        control.setAutoplay(false);
        control.setManualPhase(phase);
        return control.snapshot();
      });
      return { unitId, team, direction, snapshots };
    })));
  }, CAVALRY);

  for (const { unitId, team, direction, snapshots } of results) {
    const suffix = team === "enemy" ? "-enemy" : "";
    const prefix = PREFIXES[unitId];
    expect(snapshots.map((entry) => entry.textureKeyResolved)).toEqual([
      `${prefix}-e-walk-01${suffix}`,
      `${prefix}-e-walk-02${suffix}`,
      `${prefix}-e-walk-03${suffix}`,
      `${prefix}-e-walk-02${suffix}`,
    ]);
    expect(snapshots.every((entry) => entry.flipX === (direction === "w"))).toBe(true);
  }
});

test("cavalry attack and walk preserve the same horse scale", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(SANDBOX_URL);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __unitSandboxControl?: unknown }).__unitSandboxControl,
  ));

  const results = [];
  for (const unitId of CAVALRY) {
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
      const attack = control.snapshot();
      return { unitId: selectedUnitId, walk, attack };
    }, unitId);
    await page.screenshot({
      path: `${ARTIFACT_DIR}/${unitId}-attack.png`,
      clip: { x: 365, y: 74, width: 813, height: 805 },
    });
    results.push(result);
  }

  for (const { unitId, walk, attack } of results) {
    const walkBodyHeight = walk.spriteHeight * (unitId === "heavy_cavalry" ? 270 / 512 : 270 / 384);
    const attackBodyHeight = attack.spriteHeight * 270 / 384;
    expect(walkBodyHeight).toBeCloseTo(attackBodyHeight);
    expect(walkBodyHeight).toBeCloseTo(112 * 1.14);
  }
});

test("the game scene uses the same five cavalry poses as the sandbox", async ({ page }) => {
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

  for (const unitId of CAVALRY) {
    const textures = await page.evaluate((selectedUnitId) => {
      const control = (window as unknown as {
        __terrainPrototypeControl: { prepareUnitPoseGallery: (id: typeof CAVALRY[number]) => void };
      }).__terrainPrototypeControl;
      control.prepareUnitPoseGallery(selectedUnitId);
      return (window as unknown as {
        __gameDebug: { units: Array<{ unitId: string; renderTexture: string }> };
      }).__gameDebug.units
        .filter((unit) => unit.unitId === selectedUnitId)
        .map((unit) => unit.renderTexture);
    }, unitId);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${unitId}-game-gallery.png` });
    expect(textures).toEqual([
      `${PREFIXES[unitId]}-e-idle`,
      `${PREFIXES[unitId]}-e-walk-01`,
      `${PREFIXES[unitId]}-e-walk-03`,
      `${PREFIXES[unitId]}-e-walk-02`,
      `${PREFIXES[unitId]}-e-attack`,
    ]);
  }
});
