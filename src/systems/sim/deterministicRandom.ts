/**
 * The simulation's only source of randomness.
 *
 * Lockstep PvP requires both clients to produce bit-identical state from the
 * same seed and the same commands, which rules out `Math.random()` and
 * anything built on it. `Phaser.Math.RND` is seeded, but it is not usable from
 * a headless simulation (or a Web Worker) because it drags Phaser in, so the
 * simulation gets its own generator with no engine dependency.
 *
 * Algorithm is mulberry32: 32-bit state, all arithmetic done through `Math.imul`
 * and `>>>`, so every step is exact integer work that every JS engine performs
 * identically. Only the final divide touches floating point, and IEEE-754
 * specifies division exactly.
 */
export class DeterministicRandom {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  }

  /** Current generator state — enough to snapshot or resync a simulation. */
  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  floatBetween(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max], inclusive. */
  intBetween(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * Uniformly picks one item. Replaces `Phaser.Utils.Array.GetRandom`, which is
   * backed by `Math.random()` and so ignored the seeding used elsewhere.
   */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick() needs a non-empty array");
    return items[Math.floor(this.next() * items.length)];
  }
}

/** FNV-1a, so a string seed maps to a stable 32-bit value on every engine. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
