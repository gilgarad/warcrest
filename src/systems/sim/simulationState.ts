/**
 * The definition of "simulation state".
 *
 * This file is the boundary between simulation and presentation, written down.
 * A field belongs here if changing it can change the outcome of the battle; it
 * stays out if it only affects how the battle looks.
 *
 * Getting the line wrong is expensive in both directions:
 * - Include a presentation field (`visualProgress`, `walkCyclePhase`) and two
 *   clients running at different frame rates will be flagged as desynced while
 *   playing the same game perfectly.
 * - Omit a simulation field and a real divergence goes unnoticed until the two
 *   players see different winners.
 *
 * `attackAnimTime` is the instructive case: it sounds like animation, but
 * `advanceUnit()` reads it to decide whether a unit may move, so it is
 * simulation.
 */

export interface SimUnitState {
  id: number;
  team: string;
  unitId: string;
  role: string;
  laneId: string;
  progress: number;
  laneRow: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  range: number;
  speed: number;
  attackCooldownSec: number;
  attackTimerSec: number;
  /** Gates movement in `advanceUnit`, so simulation despite the name. */
  attackAnimTime: number;
  attackFacingLockSec: number;
  combatFacingHoldSec: number;
  attackTargetKind: string;
  attackSequence: number;
  manaCurrent: number;
  manaMax: number;
  attrition: number;
  /** Committed target from `acquireTarget`; drives steering and attacks. */
  targetId: number;
}

export interface SimTeamState {
  ageId: string;
  baseHp: number;
  baseMaxHp: number;
  nextWaveInSec: number;
  instantWaveTokens: number;
  resources: Record<string, number>;
  workers: Record<string, number>;
}

export interface SimCapturePointState {
  id: number;
  owner: string;
  control: number;
  buildingId: string;
  buildingLevel: number;
  attackTimerSec: number;
  incomeTimerSec: number;
  supplyTimerSec: number;
  manaCurrent: number;
}

export interface SimDefenseTowerState {
  id: number;
  owner: string;
  built: boolean;
  hp: number;
  maxHp: number;
  defense: number;
  attackTimerSec: number;
  buildRemainingSec: number;
}

/** Everything needed to say two simulations are in the same state. */
export interface SimulationStateView {
  tick: number;
  elapsedSec: number;
  rngState: number;
  player: SimTeamState;
  enemy: SimTeamState;
  units: SimUnitState[];
  capturePoints: SimCapturePointState[];
  defenseTowers: SimDefenseTowerState[];
}
