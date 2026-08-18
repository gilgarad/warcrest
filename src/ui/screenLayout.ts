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

/**
 * How far to pull the camera back on this screen.
 *
 * The zoom was fixed, so a phone showed the same slice of world as a monitor
 * through a window a fraction of the size: the player's own base filled the
 * view and the opposing side was off-screen. Pulling back fits more of the
 * battlefield in, at the cost of smaller units -- which is the right way round,
 * because a lane game is unplayable if you cannot see the lane.
 *
 * Not pulled back proportionally to the screen. That would fit the whole map on
 * a phone and leave the units as specks; this trades some of the loss.
 */
export function fieldCameraZoom(metrics: ScreenMetrics): number {
  const pullback = metrics.deviceClass === "phone" ? 0.68 : metrics.deviceClass === "tablet" ? 0.85 : 1;
  return BASE_FIELD_ZOOM * pullback;
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
