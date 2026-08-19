import { expect, test } from "@playwright/test";

/**
 * The title screen's controls stay inside their panel and clear of each other.
 *
 * Sizes alone were being measured, and sizes alone were fine: every control met
 * the touch-target floor while the online-match button sat entirely outside the
 * panel and "난이도" printed on top of the last line of prose. Growing text for
 * phones is what made it visible, but the button had been outside the frame all
 * along -- a measurement that only asks "is it big enough" cannot see it.
 */
const MENU_URL = "/warcrest/";

const VIEWPORTS = [
  { name: "desktop", width: 1600, height: 900 },
  { name: "laptop", width: 1024, height: 640 },
  { name: "phone", width: 844, height: 390 },
];

test.describe.configure({ timeout: 300_000 });

interface Box { label: string; left: number; right: number; top: number; bottom: number }

for (const viewport of VIEWPORTS) {
  test(`${viewport.name}: menu content stays inside the panel`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(MENU_URL);
    await page.waitForFunction(() => {
      const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
      if (!game) return false;
      return game.scene.getScenes(true).some((scene) => scene.children.list.some(
        (child) => (child as Phaser.GameObjects.Text).text === "초급"
          && (child as Phaser.GameObjects.Text).visible,
      ));
    }, undefined, { timeout: 240_000 });
    await page.waitForTimeout(500);

    const measured = await page.evaluate(() => {
      const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
      const scene = game.scene.getScene("boot") as unknown as {
        children: Phaser.GameObjects.DisplayList;
        menuLayout: { panelWidth: number; panelHeight: number; panelCentreY: number };
      };
      const layout = scene.menuLayout;
      const half = { x: layout.panelWidth / 2, y: layout.panelHeight / 2 };
      const centreX = game.scale.gameSize.width / 2;
      const panel = {
        left: centreX - half.x,
        right: centreX + half.x,
        top: layout.panelCentreY - half.y,
        bottom: layout.panelCentreY + half.y,
      };

      // The controls and the labels beside them; the panel itself and the
      // background are not content.
      const wanted = ["초급", "중급", "고급", "신", "온라인 대전", "난이도"];
      const boxes: Box[] = [];
      for (const child of scene.children.list) {
        const object = child as Phaser.GameObjects.Text & { getBounds?: () => Phaser.Geom.Rectangle };
        if (!object.visible || typeof object.text !== "string" || !object.getBounds) continue;
        if (!wanted.includes(object.text)) continue;
        const bounds = object.getBounds();
        boxes.push({
          label: object.text,
          left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
        });
      }
      return { panel, boxes };
    });

    expect(measured.boxes.length, "menu labels not found").toBeGreaterThan(4);

    for (const box of measured.boxes) {
      expect(box.left, `"${box.label}" escapes the panel on the left`).toBeGreaterThanOrEqual(measured.panel.left);
      expect(box.right, `"${box.label}" escapes the panel on the right`).toBeLessThanOrEqual(measured.panel.right);
      expect(box.top, `"${box.label}" escapes the panel at the top`).toBeGreaterThanOrEqual(measured.panel.top);
      expect(box.bottom, `"${box.label}" escapes the panel at the bottom`).toBeLessThanOrEqual(measured.panel.bottom);
    }

    // Overlap between labels, which is what the size-only measurement missed.
    for (let i = 0; i < measured.boxes.length; i += 1) {
      for (let j = i + 1; j < measured.boxes.length; j += 1) {
        const a = measured.boxes[i];
        const b = measured.boxes[j];
        const overlaps = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(overlaps, `"${a.label}" overlaps "${b.label}"`).toBe(false);
      }
    }
  });
}
