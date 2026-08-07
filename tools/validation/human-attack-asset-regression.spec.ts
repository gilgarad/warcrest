import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SANDBOX_URL = "/game_project1/?sandbox=1";
const ARTIFACT_DIR = "artifacts/human-3frame-v2/final-attack-audit";

type SandboxControl = {
  setUnit: (unitId: "pikeman" | "rifleman") => void;
  setTeam: (team: "player") => void;
  setDirection: (direction: "e") => void;
  setMode: (mode: "walk" | "attack") => void;
  setAutoplay: (autoplay: boolean) => void;
  setManualPhase: (phase: number) => void;
  snapshot: () => {
    textureKeyResolved: string;
    spriteWidth: number;
    spriteHeight: number;
  };
};

test("pikeman scale and attack assets render intact in the sandbox", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(SANDBOX_URL);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __unitSandboxControl?: unknown }).__unitSandboxControl,
  ));

  const capture = async (
    unitId: "pikeman" | "rifleman",
    mode: "walk" | "attack",
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
    await page.screenshot({ path: `${ARTIFACT_DIR}/${unitId}-${mode}.png` });
    return snapshot;
  };

  const pikemanWalk = await capture("pikeman", "walk", 0.05);
  const pikemanAttack = await capture("pikeman", "attack", 0.5);
  const riflemanAttack = await capture("rifleman", "attack", 0.5);

  expect(pikemanWalk.textureKeyResolved).toBe("pikeman-e-walk-01");
  expect(pikemanAttack.textureKeyResolved).toBe("pikeman-e-attack");
  expect(riflemanAttack.textureKeyResolved).toBe("rifleman-e-attack");
  expect(pikemanWalk.spriteHeight * (270 / 512)).toBeCloseTo(112);
  expect(pikemanAttack.spriteHeight * (270 / 384)).toBeCloseTo(112);
  expect(riflemanAttack.spriteHeight * (270 / 384)).toBeCloseTo(112 * 0.98);
});
