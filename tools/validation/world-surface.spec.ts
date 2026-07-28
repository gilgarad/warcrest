import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/world-surface";
const GAME_URL = "/?terrain=world-surface&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-world-surface-v1";

type Snapshot = Record<string, unknown> & { verification?: Record<string, unknown> };

function canonicalGameplaySnapshot(snapshot: Snapshot): Snapshot {
  const copy = structuredClone(snapshot);
  delete copy.elapsedSec;
  delete copy.verification?.terrainMode;
  delete copy.verification?.presentation;
  if (Array.isArray(copy.units)) {
    copy.units = copy.units.map((unit) => {
      const next = { ...(unit as Record<string, unknown>) };
      delete next.facingX;
      delete next.flipX;
      delete next.motion;
      delete next.pose;
      return next;
    });
  }
  const battlefield = copy.battlefield as { controlPoints?: unknown[] } | undefined;
  if (Array.isArray(battlefield?.controlPoints)) {
    battlefield.controlPoints = battlefield.controlPoints.map((point) => {
      const next = { ...(point as Record<string, unknown>) };
      delete next.labelWorldX;
      delete next.labelWorldY;
      delete next.markerTexture;
      return next;
    });
  }
  return copy;
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

async function enterBattlefield(page: import("@playwright/test").Page): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.894 } });
    await page.waitForTimeout(500);
    const ready = await page.evaluate(() => Boolean(
      (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
    ));
    if (ready) return;
  }
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

test("captures baked-matte versus opaque world-surface at four identical camera positions", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  await enterBattlefield(page);
  await page.evaluate(() => (
    (window as unknown as { __terrainPrototypeControl: { setPaused: (paused: boolean) => void } })
      .__terrainPrototypeControl.setPaused(true)
  ));

  const snapshots = await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        setMode: (mode: "prototype-v2" | "world-surface") => void;
        snapshot: () => Snapshot;
      };
    }).__terrainPrototypeControl;
    control.setMode("prototype-v2");
    const before = control.snapshot();
    control.setMode("world-surface");
    const after = control.snapshot();
    return { before, after };
  });
  expect(canonicalGameplaySnapshot(snapshots.after)).toEqual(canonicalGameplaySnapshot(snapshots.before));

  for (const [label, progress] of [
    ["player", 0.12],
    ["middle", 0.5],
    ["central", 0.588],
    ["enemy", 0.88],
  ] as const) {
    for (const mode of ["prototype-v2", "world-surface"] as const) {
      await page.evaluate(({ nextMode, nextProgress }) => {
        const control = (window as unknown as {
          __terrainPrototypeControl: {
            setMode: (mode: "prototype-v2" | "world-surface") => void;
            focusProgress: (progress: number) => void;
          };
        }).__terrainPrototypeControl;
        control.setMode(nextMode);
        control.focusProgress(nextProgress);
      }, { nextMode: mode, nextProgress: progress });
      await page.waitForTimeout(80);
      await page.screenshot({ path: `${ARTIFACT_DIR}/${mode}-${label}.png` });
    }
  }

  writeFileSync(`${ARTIFACT_DIR}/gameplay-equivalence.json`, JSON.stringify(snapshots, null, 2));
});

test("captures production terrain at 1x and 2x device scale", async ({ browser }) => {
  test.setTimeout(90_000);
  for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({
      deviceScaleFactor,
      // Keep the 2x software-WebGL surface bounded while comparing identical
      // CSS pixels at both device scales.
      viewport: { width: 1024, height: 576 },
    });
    const page = await context.newPage();
    await page.goto(GAME_URL);
    await enterBattlefield(page);
    await page.evaluate(() => {
      const control = (window as unknown as {
        __terrainPrototypeControl: {
          setMode: (mode: "world-surface") => void;
          setPaused: (paused: boolean) => void;
          focusProgress: (progress: number) => void;
        };
      }).__terrainPrototypeControl;
      control.setMode("world-surface");
      control.setPaused(true);
      control.focusProgress(0.588);
    });
    await page.waitForTimeout(80);
    await page.screenshot({
      path: `${ARTIFACT_DIR}/production-terrain-${deviceScaleFactor}x.png`,
      scale: "css",
    });
    await context.close();
  }
});
