import { describe, expect, it } from "vitest";
import { shouldPromptRotate, shouldRequestFullscreen } from "../mobileShell";

const touch = { coarsePointer: true, supportsFullscreen: true };
const desktop = { coarsePointer: false, supportsFullscreen: true };

describe("shouldPromptRotate", () => {
  it("asks a phone held upright to turn", () => {
    expect(shouldPromptRotate({ width: 390, height: 844 }, touch)).toBe(true);
  });

  it("says nothing once the phone is on its side", () => {
    expect(shouldPromptRotate({ width: 844, height: 390 }, touch)).toBe(false);
  });

  it("leaves a tall desktop window alone", () => {
    // A narrow browser window on a desktop is the user's choice, and they can
    // resize it; nagging about orientation there would be wrong.
    expect(shouldPromptRotate({ width: 800, height: 1000 }, desktop)).toBe(false);
  });
});

describe("shouldRequestFullscreen", () => {
  it("asks on a touch device that supports it", () => {
    expect(shouldRequestFullscreen(touch, false)).toBe(true);
  });

  it("does not ask twice", () => {
    expect(shouldRequestFullscreen(touch, true)).toBe(false);
  });

  it("does not ask where the browser will refuse", () => {
    // iOS Safari rejects fullscreen for non-video elements, so asking there
    // just produces a rejected promise on every tap.
    expect(shouldRequestFullscreen({ coarsePointer: true, supportsFullscreen: false }, false)).toBe(false);
  });

  it("leaves desktop alone", () => {
    expect(shouldRequestFullscreen(desktop, false)).toBe(false);
  });
});
