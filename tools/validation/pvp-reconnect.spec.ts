import { expect, test, type Page } from "@playwright/test";

/**
 * A player who drops out and comes back rejoins the same match, on the same
 * side, caught up to where it had got to.
 *
 * Driven through the real relay and two real browser contexts, because the
 * thing under test is the handover: the relay holding a seat, the log it keeps,
 * and the client rebuilding the game from the seed plus that log. A stub of any
 * of those would test the stub.
 */
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1";

test.describe.configure({ timeout: 240_000 });

async function clickByLabel(page: Page, label: string): Promise<void> {
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
        text?: string; visible?: boolean; getBounds?: () => Phaser.Geom.Rectangle;
      })[];
      const label = list.find((child) => child.text === text && child.visible);
      if (!label?.getBounds) continue;
      const centre = label.getBounds();
      const hits = list
        .filter((child) => child.visible && child.listenerCount?.("pointerdown") > 0 && child.getBounds)
        .map((child) => ({ child, bounds: (child.getBounds as () => Phaser.Geom.Rectangle)() }))
        .filter(({ bounds }) => bounds.contains(centre.centerX, centre.centerY))
        .sort((a, b) => a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height);
      if (hits.length === 0) continue;
      hits[0].child.emit("pointerdown");
      return;
    }
    throw new Error(`no pressable object under "${text}"`);
  }, label);
}

const waitForMatch = (page: Page): Promise<void> => page.waitForFunction(() => {
  const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
  return Boolean(game.scene.getScene("run")?.scene.isActive());
}, undefined, { timeout: 60_000 }).then(() => undefined);

const matchState = (page: Page) => page.evaluate(() => {
  const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
  const scene = game.scene.getScene("run") as unknown as {
    simTick: number;
    activeSeed: string;
    match?: { localTeam: string };
  };
  return { tick: scene.simTick, seed: scene.activeSeed, team: scene.match?.localTeam };
});

test("a returning player rejoins the same match on the same side", async ({ browser }) => {
  // Separate contexts: the player id lives in localStorage, and two tabs of one
  // profile would claim the same identity.
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));

  for (const page of pages) {
    await page.setViewportSize({ width: 1400, height: 820 });
    await page.goto(GAME_URL);
    await page.waitForFunction(() => Boolean((window as unknown as { __warcrestGame?: unknown }).__warcrestGame));
    await clickByLabel(page, "온라인 대전");
  }
  for (const page of pages) await clickByLabel(page, "상대 찾기");
  await Promise.all(pages.map(waitForMatch));

  const [leaverBefore, stayer] = await Promise.all(pages.map(matchState));
  expect(leaverBefore.team).not.toBe(stayer.team);

  // Let the match accumulate some history to replay.
  await pages[0].waitForTimeout(4000);
  const progressed = await matchState(pages[0]);
  expect(progressed.tick, "no history to replay").toBeGreaterThan(0);

  // Drop out the way a closed tab does, then come back in the same context so
  // the stored player id is the same one the relay is holding a seat for.
  await pages[0].close();
  const returning = await contexts[0].newPage();
  await returning.setViewportSize({ width: 1400, height: 820 });
  await returning.goto(GAME_URL);
  await returning.waitForFunction(() => Boolean((window as unknown as { __warcrestGame?: unknown }).__warcrestGame));
  await clickByLabel(returning, "온라인 대전");

  // No "상대 찾기" here: identifying is enough, and queueing again would be the
  // wrong thing — the point is to be put back, not matched with someone new.
  await waitForMatch(returning);
  const resumed = await matchState(returning);

  expect(resumed.seed, "rejoined a different match").toBe(leaverBefore.seed);
  expect(resumed.team, "came back on the wrong side").toBe(leaverBefore.team);
  // Replayed rather than restarted: the catch-up runs before the first frame is
  // drawn, so the tick count is already past zero.
  expect(resumed.tick, "resumed from the start instead of catching up").toBeGreaterThan(0);

  await Promise.all(contexts.map((context) => context.close()));
});
