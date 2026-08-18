/**
 * The parts of running on a phone that sit outside the game itself: how big the
 * canvas may be, when to ask for fullscreen, and whether the device is being
 * held the wrong way.
 *
 * Deliberately free of Phaser and of the DOM where it can be, so the decisions
 * are testable. The wiring that touches the browser is the thin part at the
 * bottom.
 */

export interface ViewportSize {
  width: number;
  height: number;
}

/** Coarse pointers mean a finger, which is what changes the rules here. */
export interface DeviceTraits {
  coarsePointer: boolean;
  supportsFullscreen: boolean;
}

/**
 * Whether the game should be showing at all.
 *
 * The battlefield runs left to right between two bases, so a portrait phone can
 * only ever show a sliver of it. Landscape is not a preference here.
 */
export function shouldPromptRotate(viewport: ViewportSize, traits: DeviceTraits): boolean {
  return traits.coarsePointer && viewport.height > viewport.width;
}

/**
 * Whether asking for fullscreen is worth doing.
 *
 * Only on touch devices, and only when the browser will honour it: iOS Safari
 * rejects fullscreen for anything that is not a video, so asking there produces
 * a rejected promise on every tap and nothing else. The URL bar is handled by
 * `100dvh` instead.
 */
export function shouldRequestFullscreen(traits: DeviceTraits, alreadyFullscreen: boolean): boolean {
  return traits.coarsePointer && traits.supportsFullscreen && !alreadyFullscreen;
}

export function readDeviceTraits(): DeviceTraits {
  const coarsePointer = typeof window.matchMedia === "function"
    && window.matchMedia("(pointer: coarse)").matches;
  const element = document.documentElement as HTMLElement & { webkitRequestFullscreen?: unknown };
  const supportsFullscreen = Boolean(
    document.fullscreenEnabled && (element.requestFullscreen || element.webkitRequestFullscreen),
  );
  return { coarsePointer, supportsFullscreen };
}

/**
 * Asks for fullscreen the first time the player touches the screen.
 *
 * It has to be a user gesture -- browsers refuse the request otherwise -- and it
 * is attempted once: a player who dismisses fullscreen should not be asked
 * again on their next tap.
 */
export function installFullscreenOnFirstGesture(traits = readDeviceTraits()): () => void {
  let attempted = false;
  const attempt = (): void => {
    if (attempted) return;
    attempted = true;
    if (!shouldRequestFullscreen(traits, Boolean(document.fullscreenElement))) return;
    // Failure is fine and expected on some browsers; the game is playable
    // either way, so this must never surface as an error.
    void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  window.addEventListener("pointerdown", attempt, { once: true, passive: true });
  return () => window.removeEventListener("pointerdown", attempt);
}
