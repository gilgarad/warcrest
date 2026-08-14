import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ARTIFACT_DIR = "artifacts/simulation-determinism";
const SEED = "determinism-probe-v1";
const GAME_URL = `/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1&autostart=1&seed=${SEED}`;

/** How many simulation ticks each run advances, and how often it records. */
const TICKS = 900; // 30s of simulated time at 1/30s per tick
const SAMPLE_EVERY = 30;

interface HashSample { tick: number; hash: number }

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));
test.describe.configure({ timeout: 300_000 });

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
}

/**
 * Drives the simulation by hand instead of letting it run on real time.
 *
 * Wall-clock stepping would make this test measure the machine's frame pacing
 * rather than the simulation, and a slow frame would change how many ticks
 * elapsed between samples. Stepping explicitly is also exactly what a lockstep
 * client does.
 */
async function recordHashes(page: Page): Promise<HashSample[]> {
  return page.evaluate(({ ticks, sampleEvery }) => {
    const scene = (window as unknown as {
      __warcrestGame: { scene: { getScene: (key: string) => Record<string, unknown> } };
    }).__warcrestGame.scene.getScene("run");
    const control = (window as unknown as {
      __terrainPrototypeControl: { getSimulationHash: () => { tick: number; hash: number } };
    }).__terrainPrototypeControl;

    // Step the simulation runtime directly. It owns the tick clock, the RNG and
    // the command queue, so this is the same path a real frame takes minus the
    // wall-clock accumulator — which is the point: no real time may elapse.
    const simulation = scene.simulation as { step: () => void };
    const samples: { tick: number; hash: number }[] = [];
    for (let i = 0; i < ticks; i += 1) {
      simulation.step();
      if ((i + 1) % sampleEvery === 0) samples.push(control.getSimulationHash());
    }
    return samples;
  }, { ticks: TICKS, sampleEvery: SAMPLE_EVERY });
}

test("the same seed replays to the same simulation state", async ({ browser }) => {
  // Two independent pages, so the second run cannot inherit anything from the
  // first beyond the seed in the URL.
  const runs: HashSample[][] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const page = await browser.newPage();
    await openGame(page);
    runs.push(await recordHashes(page));
    await page.close();
  }

  const [first, second] = runs;
  expect(first.length).toBe(TICKS / SAMPLE_EVERY);
  expect(second.map((sample) => sample.tick)).toEqual(first.map((sample) => sample.tick));

  const firstDivergence = first.findIndex((sample, index) => sample.hash !== second[index].hash);
  expect(
    firstDivergence,
    firstDivergence === -1
      ? ""
      : `simulation diverged at tick ${first[firstDivergence].tick}: `
        + `${first[firstDivergence].hash} vs ${second[firstDivergence].hash}`,
  ).toBe(-1);

  writeFileSync(
    `${ARTIFACT_DIR}/replay-hashes.json`,
    JSON.stringify({ seed: SEED, ticks: TICKS, sampleEvery: SAMPLE_EVERY, hashes: first }, null, 2),
  );
});

test("a different seed produces a different simulation", async ({ browser }) => {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL.replace(SEED, "determinism-probe-v2"));
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __terrainPrototypeControl?: unknown }).__terrainPrototypeControl,
  ));
  const other = await recordHashes(page);
  await page.close();

  const baselinePage = await browser.newPage();
  await openGame(baselinePage);
  const baseline = await recordHashes(baselinePage);
  await baselinePage.close();

  // Guards against a hash that returns a constant, which would make the test
  // above pass no matter how badly the simulation diverged.
  expect(other.some((sample, index) => sample.hash !== baseline[index].hash)).toBe(true);
});
