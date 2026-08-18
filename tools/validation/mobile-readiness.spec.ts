import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Measures whether the game is actually usable on a phone, in CSS pixels.
 *
 * Everything here is expressed in the units a finger and an eye work in, not in
 * the game's own 1600x900 coordinates. That distinction is the whole problem:
 * a 46px button is comfortable in game units and 20px on a phone, and nothing
 * in the code says so. Without this harness "looks fine" is the only available
 * judgement, and it is made on a desktop monitor.
 *
 * Expected to fail until the mobile work lands — it states the target, and the
 * numbers in its report are the progress measure.
 */
const ARTIFACT_DIR = "artifacts/mobile-readiness";
const GAME_URL = "/warcrest/?terrain=world-surface&preset=balanced&scale=recommended&map=warcrest-full-lane-hybrid-v1&autostart=1";

/** Apple and Android both land near 44dp; this is the common floor. */
const MIN_TOUCH_TARGET_CSS_PX = 44;
/** Below this, Korean glyphs stop resolving at arm's length on a phone. */
const MIN_TEXT_CSS_PX = 11;

interface Viewport { name: string; width: number; height: number; phone: boolean }

const VIEWPORTS: Viewport[] = [
  { name: "iPhone 14 landscape", width: 844, height: 390, phone: true },
  { name: "Galaxy S23 landscape", width: 854, height: 393, phone: true },
  { name: "iPad mini landscape", width: 1133, height: 744, phone: false },
];

interface Measurement {
  label: string;
  cssWidth: number;
  cssHeight: number;
}

/**
 * Screen-fixed controls and battlefield objects are measured differently.
 *
 * A HUD control's game units map straight to CSS pixels by the canvas scale. A
 * battlefield object goes through the camera first, and this camera is zoomed
 * out to 0.46 -- so treating the two the same overstates every world object by
 * more than double. The first version of this harness did exactly that, and
 * reported capture-point markers as its smallest HUD control.
 */

interface Report {
  viewport: string;
  cssPerGameUnit: number;
  renderedWidth: number;
  renderedHeight: number;
  wastedWidth: number;
  smallestUiTargets: Measurement[];
  smallestWorldTargets: Measurement[];
  smallestText: { label: string; cssPx: number }[];
}

test.beforeAll(() => mkdirSync(ARTIFACT_DIR, { recursive: true }));
test.describe.configure({ timeout: 300_000 });

async function measure(page: Page, viewport: Viewport): Promise<Report> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(GAME_URL);
  await page.waitForFunction(() => {
    const game = (window as unknown as { __warcrestGame?: Phaser.Game }).__warcrestGame;
    return Boolean(game?.scene.getScene("run")?.scene.isActive());
  }, undefined, { timeout: 120_000 });
  await page.waitForTimeout(1200);

  return page.evaluate(({ viewportName }) => {
    const game = (window as unknown as { __warcrestGame: Phaser.Game }).__warcrestGame;
    const canvas = game.canvas.getBoundingClientRect();
    // The canvas is letterboxed inside the viewport, so one game unit is this
    // many CSS pixels. Every figure below is scaled by it.
    const scale = canvas.width / game.scale.gameSize.width;

    const scenes = game.scene.getScenes(true);
    const camera = game.scene.getScene("run")?.cameras?.main;
    const worldZoom = camera ? camera.zoom : 1;
    const uiTargets: { label: string; cssWidth: number; cssHeight: number }[] = [];
    const worldTargets: { label: string; cssWidth: number; cssHeight: number }[] = [];
    const texts: { label: string; cssPx: number }[] = [];

    for (const scene of scenes) {
      for (const child of scene.children.list) {
        const object = child as Phaser.GameObjects.GameObject & {
          visible?: boolean;
          text?: string;
          style?: { fontSize?: string };
          getBounds?: () => Phaser.Geom.Rectangle;
          listenerCount?: (event: string) => number;
        };
        if (!object.visible) continue;

        if ((object.listenerCount?.("pointerdown") ?? 0) > 0 && object.getBounds) {
          const bounds = object.getBounds();
          const fixedToScreen = (object as unknown as { scrollFactorX?: number }).scrollFactorX === 0;
          const factor = fixedToScreen ? scale : scale * worldZoom;
          (fixedToScreen ? uiTargets : worldTargets).push({
            label: `${scene.scene.key}:${object.type}`,
            cssWidth: Number((bounds.width * factor).toFixed(1)),
            cssHeight: Number((bounds.height * factor).toFixed(1)),
          });
        }

        if (typeof object.text === "string" && object.text.trim() && object.style?.fontSize) {
          const gamePx = parseFloat(object.style.fontSize);
          if (Number.isFinite(gamePx)) {
            texts.push({
              label: object.text.slice(0, 18).replace(/\n/g, " "),
              cssPx: Number((gamePx * scale).toFixed(1)),
            });
          }
        }
      }
    }

    const smallestSide = (m: { cssWidth: number; cssHeight: number }) => Math.min(m.cssWidth, m.cssHeight);
    return {
      viewport: viewportName,
      cssPerGameUnit: Number(scale.toFixed(3)),
      renderedWidth: Math.round(canvas.width),
      renderedHeight: Math.round(canvas.height),
      wastedWidth: Math.round(window.innerWidth - canvas.width),
      smallestUiTargets: uiTargets.sort((a, b) => smallestSide(a) - smallestSide(b)).slice(0, 6),
      smallestWorldTargets: worldTargets.sort((a, b) => smallestSide(a) - smallestSide(b)).slice(0, 6),
      smallestText: texts.sort((a, b) => a.cssPx - b.cssPx).slice(0, 6),
    };
  }, { viewportName: viewport.name });
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.name}: touch targets and text are usable`, async ({ page }) => {
    const report = await measure(page, viewport);
    writeFileSync(
      `${ARTIFACT_DIR}/${viewport.name.replace(/\s+/g, "-").toLowerCase()}.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(`\n${report.viewport}  1게임단위 = ${report.cssPerGameUnit}css px`
      + `  렌더 ${report.renderedWidth}x${report.renderedHeight}  가로여백 ${report.wastedWidth}px`);
    console.log("  가장 작은 HUD 타깃:", report.smallestUiTargets
      .map((t) => `${t.cssWidth}x${t.cssHeight}`).join(", "));
    console.log("  가장 작은 전장 타깃:", report.smallestWorldTargets
      .map((t) => `${t.cssWidth}x${t.cssHeight}`).join(", "));
    console.log("  가장 작은 글자:", report.smallestText
      .map((t) => `${t.cssPx}px "${t.label}"`).join(", "));

    // Asserted on the HUD only. Battlefield objects are reported beside it and
    // are a separate problem: making a capture-point marker comfortable to tap
    // means changing the camera or the markers, not the HUD layout.
    const worstTarget = report.smallestUiTargets[0];
    expect(
      worstTarget ? Math.min(worstTarget.cssWidth, worstTarget.cssHeight) : Infinity,
      `smallest HUD target is ${worstTarget?.cssWidth}x${worstTarget?.cssHeight} CSS px`,
    ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_CSS_PX);

    const worstText = report.smallestText[0];
    expect(
      worstText?.cssPx ?? Infinity,
      `smallest text is ${worstText?.cssPx} CSS px ("${worstText?.label}")`,
    ).toBeGreaterThanOrEqual(MIN_TEXT_CSS_PX);
  });
}
