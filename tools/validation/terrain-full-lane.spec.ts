import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/terrain-full-lane";
const CAPTURE_PHASE = process.env.TERRAIN_CAPTURE_PHASE === "before" ? "before" : "after";
const GAME_URL = "/?terrain=prototype-v2&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-central-v1";

async function clickCanvasLogical(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not visible");
  await canvas.click({ position: { x: x * box.width / 1600, y: y * box.height / 900 } });
}

type VerificationSnapshot = Record<string, unknown> & {
  verification?: Record<string, unknown>;
};

function canonicalGameplaySnapshot(snapshot: VerificationSnapshot): VerificationSnapshot {
  const copy = structuredClone(snapshot);
  delete copy.elapsedSec;
  delete copy.verification?.terrainMode;
  delete copy.verification?.prototypePreset;
  delete copy.verification?.presentation;
  if (Array.isArray(copy.units)) {
    copy.units = copy.units.map((unit) => {
      const canonicalUnit = { ...(unit as Record<string, unknown>) };
      delete canonicalUnit.facingX;
      delete canonicalUnit.flipX;
      delete canonicalUnit.motion;
      delete canonicalUnit.pose;
      return canonicalUnit;
    });
  }
  return copy;
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));

test(`captures the ${CAPTURE_PHASE} full-lane terrain state without changing gameplay`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  await clickCanvasLogical(page, 800, 805);
  await page.waitForFunction(() => (
    (window as unknown as { __gameDebug?: { phase?: string } }).__gameDebug?.phase === "lane-siege"
  ));
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));

  await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        setPaused: (paused: boolean) => void;
        focusCentral: () => void;
      };
    }).__terrainPrototypeControl;
    control.setPaused(true);
    control.focusCentral();
  });
  await page.waitForTimeout(50);

  const snapshots = await page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: {
        setMode: (mode: "legacy" | "prototype-v2") => void;
        snapshot: () => Record<string, unknown>;
      };
    }).__terrainPrototypeControl;
    control.setMode("prototype-v2");
    const prototypeV2 = control.snapshot();
    control.setMode("legacy");
    const legacy = control.snapshot();
    control.setMode("prototype-v2");
    return { prototypeV2, legacy };
  });

  expect(canonicalGameplaySnapshot(snapshots.prototypeV2)).toEqual(
    canonicalGameplaySnapshot(snapshots.legacy),
  );
  const verification = snapshots.prototypeV2.verification as {
    terrain: {
      mapSpecId: string;
      patchCount: number;
      cellCount: number;
      structureSocketCount: number;
    };
  };
  expect(verification.terrain.mapSpecId).toBe("warcrest-full-lane-hybrid-v1");
  expect(verification.terrain.patchCount).toBe(4);
  expect(verification.terrain.cellCount).toBeGreaterThan(300);
  expect(verification.terrain.structureSocketCount).toBe(2);
  expect(errors).toEqual([]);

  await page.screenshot({ path: `${ARTIFACT_DIR}/${CAPTURE_PHASE}-central.png` });
  if (CAPTURE_PHASE === "after") {
    for (const [label, progress] of [
      ["player-side", 0.2],
      ["middle", 0.5],
      ["enemy-side", 0.84],
    ] as const) {
      await page.evaluate((nextProgress) => {
        const control = (window as unknown as {
          __terrainPrototypeControl: { focusProgress: (progress: number) => void };
        }).__terrainPrototypeControl;
        control.focusProgress(nextProgress);
      }, progress);
      await page.waitForTimeout(40);
      await page.screenshot({ path: `${ARTIFACT_DIR}/after-${label}.png` });
    }
  }
  writeFileSync(
    `${ARTIFACT_DIR}/${CAPTURE_PHASE}-snapshot.json`,
    JSON.stringify(snapshots, null, 2),
  );
});

test("terrain keyboard cycling is absent in normal play and available behind the QA flag", async ({ page }) => {
  const start = async (url: string): Promise<void> => {
    await page.goto(url);
    await clickCanvasLogical(page, 800, 805);
    await page.waitForFunction(() => Boolean(
      (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
    ));
  };
  const terrainMode = (): Promise<string> => page.evaluate(() => {
    const control = (window as unknown as {
      __terrainPrototypeControl: { snapshot: () => { verification: { terrainMode: string } } };
    }).__terrainPrototypeControl;
    return control.snapshot().verification.terrainMode;
  });

  await start(GAME_URL);
  expect(await terrainMode()).toBe("prototype-v2");
  await page.keyboard.press("KeyT");
  expect(await terrainMode()).toBe("prototype-v2");

  await start(`${GAME_URL}&terrainDebug=1`);
  expect(await terrainMode()).toBe("prototype-v2");
  await page.keyboard.press("KeyT");
  expect(await terrainMode()).toBe("world-surface");
});
