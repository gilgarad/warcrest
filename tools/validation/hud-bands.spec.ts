import { expect, test } from "@playwright/test";

/**
 * The HUD's declared bands must match what it actually draws.
 *
 * The scene decides "was that a press on the HUD or a tap on the field?" from
 * these two numbers, and they used to be the scene's own guesses. They drifted:
 * the top guess sat 94 units below the last HUD pixel, so a strip under the
 * panel pressed nothing and selected nothing. The same class of mistake closed
 * the research panel under its own buttons.
 *
 * Bands that are too small let a press fall through onto the battlefield; bands
 * that are too large create dead ground. Both are checked.
 */
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1&autostart=1";

/** How much slack a band may carry beyond the pixels it covers. */
const MAX_DEAD_MARGIN = 24;

test.describe.configure({ timeout: 200_000 });

test("the HUD's bands cover the HUD and no more", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => {
    const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
    return Boolean(game?.scene.getScene("run")?.scene.isActive());
  }, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1200);

  const measured = await page.evaluate(() => {
    const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
    const scene = game.scene.getScene("run") as unknown as {
      children: Phaser.GameObjects.DisplayList;
      hud: { getUiBands: () => { topBelow: number; bottomAbove: number } };
    };
    const bands = scene.hud.getUiBands();

    // Screen-fixed objects only: anything that scrolls is battlefield.
    const extents = { topMaxBottom: -Infinity, bottomMinTop: Infinity };
    for (const child of scene.children.list) {
      const object = child as Phaser.GameObjects.GameObject & {
        visible?: boolean;
        scrollFactorX?: number;
        getBounds?: () => Phaser.Geom.Rectangle;
      };
      if (!object.visible || object.scrollFactorX !== 0 || !object.getBounds) continue;
      const bounds = object.getBounds();
      if (bounds.width <= 0 || bounds.height <= 0) continue;
      // Controls parked off-screen until needed would drag the extents away.
      if (bounds.left < -500 || bounds.top < -500) continue;
      if (bounds.bottom < 450) extents.topMaxBottom = Math.max(extents.topMaxBottom, bounds.bottom);
      if (bounds.top >= 450) extents.bottomMinTop = Math.min(extents.bottomMinTop, bounds.top);
    }
    return { bands, ...extents };
  });

  expect(
    measured.bands.topBelow,
    `top band ends at ${measured.bands.topBelow} but the HUD draws to ${measured.topMaxBottom}`,
  ).toBeGreaterThanOrEqual(measured.topMaxBottom);
  expect(
    measured.bands.topBelow - measured.topMaxBottom,
    "top band leaves dead ground below the HUD",
  ).toBeLessThanOrEqual(MAX_DEAD_MARGIN);

  expect(
    measured.bands.bottomAbove,
    `bottom band starts at ${measured.bands.bottomAbove} but the HUD draws from ${measured.bottomMinTop}`,
  ).toBeLessThanOrEqual(measured.bottomMinTop);
  expect(
    measured.bottomMinTop - measured.bands.bottomAbove,
    "bottom band leaves dead ground above the HUD",
  ).toBeLessThanOrEqual(MAX_DEAD_MARGIN);
});
