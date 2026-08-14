/**
 * Scalar maths the simulation needs, with no engine dependency.
 *
 * These are trivial functions, and that is the point: while the simulation
 * called `Phaser.Math.Clamp` and `Phaser.Math.Linear` it could not run outside
 * a browser with Phaser loaded, which blocks running it headless in Node, in a
 * Worker, or on a server. Replacing three one-line helpers removes that whole
 * dependency class.
 *
 * Every operation here is `+ - * /` and comparison only, which IEEE-754
 * specifies exactly, so results are bit-identical across JS engines — the
 * property lockstep depends on.
 */

/** Confines `value` to `[min, max]`. Matches `Phaser.Math.Clamp`. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Linear interpolation. Matches `Phaser.Math.Linear`, including its behaviour
 * for `t` outside `[0, 1]` (it extrapolates rather than clamping).
 */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Moves `current` toward `target` by at most `maxDelta`. */
export function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

/**
 * Euclidean distance. `Math.sqrt` is the one non-elementary operation the
 * simulation uses, and IEEE-754 requires it to be correctly rounded, so it is
 * safe for lockstep where `Math.pow`/`Math.sin` would not be.
 */
export function distance(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Distance between two positions along a lane.
 *
 * Trivially absolute difference today, but lanes are conceptually a path, so
 * every comparison goes through this rather than open-coding `Math.abs` — if
 * lane progress ever wraps or becomes non-linear, there is one place to change.
 */
export function progressBetween(a: number, b: number): number {
  return Math.abs(a - b);
}
