import { expect, test } from "@playwright/test";

/**
 * Both lanes and both bases are on screen at once.
 *
 * The point of the compact layout. Sizes and overlap were being measured but
 * nothing asked the simplest question -- is the thing you are meant to be
 * playing actually visible, and big enough to read?
 *
 * The framing half of that is close to self-fulfilling, since the zoom is solved
 * to fit the map: widen the layout and the camera simply pulls back. What the
 * layout actually decides is how large the pieces come out, so that is asserted
 * too, and it is the half with teeth -- on the wide layout a phone drew its
 * units 30 CSS px tall against 70 here.
 */
const GAME_URL = "/warcrest/?autostart=1";

const VIEWPORTS = [
  { name: "phone", width: 844, height: 390 },
  { name: "tablet", width: 1133, height: 744 },
  { name: "desktop", width: 1600, height: 900 },
];

test.describe.configure({ timeout: 400_000 });

for (const viewport of VIEWPORTS) {
  test(`${viewport.name}: the whole battlefield is in frame`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(GAME_URL);
    await page.waitForFunction(() => {
      const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
      return Boolean(game?.scene.getScene("run")?.scene.isActive());
    }, undefined, { timeout: 300_000 });
    await page.waitForTimeout(2000);

    const framing = await page.evaluate(() => {
      const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
      const scene = game.scene.getScene("run") as unknown as {
        cameras: Phaser.Cameras.Scene2D.CameraManager;
        mapSpec: { id: string; lanes: { path: { position: { x: number; y: number } }[] }[] };
        hud: { getUiBands: () => { topBelow: number; bottomAbove: number } };
      };
      const camera = scene.cameras.main;
      const view = camera.worldView;
      const bands = scene.hud.getUiBands();
      // The battlefield is only the strip the HUD leaves; a lane hidden behind
      // the action buttons is not visible in any useful sense.
      const strip = {
        left: view.x,
        right: view.right,
        top: view.y + bands.topBelow / camera.zoom,
        bottom: view.y + bands.bottomAbove / camera.zoom,
      };
      const points = scene.mapSpec.lanes.flatMap((lane) => lane.path.map((node) => node.position));
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const canvas = game.canvas.getBoundingClientRect();
      const cssScale = canvas.width / game.scale.gameSize.width;
      const sprites = (scene as unknown as { units: { sprite?: { visible: boolean; displayHeight: number } }[] })
        .units.filter((unit) => unit.sprite?.visible)
        .map((unit) => (unit.sprite as { displayHeight: number }).displayHeight * camera.zoom * cssScale);
      return {
        mapId: scene.mapSpec.id,
        zoom: Number(camera.zoom.toFixed(3)),
        lanes: { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) },
        strip,
        unitCssHeight: sprites.length > 0 ? Math.max(...sprites) : 0,
      };
    });

    const { lanes, strip } = framing;
    const detail = `zoom ${framing.zoom}, lanes ${JSON.stringify(lanes)}, strip ${JSON.stringify(strip)}`;
    expect(lanes.left, `left of the field is off screen — ${detail}`).toBeGreaterThanOrEqual(strip.left);
    expect(lanes.right, `right of the field is off screen — ${detail}`).toBeLessThanOrEqual(strip.right);
    expect(lanes.top, `the far lane is off screen — ${detail}`).toBeGreaterThanOrEqual(strip.top);
    expect(lanes.bottom, `the near lane is behind the HUD — ${detail}`).toBeLessThanOrEqual(strip.bottom);

    // A figure you cannot tell apart from another figure is not a unit you are
    // playing with. 48 CSS px is roughly where the silhouettes separate on a
    // phone held at arm's length.
    expect(
      framing.unitCssHeight,
      `units draw ${framing.unitCssHeight.toFixed(1)} CSS px tall — ${detail}`,
    ).toBeGreaterThanOrEqual(48);
  });
}
