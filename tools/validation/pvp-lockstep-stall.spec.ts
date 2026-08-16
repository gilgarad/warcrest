import { expect, test, type Page } from "@playwright/test";

/**
 * Measures whether both sides of a real PvP match actually advance.
 *
 * A stalled client is not visible from its own screen: presentation keeps
 * running (units lerp toward their last target, animations play) whether or not
 * the simulation is stepping, so "it looks like it is playing" proves nothing.
 * This reads the tick counter and the stall flag out of both scenes instead.
 */
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1";

test.describe.configure({ timeout: 180_000 });

/** Clicks a Phaser button by emitting on the object, not by pixel position. */
async function clickByLabel(page: Page, label: string): Promise<void> {
  // Waits for *visible*, not merely present: the menu builds its buttons hidden
  // and reveals them once the battle assets finish downloading, which on a cold
  // cache takes tens of seconds.
  await page.waitForFunction((text) => {
    const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
    if (!game) return false;
    return game.scene.getScenes(true).some((scene) => scene.children.list.some(
      (child) => (child as Phaser.GameObjects.Text).text === text
        && (child as Phaser.GameObjects.Text).visible,
    ));
  }, label, { timeout: 90_000 });

  await page.evaluate((text) => {
    const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
    for (const scene of game.scene.getScenes(true)) {
      const list = scene.children.list as (Phaser.GameObjects.GameObject & {
        text?: string;
        visible?: boolean;
        getBounds?: () => Phaser.Geom.Rectangle;
      })[];
      const label = list.find((child) => child.text === text && child.visible);
      if (!label?.getBounds) continue;
      const centre = label.getBounds();
      const x = centre.centerX;
      const y = centre.centerY;
      // Picking by geometry rather than by list adjacency: the handler lives on
      // the backing rectangle, and "the neighbouring entry in the display list"
      // is not reliably that rectangle — it once resolved to the panel's close
      // button, which silently dismissed the dialog instead of pressing it.
      const hits = list
        .filter((child) => child.visible && child.listenerCount?.("pointerdown") > 0 && child.getBounds)
        .map((child) => ({ child, bounds: (child.getBounds as () => Phaser.Geom.Rectangle)() }))
        .filter(({ bounds }) => bounds.contains(x, y))
        .sort((a, b) => a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height);
      if (hits.length === 0) continue;
      hits[0].child.emit("pointerdown");
      return;
    }
    throw new Error(`no pressable object under "${text}"`);
  }, label);
}

interface Reading { tick: number; stalled: boolean }

const read = (page: Page): Promise<Reading> => page.evaluate(() => {
  const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
  const scene = game.scene.getScene("run") as unknown as {
    simTick: number;
    netStalled: boolean;
    match?: { localTeam: string };
  };
  return { tick: scene.simTick, stalled: scene.netStalled };
});

const localTeam = (page: Page): Promise<string> => page.evaluate(() => {
  const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
  const scene = game.scene.getScene("run") as unknown as { match?: { localTeam: string } };
  return scene.match?.localTeam ?? "unknown";
});

test("both sides of a PvP match keep advancing", async ({ browser }) => {
  // Separate contexts: two tabs of one profile share localStorage, and the
  // player id lives there — worth keeping the sides genuinely distinct here.
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));

  for (const page of pages) {
    await page.setViewportSize({ width: 1400, height: 820 });
    await page.goto(GAME_URL);
    await page.waitForFunction(() => Boolean((window as unknown as { __warcrestGame?: unknown }).__warcrestGame));
    await clickByLabel(page, "온라인 대전");
  }
  for (const page of pages) await clickByLabel(page, "상대 찾기");

  for (const page of pages) {
    await page.waitForFunction(() => {
      const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
      return game.scene.getScene("run")?.scene.isActive();
    }, undefined, { timeout: 40_000 });
  }

  const teams = await Promise.all(pages.map(localTeam));
  expect(teams.slice().sort()).toEqual(["enemy", "player"]);

  const first = await Promise.all(pages.map(read));
  await pages[0].waitForTimeout(6000);
  const second = await Promise.all(pages.map(read));

  const advanced = second.map((reading, index) => reading.tick - first[index].tick);
  const report = teams.map((team, index) =>
    `${team}: +${advanced[index]} ticks (now ${second[index].tick}, stalled=${second[index].stalled})`).join("; ");

  // Deliberately not asserting a tick *rate*. Under software GL this browser
  // renders at ~4fps and the tick clock is driven by rendered frames, so a
  // healthy match legitimately crawls here; requiring 30Hz would only measure
  // the machine. What is environment-independent is the failure this test exists
  // for: one side stopping while the other keeps going.
  for (const [index, gained] of advanced.entries()) {
    expect(gained, `${teams[index]} made no progress at all — ${report}`).toBeGreaterThan(3);
  }
  const [slow, fast] = [...advanced].sort((a, b) => a - b);
  expect(slow * 3, `the two sides advanced at very different rates — ${report}`)
    .toBeGreaterThanOrEqual(fast);

  await Promise.all(contexts.map((context) => context.close()));
});
