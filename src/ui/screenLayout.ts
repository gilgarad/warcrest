/**
 * Translates between the game's fixed coordinate space and the physical screen.
 *
 * The game draws in a 1600x900 space that Phaser scales to fit whatever window
 * it is in. That is convenient until a finger is involved: a 44-unit button is
 * comfortable on a desktop monitor and 19 CSS pixels on a phone, and nothing in
 * the drawing code says which of those it is going to be. Every size that has to
 * survive contact with a person -- touch targets, body text -- belongs in CSS
 * pixels, and this converts.
 *
 * The arithmetic is unforgiving and worth stating plainly: on a phone in
 * landscape one game unit is about 0.43 CSS pixels, so a 44px touch target costs
 * roughly 102 game units. In a 900-unit-tall space that is more than a ninth of
 * the screen for a single button. Phone layouts are sparse because the numbers
 * leave no other option, not as a style choice.
 */

/** The design space the game draws in. */
export const GAME_WIDTH = 1600;
export const GAME_HEIGHT = 900;

/** Common floor for a comfortable touch target on both major platforms. */
export const MIN_TOUCH_TARGET_CSS = 44;
/** Below this, Korean glyphs stop resolving at arm's length. */
export const MIN_BODY_TEXT_CSS = 11;

export type DeviceClass = "phone" | "tablet" | "desktop";

export interface ScreenMetrics {
  /** Size of the drawn canvas in CSS pixels. */
  cssWidth: number;
  cssHeight: number;
  /** CSS pixels per game unit; the number everything else hangs off. */
  cssPerGameUnit: number;
  deviceClass: DeviceClass;
  /** A comfortable touch target, expressed in game units for this screen. */
  minTouchTargetUnits: number;
  /** Readable body text, in game units for this screen. */
  minBodyTextUnits: number;
}

/**
 * Classifies by the shorter side in CSS pixels rather than by user agent.
 *
 * What matters is how much room a finger has, and a small window on a desktop
 * has the same problem as a phone. Sniffing the device would answer a different
 * question from the one being asked.
 */
export function classifyDevice(cssWidth: number, cssHeight: number): DeviceClass {
  const shortSide = Math.min(cssWidth, cssHeight);
  if (shortSide < 480) return "phone";
  if (shortSide < 800) return "tablet";
  return "desktop";
}

export function measureScreen(cssWidth: number, cssHeight: number): ScreenMetrics {
  // Guard against a zero-width canvas during startup, which would otherwise
  // divide by zero and produce Infinity-sized layouts.
  const safeWidth = cssWidth > 0 ? cssWidth : GAME_WIDTH;
  const cssPerGameUnit = safeWidth / GAME_WIDTH;
  return {
    cssWidth: safeWidth,
    cssHeight: cssHeight > 0 ? cssHeight : GAME_HEIGHT,
    cssPerGameUnit,
    deviceClass: classifyDevice(safeWidth, cssHeight > 0 ? cssHeight : GAME_HEIGHT),
    minTouchTargetUnits: MIN_TOUCH_TARGET_CSS / cssPerGameUnit,
    minBodyTextUnits: MIN_BODY_TEXT_CSS / cssPerGameUnit,
  };
}

/** Game units needed to occupy a given number of CSS pixels on this screen. */
export function cssToUnits(metrics: ScreenMetrics, cssPx: number): number {
  return cssPx / metrics.cssPerGameUnit;
}

/** CSS pixels a given number of game units will occupy on this screen. */
export function unitsToCss(metrics: ScreenMetrics, units: number): number {
  return units * metrics.cssPerGameUnit;
}

/**
 * Grows a size so it is at least comfortable to hit, leaving larger ones alone.
 *
 * Used rather than setting every control to the minimum: a control that is
 * already generous should not shrink on a desktop just because a phone needs
 * it big.
 */
export function atLeastTouchable(metrics: ScreenMetrics, units: number): number {
  return Math.max(units, metrics.minTouchTargetUnits);
}

/** Camera zoom the battlefield is drawn at on a desktop. */
export const BASE_FIELD_ZOOM = 0.46;

/** Screen row the top HUD band reaches down to. */
export const HUD_TOP_BAND_BOTTOM = 156;

/**
 * Where the bottom HUD band starts, for a given fold state.
 *
 * Lives here rather than in the HUD because two things need it and they are
 * built at different times: the HUD to know its own shape, and the camera to
 * know how much screen is left for the battlefield. The camera is set up long
 * before the HUD exists, so asking the HUD would mean reading a field that is
 * still undefined -- and copying the numbers across would put them back on
 * separate paths to drift apart on.
 */
export function hudBottomBandTop(metrics: ScreenMetrics, workerPanelOpen: boolean): number {
  if (workerPanelOpen) return 660;
  // One row, since the actions became icons. It used to be two, and the row
  // that folding them away saved goes straight back to the battlefield.
  const buttonHeight = atLeastTouchable(metrics, 44);
  const bottomMargin = 4;
  return GAME_HEIGHT - bottomMargin - buttonHeight - 10;
}

/** Screen rows left for the battlefield once the HUD has taken its bands. */
export function fieldBandHeightUnits(metrics: ScreenMetrics): number {
  return hudBottomBandTop(metrics, false) - HUD_TOP_BAND_BOTTOM;
}

/** The world box the camera must always be able to show. */
export interface MustSeeBox {
  width: number;
  height: number;
}

/**
 * Zoom that fits the battlefield into the strip of screen left between the HUD
 * bands.
 *
 * Derived rather than chosen. A fixed zoom cannot be right for both a monitor
 * and a phone -- the same number showed a desktop the whole field and a phone a
 * corner of it -- and hand-tuning a second constant per device class just moves
 * the guess. Stating what has to be visible and solving for the zoom means the
 * answer follows the map: tighten the layout and the units get bigger on their
 * own, which is exactly the trade being made.
 *
 * Capped at the desktop zoom so a large monitor does not magnify the field past
 * the scale the art was drawn for.
 */
export function fitFieldZoom(mustSee: MustSeeBox, fieldHeightUnits: number): number {
  const byWidth = GAME_WIDTH / Math.max(1, mustSee.width);
  const byHeight = Math.max(1, fieldHeightUnits) / Math.max(1, mustSee.height);
  return Math.min(BASE_FIELD_ZOOM, byWidth, byHeight);
}

export interface SplashPresentation {
  /** Multiplier on the fill size; above 1 crops into the painting. */
  zoom: number;
  alpha: number;
}

/**
 * How to show the title painting on this screen.
 *
 * The splash is a detailed illustration stretched to fill. At desktop size that
 * reads as atmosphere; squeezed onto a phone the same detail becomes noise
 * competing with the menu on top of it. Cropping in shows fewer elements at a
 * larger size, and fading it further lets the menu win.
 */
export function splashPresentation(metrics: ScreenMetrics): SplashPresentation {
  if (metrics.deviceClass === "phone") return { zoom: 1.75, alpha: 0.18 };
  if (metrics.deviceClass === "tablet") return { zoom: 1.3, alpha: 0.24 };
  return { zoom: 1, alpha: 0.3 };
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * How much of the 900-unit height a HUD band may take before it is eating the
 * battlefield.
 *
 * A phone needs its controls physically large, and the only place that size can
 * come from is the playfield, so the cap is generous there and tight elsewhere.
 * Returning a budget rather than a layout keeps the judgement in one place.
 */
export function hudHeightBudgetUnits(metrics: ScreenMetrics): number {
  const share = metrics.deviceClass === "phone" ? 0.42 : metrics.deviceClass === "tablet" ? 0.34 : 0.3;
  return GAME_HEIGHT * share;
}

/**
 * How many rows of touch-sized controls fit inside the HUD's height budget.
 *
 * Height is what actually binds on a phone, which is worth stating because the
 * intuition points the other way. Across the 1600-unit width a phone seats
 * fourteen comfortable controls; down the 900-unit height, within a HUD budget,
 * it seats three. Layout decisions should be driven by this number, not by the
 * width.
 */
export function touchRowsInBudget(metrics: ScreenMetrics, gapUnits = 12): number {
  const rowPitch = metrics.minTouchTargetUnits + gapUnits;
  return Math.max(0, Math.floor((hudHeightBudgetUnits(metrics) + gapUnits) / rowPitch));
}

/** How many touch-sized controls fit across the width, for completeness. */
export function touchColumnsInWidth(metrics: ScreenMetrics, gapUnits = 12): number {
  const columnPitch = metrics.minTouchTargetUnits + gapUnits;
  return Math.max(0, Math.floor((GAME_WIDTH + gapUnits) / columnPitch));
}
