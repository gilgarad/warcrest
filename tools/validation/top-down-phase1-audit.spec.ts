import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/top-down-phase1-audit";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-top-down-phase1-before";

type AuditControl = {
  setPaused(paused: boolean): void;
  setVisualAuditLayer(layer: "ground" | "props" | "units" | "combat"): void;
  prepareVisualAuditCombat(): void;
  stepVisualAuditCombat(deltaSec: number): void;
  snapshot(): Record<string, unknown>;
};

function compactSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  const units = Array.isArray(snapshot.units)
    ? snapshot.units.map((unit) => {
      const entry = unit as Record<string, unknown>;
      return {
        id: entry.id,
        team: entry.team,
        unitId: entry.unitId,
        pose: entry.pose,
        hp: entry.hp,
        maxHp: entry.maxHp,
        attackAnimTime: entry.attackAnimTime,
        attackTargetKind: entry.attackTargetKind,
      };
    })
    : [];
  return {
    battlefield: snapshot.battlefield,
    verification: snapshot.verification,
    units,
  };
}

async function enterBattlefield(page: import("@playwright/test").Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: AuditControl })
      .__terrainPrototypeControl;
    control.setPaused(true);
  });
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));
test.setTimeout(120_000);

test("freezes the four current high-oblique visual layers before top-down work", async ({ page }) => {
  const snapshots: Record<string, unknown> = {};
  for (const layer of ["ground", "props", "units"] as const) {
    await enterBattlefield(page);
    const snapshot = await page.evaluate((nextLayer) => {
      const control = (window as unknown as { __terrainPrototypeControl: AuditControl })
        .__terrainPrototypeControl;
      control.setVisualAuditLayer(nextLayer);
      return control.snapshot();
    }, layer);
    snapshots[layer] = compactSnapshot(snapshot);
    await page.waitForTimeout(80);
    await page.screenshot({ path: `${ARTIFACT_DIR}/before-${layer}.png` });
  }

  await enterBattlefield(page);
  await page.evaluate(() => {
    const control = (window as unknown as { __terrainPrototypeControl: AuditControl })
      .__terrainPrototypeControl;
    control.prepareVisualAuditCombat();
    control.setVisualAuditLayer("combat");
  });
  const combatFrames: unknown[] = [];
  for (let frame = 0; frame < 8; frame += 1) {
    const snapshot = await page.evaluate(() => {
      const control = (window as unknown as { __terrainPrototypeControl: AuditControl })
        .__terrainPrototypeControl;
      control.stepVisualAuditCombat(0.06);
      return control.snapshot();
    });
    combatFrames.push(compactSnapshot(snapshot));
    await page.screenshot({ path: `${ARTIFACT_DIR}/before-combat-${String(frame + 1).padStart(2, "0")}.png` });
  }

  const units = (combatFrames[combatFrames.length - 1] as { units?: unknown[] }).units ?? [];
  expect(units).toHaveLength(2);
  writeFileSync(
    `${ARTIFACT_DIR}/before-audit-snapshots.json`,
    JSON.stringify({
      baseline: snapshots.units,
      layerUnitCounts: Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [
        key,
        ((value as { units?: unknown[] }).units ?? []).length,
      ])),
      combatFrames: combatFrames.map((frame) => ({
        units: (frame as { units?: unknown[] }).units ?? [],
      })),
    }, null, 2),
  );
});
