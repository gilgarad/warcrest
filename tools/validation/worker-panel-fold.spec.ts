import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Worker allocation folds away, and folding it actually gives screen back.
 *
 * The rows are the tallest thing in the bottom band and the least often
 * touched, so they are the obvious thing to hide -- but hiding controls without
 * shrinking the band would be theatre. The band is checked alongside.
 */
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1&autostart=1";
const DIR = "artifacts/worker-panel";

test.beforeAll(() => mkdirSync(DIR, { recursive: true }));
test.describe.configure({ timeout: 200_000 });

const state = (page: Page) => page.evaluate(() => {
  const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
  const scene = game.scene.getScene("run") as unknown as {
    children: Phaser.GameObjects.DisplayList;
    hud: {
      getUiBands: () => { topBelow: number; bottomAbove: number };
      isPointerOverUi: (x: number, y: number) => boolean;
    };
  };
  const labels = scene.children.list.filter((child) => {
    const text = child as Phaser.GameObjects.Text;
    return typeof text.text === "string" && text.visible;
  }) as Phaser.GameObjects.Text[];
  return {
    bands: scene.hud.getUiBands(),
    // Found by its icon: the chip carries no text now that the bottom row is
    // icons, so a label-based search finds nothing.
    chipPresent: scene.children.list.some((child) => {
      const image = child as Phaser.GameObjects.Image;
      return image.texture?.key === "ui-icon-workers" && image.visible;
    }),
    titleShown: labels.some((t) => t.text === "일꾼 배치"),
    // A point that is battlefield when folded and HUD when open.
    midBandIsUi: scene.hud.isPointerOverUi(800, 700),
  };
});

async function openGame(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => {
    const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
    return Boolean(game?.scene.getScene("run")?.scene.isActive());
  }, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1200);
}

/** Presses the chip through a real click, at its real position. */
async function pressChip(page: Page): Promise<void> {
  const point = await page.evaluate(() => {
    const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
    const scene = game.scene.getScene("run");
    // Located by its icon rather than its label. The bottom row became icon
    // buttons, so there is no text on it to match -- and the "일꾼 배치" panel
    // title, which is not interactive, is the only thing a label search finds.
    const chip = scene.children.list.find((child) => {
      const image = child as Phaser.GameObjects.Image;
      return image.texture?.key === "ui-icon-workers" && image.visible;
    }) as Phaser.GameObjects.Image;
    const bounds = chip.getBounds();
    const canvas = game.canvas.getBoundingClientRect();
    const scale = canvas.width / game.scale.gameSize.width;
    return { x: canvas.left + bounds.centerX * scale, y: canvas.top + bounds.centerY * scale };
  });
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(350);
}

test("the worker rows fold, and the band follows", async ({ page }) => {
  await openGame(page);

  const folded = await state(page);
  expect(folded.titleShown, "worker rows are showing before anything was pressed").toBe(false);
  expect(folded.chipPresent, "no worker chip to press").toBe(true);
  expect(folded.midBandIsUi, "folded HUD still claims the space the rows had").toBe(false);
  await page.screenshot({ path: `${DIR}/folded.png` });

  await pressChip(page);
  const open = await state(page);
  expect(open.titleShown, "pressing the chip did not open the rows").toBe(true);
  expect(open.bands.bottomAbove, "band did not grow with the panel")
    .toBeLessThan(folded.bands.bottomAbove);
  // The rows now occupy what was battlefield, so a press there must not fall
  // through and clear the selection -- the research panel's old failure.
  expect(open.midBandIsUi, "the opened rows are not treated as HUD").toBe(true);
  await page.screenshot({ path: `${DIR}/open.png` });

  await pressChip(page);
  const refolded = await state(page);
  expect(refolded.titleShown, "pressing the chip again did not fold the rows").toBe(false);
  expect(refolded.bands.bottomAbove).toBe(folded.bands.bottomAbove);
});
