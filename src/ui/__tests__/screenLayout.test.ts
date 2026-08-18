import { describe, expect, it } from "vitest";
import {
  GAME_HEIGHT,
  MIN_TOUCH_TARGET_CSS,
  atLeastTouchable,
  classifyDevice,
  cssToUnits,
  hudHeightBudgetUnits,
  measureScreen,
  touchColumnsInWidth,
  touchRowsInBudget,
  unitsToCss,
} from "../screenLayout";

/** The three screens the mobile work is being measured against. */
const iphone = measureScreen(693, 390);   // 844x390 viewport, letterboxed
const ipad = measureScreen(1133, 637);
const desktop = measureScreen(1600, 900);

describe("classifyDevice", () => {
  it("classifies by the shorter side, not by device name", () => {
    expect(classifyDevice(693, 390)).toBe("phone");
    expect(classifyDevice(1133, 637)).toBe("tablet");
    expect(classifyDevice(1600, 900)).toBe("desktop");
  });

  it("treats a small desktop window as a phone-sized problem", () => {
    // A finger, or a cramped window, has the same difficulty regardless of what
    // the user agent claims to be.
    expect(classifyDevice(700, 400)).toBe("phone");
  });
});

describe("measureScreen", () => {
  it("reports how much of a game unit reaches the screen", () => {
    expect(iphone.cssPerGameUnit).toBeCloseTo(0.433, 3);
    expect(desktop.cssPerGameUnit).toBe(1);
  });

  /**
   * The number the whole mobile problem reduces to: a comfortable button costs
   * over a hundred game units on a phone, in a space only 900 tall.
   */
  it("prices a touch target in game units", () => {
    expect(iphone.minTouchTargetUnits).toBeGreaterThan(100);
    expect(desktop.minTouchTargetUnits).toBe(MIN_TOUCH_TARGET_CSS);
  });

  it("survives being asked before the canvas has a size", () => {
    // Phaser reports 0x0 for a frame during startup; dividing by it would give
    // every control an infinite size.
    const early = measureScreen(0, 0);
    expect(Number.isFinite(early.minTouchTargetUnits)).toBe(true);
    expect(early.cssPerGameUnit).toBe(1);
  });
});

describe("unit conversion", () => {
  it("round-trips", () => {
    expect(unitsToCss(iphone, cssToUnits(iphone, 44))).toBeCloseTo(44, 6);
  });

  it("agrees with the harness's measured figures", () => {
    // 12px text measured at 5.2 CSS px on the iPhone baseline.
    expect(unitsToCss(iphone, 12)).toBeCloseTo(5.2, 1);
  });
});

describe("atLeastTouchable", () => {
  it("grows a control that is too small for a finger", () => {
    expect(atLeastTouchable(iphone, 34)).toBe(iphone.minTouchTargetUnits);
  });

  it("leaves a generous control alone", () => {
    // Desktop controls should not shrink to a phone's minimum.
    expect(atLeastTouchable(desktop, 200)).toBe(200);
  });
});

describe("hudHeightBudgetUnits", () => {
  it("gives a phone more of the screen than a desktop", () => {
    // The size has to come from somewhere, and the playfield is the only place.
    expect(hudHeightBudgetUnits(iphone)).toBeGreaterThan(hudHeightBudgetUnits(desktop));
    expect(hudHeightBudgetUnits(iphone)).toBeLessThan(GAME_HEIGHT / 2);
  });
});

describe("touchRowsInBudget", () => {
  /**
   * Height is the binding constraint, and the intuition points the other way.
   * The first version of this module asked whether a row of four buttons fits
   * across the width; it does, easily, which made the helper useless for the
   * decision it was meant to inform.
   */
  it("gives a phone fewer rows than a desktop", () => {
    expect(touchRowsInBudget(iphone)).toBeLessThan(touchRowsInBudget(desktop));
  });

  it("leaves a phone room for only a handful of rows", () => {
    expect(touchRowsInBudget(iphone)).toBeGreaterThan(0);
    expect(touchRowsInBudget(iphone)).toBeLessThanOrEqual(4);
  });

  it("puts the tablet between the two", () => {
    expect(touchRowsInBudget(ipad)).toBeGreaterThanOrEqual(touchRowsInBudget(iphone));
    expect(touchRowsInBudget(ipad)).toBeLessThanOrEqual(touchRowsInBudget(desktop));
  });
});

describe("touchColumnsInWidth", () => {
  it("shows width is not the problem", () => {
    // Both seat a whole row of controls comfortably; only the height differs.
    expect(touchColumnsInWidth(iphone)).toBeGreaterThanOrEqual(4);
    expect(touchColumnsInWidth(desktop)).toBeGreaterThanOrEqual(4);
  });
});
