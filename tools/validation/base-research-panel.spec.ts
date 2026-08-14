import { expect, test, type Page } from "@playwright/test";

/**
 * Drives the base research panel through real pointer events.
 *
 * The bug this covers is not visible from the panel's own code: pressing a stat
 * button worked, and then the scene's field-tap handler cleared the selection
 * and closed the panel underneath the press. Only a real pointer sequence
 * (down and up, at a real position) reproduces it — emitting a handler directly
 * skips the very interaction that broke.
 */
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1&autostart=1";

test.describe.configure({ timeout: 180_000 });

/** Column of the attack "+" stat button inside the panel (see createRow). */
const ATTACK_PLUS_X = 866;

interface PanelState {
  open: boolean;
  attackValue: string | null;
}

const readPanel = (page: Page): Promise<PanelState> => page.evaluate(() => {
  const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
  const scene = game.scene.getScene("run");
  const texts = scene.children.list.filter(
    (child): child is Phaser.GameObjects.Text => typeof (child as Phaser.GameObjects.Text).text === "string",
  );
  const open = texts.some((child) => child.text === "본진 연구 / 생산" && child.visible);
  // The first row's attack figure is at a fixed x inside the panel. Matching on
  // "a numeric label near the 공격 header" instead picked up an unrelated HUD
  // resource readout that happened to share the column.
  const ATTACK_VALUE_X = 718;
  const attackValue = texts
    .filter((child) => child.visible && child.x === ATTACK_VALUE_X && /^\d+$/.test(child.text))
    .sort((a, b) => a.y - b.y)[0]?.text ?? null;
  return { open, attackValue };
});

/**
 * Screen position of a visible label, in page pixels.
 *
 * `atX` is not optional decoration: the HUD has its own "+" buttons, and taking
 * "the first visible +" clicked one of those instead of the panel's, which made
 * an earlier version of this test pass without ever touching the panel.
 */
async function labelPoint(page: Page, text: string, atX?: number): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(({ label, columnX }) => {
    const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
    const scene = game.scene.getScene("run");
    const matches = (scene.children.list.filter(
      (child) => (child as Phaser.GameObjects.Text).text === label && (child as Phaser.GameObjects.Text).visible,
    ) as Phaser.GameObjects.Text[])
      .filter((child) => columnX === undefined || child.x === columnX)
      .sort((a, b) => a.y - b.y);
    const target = matches[0];
    if (!target) {
      throw new Error(`no visible "${label}"${columnX === undefined ? "" : ` at x=${columnX}`}`);
    }
    const canvas = game.canvas.getBoundingClientRect();
    const scaleX = canvas.width / game.scale.gameSize.width;
    const scaleY = canvas.height / game.scale.gameSize.height;
    const bounds = target.getBounds();
    return {
      x: canvas.left + bounds.centerX * scaleX,
      y: canvas.top + bounds.centerY * scaleY,
    };
  }, { label: text, columnX: atX });
  return point;
}

/**
 * Opens the panel and leaves the scene in the state a real base click leaves it.
 *
 * Selecting the base marks the pointer as having hit a field object so that the
 * matching `pointerup` does not treat the same press as a tap on open ground.
 * Calling the selection directly sets that flag with no `pointerup` to consume
 * it, and the stale flag then absorbed the *next* press — which hid the very bug
 * this test exists for. Clearing it reproduces the real starting state.
 */
async function openPanel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
    const scene = game.scene.getScene("run") as unknown as {
      selectMainBase: (team: string) => void;
      localTeamId: string;
      fieldObjectTapped: boolean;
    };
    scene.selectMainBase(scene.localTeamId);
    scene.fieldObjectTapped = false;
  });
  await page.waitForTimeout(400);
}

test("pressing + adjusts the draft without closing the panel", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 820 });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => {
    const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
    return Boolean(game?.scene.getScene("run")?.scene.isActive());
  }, undefined, { timeout: 90_000 });
  await page.waitForTimeout(1500);

  await openPanel(page);

  const before = await readPanel(page);
  expect(before.open, "panel did not open").toBe(true);

  // The panel's attack "+" column, first row. Addressed by column so the HUD's
  // own worker "+" buttons cannot be hit by mistake.
  const plus = await labelPoint(page, "+", ATTACK_PLUS_X);
  await page.mouse.click(plus.x, plus.y);
  await page.waitForTimeout(400);

  const after = await readPanel(page);
  expect(after.open, "the panel closed itself when a stat button was pressed").toBe(true);
  expect(after.attackValue).not.toBe(before.attackValue);
});

test("the revert button keeps the panel open", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 820 });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => {
    const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
    return Boolean(game?.scene.getScene("run")?.scene.isActive());
  }, undefined, { timeout: 90_000 });
  await page.waitForTimeout(1500);
  await openPanel(page);

  const plus = await labelPoint(page, "+", ATTACK_PLUS_X);
  await page.mouse.click(plus.x, plus.y);
  await page.waitForTimeout(300);

  // Discarding the draft is not the same action as dismissing the dialog, which
  // is why the button no longer says "취소".
  const revert = await labelPoint(page, "되돌리기");
  await page.mouse.click(revert.x, revert.y);
  await page.waitForTimeout(400);

  const after = await readPanel(page);
  expect(after.open, "revert closed the panel").toBe(true);
  expect(after.attackValue).toBe("0");
});
