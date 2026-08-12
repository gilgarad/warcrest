import { describe, expect, it } from "vitest";
import { DeterministicRandom, hashSeed } from "../deterministicRandom";

describe("DeterministicRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const a = new DeterministicRandom("warcrest");
    const b = new DeterministicRandom("warcrest");
    const seqA = Array.from({ length: 200 }, () => a.next());
    const seqB = Array.from({ length: 200 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new DeterministicRandom("warcrest");
    const b = new DeterministicRandom("warcrest2");
    expect(Array.from({ length: 20 }, () => a.next()))
      .not.toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  /**
   * Pinned values. If a refactor silently changes the generator, every
   * previously recorded match replay and every desync-hash baseline becomes
   * invalid — so the sequence itself is part of the contract.
   */
  it("matches a pinned reference sequence", () => {
    const rng = new DeterministicRandom(1);
    const first = Array.from({ length: 4 }, () => rng.next());
    expect(first.map((n) => n.toFixed(12))).toEqual([
      "0.627073940588",
      "0.002735721180",
      "0.527447039960",
      "0.981050967472",
    ]);
  });

  it("restores an interrupted sequence from saved state", () => {
    const rng = new DeterministicRandom("resync");
    Array.from({ length: 17 }, () => rng.next());
    const snapshot = rng.getState();
    const expected = Array.from({ length: 10 }, () => rng.next());

    const restored = new DeterministicRandom(0);
    restored.setState(snapshot);
    expect(Array.from({ length: 10 }, () => restored.next())).toEqual(expected);
  });

  it("stays inside its declared ranges", () => {
    const rng = new DeterministicRandom("ranges");
    for (let i = 0; i < 1000; i += 1) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.intBetween(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      const b = rng.floatBetween(-2, 5);
      expect(b).toBeGreaterThanOrEqual(-2);
      expect(b).toBeLessThan(5);
    }
  });

  it("reaches every element of a small array and never goes out of bounds", () => {
    const rng = new DeterministicRandom("pick");
    const items = ["gold", "wood", "food"] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(rng.pick(items));
    expect([...seen].sort()).toEqual(["food", "gold", "wood"]);
  });

  it("rejects picking from an empty array instead of returning undefined", () => {
    expect(() => new DeterministicRandom(1).pick([])).toThrow();
  });

  it("hashes string seeds stably", () => {
    expect(hashSeed("warcrest")).toBe(hashSeed("warcrest"));
    expect(hashSeed("warcrest")).not.toBe(hashSeed("Warcrest"));
    expect(hashSeed("warcrest")).toBeGreaterThanOrEqual(0);
  });
});
