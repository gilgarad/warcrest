/**
 * Reference frame rate that the scene's steering lerp alphas were authored
 * against. The original constants (0.34 / 0.4 / 0.42 / 0.45 / 0.52) were
 * applied once per rendered frame, so they only meant what their author
 * intended while the game held 60fps.
 */
export const LERP_REFERENCE_FPS = 60;

/**
 * Converts a per-frame lerp alpha authored at {@link LERP_REFERENCE_FPS} into
 * a delta-scaled alpha, so the value converges at the same wall-clock rate
 * regardless of the actual frame rate.
 *
 * This is a steering correctness issue, not a cosmetic one. In
 * `LaneBattleScene`, forward movement (`unit.progress`) was always multiplied
 * by `deltaSec`, but the sideways slide into a combat slot (`unit.laneRow`)
 * used a bare constant. Whenever the frame rate dipped, units therefore kept
 * advancing down the lane at the correct speed while sliding into attack
 * position more and more slowly — leaving them parked in front of an enemy
 * without engaging it.
 *
 * Feeding `deltaSec = 1 / 60` returns `alphaAt60` exactly, so existing tuning
 * is preserved at the reference frame rate.
 */
export function frameLerpAlpha(deltaSec: number, alphaAt60: number): number {
  if (alphaAt60 <= 0) return 0;
  if (alphaAt60 >= 1) return 1;
  const frames = Math.max(0, deltaSec) * LERP_REFERENCE_FPS;
  return 1 - Math.pow(1 - alphaAt60, frames);
}
