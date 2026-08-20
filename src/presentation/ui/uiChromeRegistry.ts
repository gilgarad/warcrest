import { assetUrl } from "../../config/assetUrl";

/**
 * Nine-slice frames for the HUD.
 *
 * The HUD was flat rectangles with a one-pixel stroke, which read as a debug
 * overlay once the field beneath it became pixel art. These are drawn in the
 * same language: hard edges, a lit top and left, brass trim and corner studs.
 *
 * Nine-slice because one source has to serve a 60px stepper and a 900px panel.
 * Only the middle stretches, so all the detail lives in the corners -- a fill
 * with any pattern in it comes out as enormous checks when stretched, which the
 * first attempt did.
 */
const ASSET_ROOT = assetUrl("assets/production/ui");

export type UiFrameId = "panel" | "button" | "button-hover" | "button-disabled" | "button-danger";

const FRAMES: readonly UiFrameId[] = ["panel", "button", "button-hover", "button-disabled", "button-danger"];

/** Size of the corner that must not stretch, matching the generator. */
export const UI_FRAME_CORNER = 8;

export function getUiFrameKey(frame: UiFrameId): string {
  return `ui-frame-${frame}`;
}

export const UI_CHROME_ASSETS = FRAMES.map((frame) => ({
  key: getUiFrameKey(frame),
  path: `${ASSET_ROOT}/${frame}.png`,
}));

export type UiIconId = "hire-worker" | "hire-research-worker" | "use-instant-wave" | "age-up" | "workers";

const ICONS: readonly UiIconId[] = [
  "hire-worker", "hire-research-worker", "use-instant-wave", "age-up", "workers",
];

export function getUiIconKey(icon: UiIconId): string {
  return `ui-icon-${icon}`;
}

/**
 * Action icons.
 *
 * The strategic actions were text buttons two rows deep, which is the most
 * expensive way to spend a phone's bottom band: the whole HUD has room for about
 * three rows of touch-sized controls and those took two of them. One row of
 * icons says the same thing.
 */
export const UI_ICON_ASSETS = ICONS.map((icon) => ({
  key: getUiIconKey(icon),
  path: `${ASSET_ROOT}/icons/${icon}.png`,
}));
