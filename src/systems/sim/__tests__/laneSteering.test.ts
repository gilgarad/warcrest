import { describe, expect, it } from "vitest";
import {
  canAttackEnemyFromSlot,
  getForwardLaneCongestion,
  getFriendlySlotCongestion,
  getMirrorLanePreference,
  isCombatSlotFree,
  isLaneRowFree,
  isMeleeUnit,
  isRangedUnit,
  unitDistance,
  type SteeringUnit,
} from "../laneSteering";

/**
 * These run in Node with no Phaser and no browser, which is the whole point of
 * moving them off the scene: this logic decides who fights whom, and it was
 * previously only reachable by launching a game.
 */
const unit = (over: Partial<SteeringUnit> = {}): SteeringUnit => ({
  id: 1, team: "player", laneId: "main", role: "battle",
  progress: 0.5, laneRow: 0, range: 2.5, ...over,
});

describe("laneSteering", () => {
  it("classifies melee and ranged by reach", () => {
    expect(isMeleeUnit(unit({ range: 2.5 }))).toBe(true);
    expect(isMeleeUnit(unit({ range: 2.6 }))).toBe(false);
    expect(isRangedUnit(unit({ range: 5 }))).toBe(true);
    // Support units are neither, whatever their reach.
    expect(isMeleeUnit(unit({ role: "support", range: 1 }))).toBe(false);
    expect(isRangedUnit(unit({ role: "support", range: 9 }))).toBe(false);
  });

  it("measures distance with rows scaled into progress units", () => {
    expect(unitDistance(unit(), unit({ id: 2 }))).toBe(0);
    // A whole row apart is a much smaller distance than the same number in
    // progress, which is why rows are scaled.
    const rowApart = unitDistance(unit(), unit({ id: 2, laneRow: 1 }));
    const progressApart = unitDistance(unit(), unit({ id: 2, progress: 1.5 }));
    expect(rowApart).toBeLessThan(progressApart);
  });

  it("treats a row as free when only enemies or other lanes are near", () => {
    const me = unit();
    expect(isLaneRowFree([me, unit({ id: 2, team: "enemy" })], me, 0)).toBe(true);
    expect(isLaneRowFree([me, unit({ id: 3, laneId: "north" })], me, 0)).toBe(true);
  });

  it("treats a row as blocked by a close friendly unit", () => {
    const me = unit();
    expect(isLaneRowFree([me, unit({ id: 2 })], me, 0)).toBe(false);
  });

  it("ignores a friendly unit that is far enough along the lane", () => {
    const me = unit();
    expect(isLaneRowFree([me, unit({ id: 2, progress: 0.9 })], me, 0)).toBe(true);
  });

  it("rejects a combat slot beyond the reachable rows", () => {
    const me = unit();
    const enemy = unit({ id: 9, team: "enemy" });
    expect(isCombatSlotFree([me], me, { progress: 0.5, laneRow: 99 }, enemy)).toBe(false);
  });

  it("rejects a combat slot a friendly unit already stands in", () => {
    const me = unit();
    const enemy = unit({ id: 9, team: "enemy" });
    const slot = { progress: 0.5, laneRow: 0 };
    expect(isCombatSlotFree([me], me, slot, enemy)).toBe(true);
    expect(isCombatSlotFree([me, unit({ id: 2 })], me, slot, enemy)).toBe(false);
  });

  it("knows whether a slot puts the enemy in reach", () => {
    const melee = unit({ range: 2.5 });
    const enemy = unit({ id: 9, team: "enemy", progress: 0.5 });
    expect(canAttackEnemyFromSlot(melee, { progress: 0.5, laneRow: 0 }, enemy)).toBe(true);
    expect(canAttackEnemyFromSlot(melee, { progress: 0.9, laneRow: 0 }, enemy)).toBe(false);
    // A longer reach turns the same slot into a valid one.
    expect(canAttackEnemyFromSlot(unit({ range: 40 }), { progress: 0.9, laneRow: 0 }, enemy)).toBe(true);
  });

  it("scores congestion higher for units directly ahead", () => {
    const me = unit({ progress: 0.5 });
    const close = getForwardLaneCongestion([me, unit({ id: 2, progress: 0.505 })], me, 0);
    const far = getForwardLaneCongestion([me, unit({ id: 2, progress: 0.56 })], me, 0);
    expect(close).toBeGreaterThan(far);
    expect(getForwardLaneCongestion([me], me, 0)).toBe(0);
  });

  it("counts congestion only for its own team and lane", () => {
    const me = unit();
    expect(getForwardLaneCongestion([me, unit({ id: 2, team: "enemy", progress: 0.505 })], me, 0)).toBe(0);
    expect(getFriendlySlotCongestion([me, unit({ id: 3, laneId: "north" })], me, 0.5, 0)).toBe(0);
  });

  it("prefers turning toward the enemy", () => {
    const me = unit({ laneRow: 0 });
    const enemyAbove = unit({ id: 9, team: "enemy", laneRow: 2 });
    expect(getMirrorLanePreference(me, 1, enemyAbove)).toBe(0);
    expect(getMirrorLanePreference(me, -1, enemyAbove)).toBe(1);
  });

  it("splits the tie by unit id when there is no enemy to lean toward", () => {
    // Otherwise a whole column would swerve the same way at the same moment.
    expect(getMirrorLanePreference(unit({ id: 2, laneRow: 0 }), 1)).toBe(0);
    expect(getMirrorLanePreference(unit({ id: 3, laneRow: 0 }), 1)).toBe(1);
  });
});
