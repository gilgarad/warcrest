import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SANDBOX_URL = "/warcrest/?sandbox=1";
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=supply-age-v1&autostart=1";
const ARTIFACT_DIR = "artifacts/supply-age-audit-2026-08-07";
const CASES = [
  ["stone", "supply-wagon-ancient"],
  ["iron_early", "supply-wagon-iron"],
  ["renaissance", "supply-wagon-renaissance"],
  ["industrial_early", "supply-wagon-industrial"],
  ["modern_early", "supply-wagon-modern-early"],
  ["modern_late", "supply-wagon-modern-late"],
] as const;

type SupplyAge = typeof CASES[number][0];
type SandboxControl = {
  setUnit: (unitId: "supply_wagon") => void;
  setAge: (ageId: SupplyAge) => void;
  setDirection: (direction: "e" | "w") => void;
  setMode: (mode: "idle" | "walk" | "attack") => void;
  setAutoplay: (autoplay: boolean) => void;
  setManualPhase: (phase: number) => void;
  snapshot: () => { textureKeyResolved: string; flipX: boolean; directionMode: string };
};

test("support uses its selected age prefix and canonical east art", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(SANDBOX_URL);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __unitSandboxControl?: unknown }).__unitSandboxControl,
  ));

  for (const [ageId, prefix] of CASES) {
    const east = await page.evaluate((selectedAge) => {
      const control = (window as unknown as { __unitSandboxControl: SandboxControl }).__unitSandboxControl;
      control.setUnit("supply_wagon");
      control.setAge(selectedAge);
      control.setDirection("e");
      control.setMode("idle");
      control.setAutoplay(false);
      return control.snapshot();
    }, ageId);
    expect(east.textureKeyResolved).toBe(`${prefix}-e-idle`);
    expect(east.flipX).toBe(false);
    expect(east.directionMode).toBe("legacy-mirrored");
    await page.screenshot({
      path: `${ARTIFACT_DIR}/${ageId}-east-idle.png`,
      clip: { x: 365, y: 74, width: 813, height: 805 },
    });

    const west = await page.evaluate(() => {
      const control = (window as unknown as { __unitSandboxControl: SandboxControl }).__unitSandboxControl;
      control.setDirection("w");
      return control.snapshot();
    });
    expect(west.textureKeyResolved).toBe(`${prefix}-e-idle`);
    expect(west.flipX).toBe(true);

    const poses = await page.evaluate(() => {
      const control = (window as unknown as { __unitSandboxControl: SandboxControl }).__unitSandboxControl;
      control.setDirection("e");
      control.setMode("walk");
      const walk = [0.05, 0.3, 0.55, 0.8].map((phase) => {
        control.setAutoplay(false);
        control.setManualPhase(phase);
        return control.snapshot();
      });
      control.setMode("attack");
      control.setManualPhase(0.5);
      const attack = control.snapshot();
      return { walk, attack };
    });
    expect(poses.walk.map((pose) => pose.textureKeyResolved)).toEqual([
      `${prefix}-e-walk-01`,
      `${prefix}-e-walk-02`,
      `${prefix}-e-walk-03`,
      `${prefix}-e-walk-02`,
    ]);
    expect(poses.attack.textureKeyResolved).toBe(`${prefix}-e-attack`);
    await page.screenshot({
      path: `${ARTIFACT_DIR}/${ageId}-east-heal.png`,
      clip: { x: 365, y: 74, width: 813, height: 805 },
    });
  }
});

test("the game scene resolves the same age-specific supply idle and heal assets", async ({ page }) => {
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

  for (const [ageId, prefix] of CASES) {
    const textures = await page.evaluate((selectedAge) => {
      const control = (window as unknown as {
        __terrainPrototypeControl: {
          prepareAgeWaveProbe: (age: SupplyAge) => void;
          setAttackVisualPhase: (unitId: "supply_wagon", team: "player", phase: number) => void;
        };
      }).__terrainPrototypeControl;
      control.prepareAgeWaveProbe(selectedAge);
      const idle = (window as unknown as {
        __gameDebug: { units: Array<{ unitId: string; renderTexture: string }> };
      }).__gameDebug.units.find((unit) => unit.unitId === "supply_wagon")?.renderTexture;
      control.setAttackVisualPhase("supply_wagon", "player", 0.5);
      const heal = (window as unknown as {
        __gameDebug: { units: Array<{ unitId: string; renderTexture: string }> };
      }).__gameDebug.units.find((unit) => unit.unitId === "supply_wagon")?.renderTexture;
      return { idle, heal };
    }, ageId);
    expect(textures.idle).toBe(`${prefix}-e-idle`);
    expect(textures.heal).toBe(`${prefix}-e-attack`);
    await page.screenshot({ path: `${ARTIFACT_DIR}/${ageId}-game-heal.png` });
  }
});
