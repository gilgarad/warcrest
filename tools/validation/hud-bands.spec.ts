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
 *
 * Measured against the *interactive* controls rather than everything drawn. The
 * decorative HUD frame is one image whose bounds run far past the pixels it
 * actually paints -- most of that area is transparent, with the battlefield
 * showing through -- so requiring the bands to cover it would drag them across
 * open ground that the player can and should be able to touch.
 */
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1&autostart=1";

/**
 * How much slack a band may carry beyond the outermost control.
 *
 * Generous, because the controls sit inside a painted frame and the band has to
 * cover the frame too. It is still tight enough to catch the failure this
 * exists for: the scene's old literal put the top band 94 units below the last
 * control with nothing drawn in between.
 */
const MAX_DEAD_MARGIN = 120;

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
        listenerCount?: (event: string) => number;
      };
      if (!object.visible || object.scrollFactorX !== 0 || !object.getBounds) continue;
      if ((object.listenerCount?.("pointerdown") ?? 0) === 0) continue;
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
    `top band ends at ${measured.bands.topBelow} but a control reaches ${measured.topMaxBottom}`,
  ).toBeGreaterThanOrEqual(measured.topMaxBottom);
  expect(
    measured.bands.topBelow - measured.topMaxBottom,
    "top band leaves dead ground below the HUD",
  ).toBeLessThanOrEqual(MAX_DEAD_MARGIN);

  expect(
    measured.bands.bottomAbove,
    `bottom band starts at ${measured.bands.bottomAbove} but a control reaches ${measured.bottomMinTop}`,
  ).toBeLessThanOrEqual(measured.bottomMinTop);
  expect(
    measured.bottomMinTop - measured.bands.bottomAbove,
    "bottom band leaves dead ground above the HUD",
  ).toBeLessThanOrEqual(MAX_DEAD_MARGIN);
});
