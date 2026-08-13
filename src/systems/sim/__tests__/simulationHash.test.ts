import { describe, expect, it } from "vitest";
import { SimulationHasher, hashSimulationState } from "../simulationHash";
import type { SimulationStateView, SimUnitState } from "../simulationState";

const unit = (over: Partial<SimUnitState> = {}): SimUnitState => ({
  id: 1, team: "player", unitId: "stone_axeman", role: "battle", laneId: "main",
  progress: 0.25, laneRow: 0, hp: 50, maxHp: 50, attack: 7, defense: 1,
  range: 2.5, speed: 1, attackCooldownSec: 1.2, attackTimerSec: 0.4,
  attackAnimTime: 0, attackFacingLockSec: 0, combatFacingHoldSec: 0,
  attackTargetKind: "unit", attackSequence: 0, manaCurrent: 0, manaMax: 0,
  attrition: 0, targetId: -1, ...over,
});

const state = (over: Partial<SimulationStateView> = {}): SimulationStateView => ({
  tick: 10,
  elapsedSec: 0.3333333333333333,
  rngState: 123456,
  player: {
    ageId: "stone", baseHp: 400, baseMaxHp: 400, nextWaveInSec: 12,
    instantWaveTokens: 1, resources: { gold: 20, wood: 20 }, workers: { gold: 1 },
  },
  enemy: {
    ageId: "stone", baseHp: 400, baseMaxHp: 400, nextWaveInSec: 15,
    instantWaveTokens: 0, resources: { gold: 20, wood: 20 }, workers: { gold: 1 },
  },
  units: [unit()],
  capturePoints: [{
    id: 0, owner: "neutral", control: 0, buildingId: "", buildingLevel: 0,
    attackTimerSec: 0, incomeTimerSec: 0, supplyTimerSec: 0, manaCurrent: 0,
  }],
  defenseTowers: [{
    id: 0, owner: "player", built: true, hp: 300, maxHp: 300, defense: 2,
    attackTimerSec: 0.5, buildRemainingSec: 0,
  }],
  ...over,
});

describe("hashSimulationState", () => {
  it("is stable for identical state", () => {
    expect(hashSimulationState(state())).toBe(hashSimulationState(state()));
  });

  it("notices a change too small to see", () => {
    const nudged = state();
    nudged.units[0].progress += Number.EPSILON;
    expect(hashSimulationState(nudged)).not.toBe(hashSimulationState(state()));
  });

  it.each([
    ["hp", (s: SimulationStateView) => { s.units[0].hp -= 1; }],
    ["attackTimerSec", (s: SimulationStateView) => { s.units[0].attackTimerSec += 0.01; }],
    ["attackAnimTime", (s: SimulationStateView) => { s.units[0].attackAnimTime = 0.2; }],
    ["targetId", (s: SimulationStateView) => { s.units[0].targetId = 9; }],
    ["rng state", (s: SimulationStateView) => { s.rngState += 1; }],
    ["tick", (s: SimulationStateView) => { s.tick += 1; }],
    ["base hp", (s: SimulationStateView) => { s.player.baseHp -= 1; }],
    ["resources", (s: SimulationStateView) => { s.player.resources.gold += 1; }],
    ["workers", (s: SimulationStateView) => { s.enemy.workers.gold += 1; }],
    ["capture control", (s: SimulationStateView) => { s.capturePoints[0].control = 0.5; }],
    ["tower hp", (s: SimulationStateView) => { s.defenseTowers[0].hp -= 1; }],
    ["tower built", (s: SimulationStateView) => { s.defenseTowers[0].built = false; }],
  ])("detects a change in %s", (_label, mutate) => {
    const changed = state();
    mutate(changed);
    expect(hashSimulationState(changed)).not.toBe(hashSimulationState(state()));
  });

  it("detects a reordered unit list, because order is itself simulation state", () => {
    const a = state({ units: [unit({ id: 1 }), unit({ id: 2 })] });
    const b = state({ units: [unit({ id: 2 }), unit({ id: 1 })] });
    expect(hashSimulationState(a)).not.toBe(hashSimulationState(b));
  });

  it("ignores the key order of resource records", () => {
    const a = state();
    const b = state();
    b.player.resources = { wood: 20, gold: 20 };
    expect(hashSimulationState(a)).toBe(hashSimulationState(b));
  });
});

describe("SimulationHasher", () => {
  it("treats -0 and 0 as the same value", () => {
    expect(new SimulationHasher().float(-0).value())
      .toBe(new SimulationHasher().float(0).value());
  });

  it("collapses every NaN to one marker", () => {
    const other = new Float64Array([NaN]);
    new Uint32Array(other.buffer)[0] = 0x12345678; // a different NaN payload
    expect(new SimulationHasher().float(other[0]).value())
      .toBe(new SimulationHasher().float(NaN).value());
  });

  it("separates values that are numerically close", () => {
    expect(new SimulationHasher().float(0.1 + 0.2).value())
      .not.toBe(new SimulationHasher().float(0.3).value());
  });

  it("depends on order", () => {
    expect(new SimulationHasher().int(1).int(2).value())
      .not.toBe(new SimulationHasher().int(2).int(1).value());
  });

  it("resets to a clean state", () => {
    const hasher = new SimulationHasher();
    const fresh = hasher.int(7).value();
    hasher.reset();
    expect(hasher.int(7).value()).toBe(fresh);
  });
});
