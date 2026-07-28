import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/day6-combat-polish";
const CAPTURE_PHASE = process.env.DAY6_CAPTURE_PHASE ?? "after";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-day6-combat";

type UnitId = "stone_axeman" | "stone_slinger" | "supply_wagon" | "bronze_spearman";
type Role = "melee" | "ranged" | "support";

type DebugUnit = {
  unitId: string;
  team: "player" | "enemy";
  hp: number;
  maxHp: number;
  attackAnimTime: number;
  pose: string;
  attackTiming: { durationSec: number; eventProgress: number; eventDelayMs: number };
};

type Snapshot = {
  units: DebugUnit[];
  activeProjectiles: Array<{ textureKey: string }>;
  battlefield: { defenseTowers: Array<{ id: number; hp: number }> };
};

type CombatControl = {
  focusAttackPair(unitId: UnitId, team: "player"): void;
  prepareSupportProbe(): void;
  setPaused(paused: boolean): void;
  setAttackVisualPhase(unitId: UnitId, team: "player", phase: number): void;
  prepareUnitAttackProbe(unitId: "stone_axeman" | "stone_slinger" | "bronze_spearman"): void;
  prepareStructureAttackProbe(unitId: "stone_axeman" | "stone_slinger"): void;
  prepareTowerConstructionProbe(): void;
};

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function openGame(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await page.waitForTimeout(1_000);
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.894 } });
    await page.waitForTimeout(750);
    if (await page.evaluate(() => Boolean(
      (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
    ))) return;
  }
  throw new Error("Battlefield control did not initialize");
}

const snapshot = (page: import("@playwright/test").Page): Promise<Snapshot> => page.evaluate(() => (
  (window as unknown as { __gameDebug: Snapshot }).__gameDebug
));

test(`captures ${CAPTURE_PHASE} role-specific attack silhouettes`, async ({ page }) => {
  await openGame(page);
  const metrics: Record<string, unknown> = {};
  for (const [role, unitId] of [
    ["melee", "stone_axeman"],
    ["ranged", "stone_slinger"],
    ["support", "supply_wagon"],
  ] as const satisfies ReadonlyArray<readonly [Role, UnitId]>) {
    await page.evaluate(({ nextRole, nextUnit }) => {
      const control = (window as unknown as { __terrainPrototypeControl: CombatControl })
        .__terrainPrototypeControl;
      if (nextRole === "support") control.prepareSupportProbe();
      else control.focusAttackPair(nextUnit, "player");
      control.setPaused(true);
    }, { nextRole: role, nextUnit: unitId });

    const roleMetrics: unknown[] = [];
    for (const [label, phase] of [
      ["windup", 0.2],
      ["event", role === "ranged" ? 0.42 : role === "support" ? 0.52 : 0.5],
      ["recover", 0.84],
    ] as const) {
      await page.evaluate(({ nextUnit, nextPhase }) => {
        (window as unknown as { __terrainPrototypeControl: CombatControl })
          .__terrainPrototypeControl.setAttackVisualPhase(nextUnit, "player", nextPhase);
      }, { nextUnit: unitId, nextPhase: phase });
      const unit = (await snapshot(page)).units.find((entry) => (
        entry.unitId === unitId && entry.team === "player"
      ));
      expect(unit).toBeDefined();
      roleMetrics.push({ label, phase, pose: unit?.pose, attackAnimTime: unit?.attackAnimTime });
      await page.screenshot({ path: `${ARTIFACT_DIR}/${CAPTURE_PHASE}-${role}-${label}.png` });
    }
    metrics[role] = roleMetrics;
    await page.evaluate(() => {
      (window as unknown as { __terrainPrototypeControl: CombatControl })
        .__terrainPrototypeControl.setPaused(false);
    });
  }
  writeFileSync(
    `${ARTIFACT_DIR}/${CAPTURE_PHASE}-role-sequence.json`,
    JSON.stringify(metrics, null, 2),
  );

  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl.prepareUnitAttackProbe("bronze_spearman");
  });
  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl.setAttackVisualPhase("bronze_spearman", "player", 0.48);
  });
  const spearman = (await snapshot(page)).units.find((unit) => unit.unitId === "bronze_spearman");
  expect(spearman?.pose).toBe("bronze-spearman-attack");
  expect(spearman?.attackTiming.eventProgress).toBe(0.48);
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-bronze-spearman-contact.png` });
});

test("aligns unit melee contact and ranged release with gameplay events", async ({ page }) => {
  await openGame(page);
  const results: Record<string, unknown> = {};

  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl;
    control.prepareUnitAttackProbe("stone_axeman");
  });
  const meleeBefore = await snapshot(page);
  const meleeHpBefore = meleeBefore.units.find((unit) => unit.team === "enemy")?.hp ?? 0;
  const meleeStartedAt = Date.now();
  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl.setPaused(false);
  });
  await page.waitForFunction(() => (
    (window as unknown as { __gameDebug: Snapshot }).__gameDebug.units
      .some((unit) => unit.team === "player" && unit.attackAnimTime > 0)
  ));
  expect((await snapshot(page)).units.find((unit) => unit.team === "enemy")?.hp).toBe(meleeHpBefore);
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-unit-melee-windup.png` });
  await page.waitForFunction((before) => (
    ((window as unknown as { __gameDebug: Snapshot }).__gameDebug.units
      .find((unit) => unit.team === "enemy")?.hp ?? before) < before
  ), meleeHpBefore);
  const meleeContactDelayMs = Date.now() - meleeStartedAt;
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-unit-melee-contact.png` });

  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl.prepareUnitAttackProbe("stone_slinger");
  });
  const rangedHpBefore = (await snapshot(page)).units.find((unit) => unit.team === "enemy")?.hp ?? 0;
  const rangedStartedAt = Date.now();
  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl.setPaused(false);
  });
  await page.waitForFunction(() => (
    (window as unknown as { __gameDebug: Snapshot }).__gameDebug.activeProjectiles.length > 0
  ));
  const rangedRelease = await snapshot(page);
  expect(rangedRelease.units.find((unit) => unit.team === "enemy")?.hp).toBe(rangedHpBefore);
  const rangedReleaseDelayMs = Date.now() - rangedStartedAt;
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-unit-ranged-release.png` });
  await page.waitForFunction((before) => (
    ((window as unknown as { __gameDebug: Snapshot }).__gameDebug.units
      .find((unit) => unit.team === "enemy")?.hp ?? before) < before
  ), rangedHpBefore);
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-unit-ranged-hit.png` });

  results.melee = {
    hpBefore: meleeHpBefore,
    configuredContactDelayMs: meleeBefore.units.find((unit) => unit.team === "player")?.attackTiming.eventDelayMs,
    observedCaptureWallMs: meleeContactDelayMs,
  };
  results.ranged = {
    hpBefore: rangedHpBefore,
    configuredReleaseDelayMs: rangedRelease.units.find((unit) => unit.team === "player")?.attackTiming.eventDelayMs,
    observedCaptureWallMs: rangedReleaseDelayMs,
    projectileCountAtRelease: rangedRelease.activeProjectiles.length,
  };
  writeFileSync(`${ARTIFACT_DIR}/unit-event-timing.json`, JSON.stringify(results, null, 2));
});

test("applies support healing at the cast event rather than windup", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl.prepareSupportProbe();
  });
  const hpTotal = (state: Snapshot): number => state.units
    .filter((unit) => unit.team === "player" && unit.unitId !== "supply_wagon")
    .reduce((sum, unit) => sum + unit.hp, 0);
  const before = await snapshot(page);
  const hpBefore = hpTotal(before);
  const startedAt = Date.now();
  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl.setPaused(false);
  });
  await page.waitForFunction(() => (
    (window as unknown as { __gameDebug: Snapshot }).__gameDebug.units
      .some((unit) => unit.unitId === "supply_wagon" && unit.attackAnimTime > 0)
  ));
  expect(hpTotal(await snapshot(page))).toBe(hpBefore);
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-support-cast-windup.png` });
  await page.waitForFunction((initialHp) => {
    const state = (window as unknown as { __gameDebug: Snapshot }).__gameDebug;
    return state.units
      .filter((unit) => unit.team === "player" && unit.unitId !== "supply_wagon")
      .reduce((sum, unit) => sum + unit.hp, 0) > initialHp;
  }, hpBefore);
  const after = await snapshot(page);
  const castDelayMs = Date.now() - startedAt;
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-support-cast-event.png` });
  writeFileSync(`${ARTIFACT_DIR}/support-event-timing.json`, JSON.stringify({
    hpBefore,
    hpAfter: hpTotal(after),
    configuredCastDelayMs: before.units.find((unit) => unit.unitId === "supply_wagon")?.attackTiming.eventDelayMs,
    observedCaptureWallMs: castDelayMs,
  }, null, 2));
});

test("keeps structure contact distinct from unit contact", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl.prepareStructureAttackProbe("stone_axeman");
  });
  const hpBefore = (await snapshot(page)).battlefield.defenseTowers[1].hp;
  await page.waitForFunction(() => (
    (window as unknown as { __gameDebug: Snapshot }).__gameDebug.units
      .some((unit) => unit.attackAnimTime > 0)
  ));
  expect((await snapshot(page)).battlefield.defenseTowers[1].hp).toBe(hpBefore);
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-structure-melee-windup.png` });
  await page.waitForFunction((before) => (
    (window as unknown as { __gameDebug: Snapshot }).__gameDebug.battlefield.defenseTowers[1].hp < before
  ), hpBefore);
  await page.screenshot({ path: `${ARTIFACT_DIR}/after-structure-melee-contact.png` });
});

test("captures the construction tower without combat occlusion", async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    (window as unknown as { __terrainPrototypeControl: CombatControl })
      .__terrainPrototypeControl.prepareTowerConstructionProbe();
  });
  await page.screenshot({ path: `${ARTIFACT_DIR}/tower-construction-peacetime-review.png` });
});
