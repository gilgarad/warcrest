import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SANDBOX_URL = "/game_project1/?sandbox=1";
const GAME_URL = "/game_project1/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=human-attack-regression&autostart=1";
const ARTIFACT_DIR = "artifacts/human-3frame-v2/final-attack-audit";

type SandboxControl = {
  setUnit: (unitId: AuditedUnit) => void;
  setTeam: (team: "player") => void;
  setDirection: (direction: "e") => void;
  setMode: (mode: "idle" | "walk" | "attack") => void;
  setAutoplay: (autoplay: boolean) => void;
  setManualPhase: (phase: number) => void;
  snapshot: () => {
    textureKeyResolved: string;
    spriteWidth: number;
    spriteHeight: number;
  };
};

type AuditedUnit =
  | "bronze_swordsman"
  | "bronze_spearman"
  | "iron_swordsman"
  | "iron_spearman"
  | "pikeman"
  | "rifleman"
  | "rifleman_late";

test("pikeman scale and attack assets render intact in the sandbox", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(SANDBOX_URL);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __unitSandboxControl?: unknown }).__unitSandboxControl,
  ));

  const capture = async (
    unitId: AuditedUnit,
    mode: "idle" | "walk" | "attack",
    phase: number,
  ) => {
    const snapshot = await page.evaluate(({ unitId, mode, phase }) => {
      const control = (window as unknown as { __unitSandboxControl: SandboxControl }).__unitSandboxControl;
      control.setUnit(unitId);
      control.setTeam("player");
      control.setDirection("e");
      control.setMode(mode);
      control.setAutoplay(false);
      control.setManualPhase(phase);
      return control.snapshot();
    }, { unitId, mode, phase });
    await page.screenshot({
      path: `${ARTIFACT_DIR}/${unitId}-${mode}.png`,
      clip: { x: 365, y: 74, width: 813, height: 805 },
    });
    return snapshot;
  };

  const pikemanWalk = await capture("pikeman", "walk", 0.05);
  const pikemanAttack = await capture("pikeman", "attack", 0.5);
  const riflemanAttack = await capture("rifleman", "attack", 0.5);

  for (const unitId of [
    "bronze_swordsman",
    "bronze_spearman",
    "iron_swordsman",
    "iron_spearman",
    "rifleman_late",
  ] as const) {
    await capture(unitId, "walk", 0.05);
    await capture(unitId, "attack", 0.5);
  }

  expect(pikemanWalk.textureKeyResolved).toBe("pikeman-e-walk-01");
  expect(pikemanAttack.textureKeyResolved).toBe("pikeman-e-attack");
  expect(riflemanAttack.textureKeyResolved).toBe("rifleman-e-attack");
  expect(pikemanWalk.spriteHeight * (270 / 512)).toBeCloseTo(112);
  expect(pikemanAttack.spriteHeight * (270 / 384)).toBeCloseTo(112);
  expect(riflemanAttack.spriteHeight * (270 / 384)).toBeCloseTo(112 * 0.98);
});

test("pikeman attack keeps its body-ground origin in the game scene", async ({ page }) => {
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

  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        prepareDirectionalAuditProbe: (unitId: "pikeman", team: "player", direction: -1) => void;
        setAttackVisualPhase: (unitId: "pikeman", team: "player", phase: number) => void;
        setPaused: (paused: boolean) => void;
      };
    }).__terrainPrototypeControl;
    control.prepareDirectionalAuditProbe("pikeman", "player", -1);
    control.setAttackVisualPhase("pikeman", "player", 0.5);
    control.setPaused(true);
  });

  const unit = await page.evaluate(() => (
    (window as unknown as {
      __gameDebug: { units: Array<{
        unitId: string;
        renderTexture: string;
        presentation: { originX: number; originY: number };
      }> };
    }).__gameDebug.units.find((entry) => entry.unitId === "pikeman")
  ));
  await page.screenshot({ path: `${ARTIFACT_DIR}/pikeman-game-attack.png` });

  expect(unit?.renderTexture).toBe("pikeman-e-attack");
  expect(unit?.presentation.originX).toBeCloseTo(253 / 1024);
  expect(unit?.presentation.originY).toBeCloseTo(336 / 384);
});
