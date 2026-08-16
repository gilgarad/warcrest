import type { SimulationStateView } from "./simulationState";

/**
 * Folds a simulation state into a 32-bit fingerprint.
 *
 * Two uses, one implementation:
 * - **Live desync detection.** Peers swap hashes every so often during a match;
 *   a mismatch means the two clients are no longer playing the same game, and
 *   it is far better to say so than to let both sides play on toward different
 *   winners.
 * - **Regression testing.** Same seed plus same commands must produce the same
 *   hash sequence. Anything that quietly breaks determinism — a stray
 *   `Math.random()`, a clock read, an unstable iteration order — shows up as a
 *   diverging hash.
 *
 * Floats are folded by their exact bits rather than rounded. Rounding would
 * hide precisely the small divergences the hash exists to catch.
 */
export class SimulationHasher {
  private hash = 0x811c9dc5;
  private readonly floatView = new Float64Array(1);
  private readonly wordView = new Uint32Array(this.floatView.buffer);

  reset(): void {
    this.hash = 0x811c9dc5;
  }

  int(value: number): this {
    return this.mix(value | 0);
  }

  bool(value: boolean): this {
    return this.mix(value ? 1 : 0);
  }

  /**
   * Folds a double by its bit pattern.
   *
   * `-0` is normalized to `0`: the two are equal in every comparison the game
   * makes but have different bits, so leaving them distinct would report a
   * desync between states that behave identically. `NaN` has many valid bit
   * patterns for the same reason, so it collapses to one marker.
   */
  float(value: number): this {
    if (Number.isNaN(value)) return this.mix(0x7ff80000).mix(0);
    this.floatView[0] = value === 0 ? 0 : value;
    return this.mix(this.wordView[0]).mix(this.wordView[1]);
  }

  text(value: string): this {
    for (let i = 0; i < value.length; i += 1) this.mix(value.charCodeAt(i));
    return this.mix(value.length);
  }

  /** Order matters: the same numbers in a different order hash differently. */
  private mix(value: number): this {
    this.hash ^= value >>> 0;
    this.hash = Math.imul(this.hash, 0x01000193) >>> 0;
    return this;
  }

  value(): number {
    return this.hash >>> 0;
  }
}

/** Sorted so a difference in array order never masquerades as a desync. */
function sortedKeys(record: Record<string, number>): string[] {
  return Object.keys(record).sort();
}

export function hashSimulationState(state: SimulationStateView): number {
  const hasher = new SimulationHasher();
  hasher.int(state.tick).float(state.elapsedSec).int(state.rngState);

  for (const team of [state.player, state.enemy]) {
    hasher
      .text(team.ageId)
      .float(team.baseHp)
      .float(team.baseMaxHp)
      .float(team.nextWaveInSec)
      .int(team.instantWaveTokens);
    for (const key of sortedKeys(team.resources)) hasher.text(key).float(team.resources[key]);
    for (const key of sortedKeys(team.workers)) hasher.text(key).float(team.workers[key]);
  }

  // Units are hashed in their simulation array order, which is itself part of
  // the state: `enforceFriendlySpacing` and the combat loop both depend on it,
  // so two clients whose unit lists are ordered differently are genuinely out
  // of sync even if every unit matches.
  hasher.int(state.units.length);
  for (const unit of state.units) {
    hasher
      .int(unit.id)
      .text(unit.team)
      .text(unit.unitId)
      .text(unit.role)
      .text(unit.laneId)
      .float(unit.progress)
      .float(unit.laneRow)
      .float(unit.hp)
      .float(unit.maxHp)
      .float(unit.attack)
      .float(unit.defense)
      .float(unit.range)
      .float(unit.speed)
      .float(unit.attackCooldownSec)
      .float(unit.attackTimerSec)
      .float(unit.attackAnimTime)
      .float(unit.attackFacingLockSec)
      .float(unit.combatFacingHoldSec)
      .text(unit.attackTargetKind)
      .int(unit.attackSequence)
      .float(unit.manaCurrent)
      .float(unit.manaMax)
      .float(unit.attrition)
      .int(unit.targetId);
  }

  hasher.int(state.capturePoints.length);
  for (const point of state.capturePoints) {
    hasher
      .int(point.id)
      .text(point.owner)
      .float(point.control)
      .text(point.buildingId)
      .int(point.buildingLevel)
      .float(point.attackTimerSec)
      .float(point.incomeTimerSec)
      .float(point.supplyTimerSec)
      .float(point.manaCurrent);
  }

  hasher.int(state.defenseTowers.length);
  for (const tower of state.defenseTowers) {
    hasher
      .int(tower.id)
      .text(tower.owner)
      .bool(tower.built)
      .float(tower.hp)
      .float(tower.maxHp)
      .float(tower.defense)
      .float(tower.attackTimerSec)
      .float(tower.buildRemainingSec);
  }

  return hasher.value();
}
