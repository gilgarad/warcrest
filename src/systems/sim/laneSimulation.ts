import { CommandQueue, type ScheduledCommand } from "./commands";
import { DeterministicRandom } from "./deterministicRandom";

/**
 * The simulation runtime: the clock, the randomness, the command queue and the
 * deferred-work queue.
 *
 * These are the pieces lockstep actually depends on. Battle rules can be wrong
 * and the match still stays in sync; get *when* things happen wrong and the two
 * clients silently play different games. Gathering them here means the
 * determinism-critical machinery is one small class that runs in Node and is
 * tested directly, instead of being spread through a 5000-line scene.
 *
 * The rules themselves are injected. That is deliberate — this class is
 * finished and testable now, while rule migration continues around it.
 */

export interface LaneSimulationHooks {
  /** Applies one command's effect to the world. */
  applyCommand(entry: ScheduledCommand): void;
  /** Advances the battle rules by exactly one tick. */
  stepRules(deltaSec: number): void;
}

export interface LaneSimulationOptions {
  seed: string | number;
  hooks: LaneSimulationHooks;
  /** Length of one tick. The simulation only ever advances in whole ticks. */
  tickSec?: number;
  /** Longest real interval accepted in one go; guards the spiral of death. */
  maxFrameSec?: number;
  /** Ticks a single frame may run while catching up. */
  maxStepsPerFrame?: number;
}

interface DeferredWork {
  tick: number;
  guard: () => boolean;
  resolve: () => void;
}

export const DEFAULT_TICK_SEC = 1 / 30;
export const DEFAULT_MAX_FRAME_SEC = 0.25;
export const DEFAULT_MAX_STEPS_PER_FRAME = 8;

export class LaneSimulation {
  readonly tickSec: number;
  private readonly maxFrameSec: number;
  private readonly maxStepsPerFrame: number;
  private readonly hooks: LaneSimulationHooks;
  private readonly commands = new CommandQueue();
  private deferred: DeferredWork[] = [];
  private rng: DeterministicRandom;
  private currentTick = 0;
  private elapsed = 0;
  private accumulator = 0;

  constructor(options: LaneSimulationOptions) {
    this.hooks = options.hooks;
    this.tickSec = options.tickSec ?? DEFAULT_TICK_SEC;
    this.maxFrameSec = options.maxFrameSec ?? DEFAULT_MAX_FRAME_SEC;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? DEFAULT_MAX_STEPS_PER_FRAME;
    this.rng = new DeterministicRandom(options.seed);
  }

  get tick(): number {
    return this.currentTick;
  }

  /** Simulated seconds elapsed — always `tick * tickSec`, never wall clock. */
  get elapsedSec(): number {
    return this.elapsed;
  }

  get random(): DeterministicRandom {
    return this.rng;
  }

  reset(seed: string | number): void {
    this.rng = new DeterministicRandom(seed);
    this.currentTick = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.commands.clear();
    this.deferred = [];
  }

  enqueueCommand(entry: ScheduledCommand): void {
    this.commands.enqueue(entry);
  }

  /** Commands queued for a tick, without consuming them. */
  peekCommands(tick: number): ScheduledCommand[] {
    return this.commands.peek(tick);
  }

  /**
   * Books work for a future tick.
   *
   * Anything the simulation defers goes through here rather than a wall-clock
   * timer, so when it happens is a function of the tick count and identical on
   * every client. The minimum of one tick means deferred work can never resolve
   * on the tick that scheduled it.
   */
  defer(delayTicks: number, resolve: () => void, guard: () => boolean = () => true): void {
    this.deferred.push({ tick: this.currentTick + Math.max(1, delayTicks), guard, resolve });
  }

  get pendingDeferred(): number {
    return this.deferred.length;
  }

  /**
   * Consumes real time and runs whole ticks.
   *
   * `canStep` lets a networked match hold the simulation at the lockstep
   * barrier: returning false stops this frame rather than running ahead of the
   * opponent, since running ahead is exactly what desyncs.
   *
   * Returns how many ticks ran.
   */
  advance(frameSec: number, canStep: (tick: number) => boolean = () => true): number {
    this.accumulator += Math.min(Math.max(0, frameSec), this.maxFrameSec);
    let steps = 0;
    while (this.accumulator >= this.tickSec && steps < this.maxStepsPerFrame) {
      if (!canStep(this.currentTick + 1)) break;
      this.step();
      this.accumulator -= this.tickSec;
      steps += 1;
    }
    if (steps === this.maxStepsPerFrame) {
      // Too far behind to catch up this frame. Drop the backlog rather than
      // compound it; the game runs slow rather than skipping ticks, because
      // under lockstep every client must execute every tick.
      this.accumulator = 0;
    }
    return steps;
  }

  /** Runs exactly one tick. Used directly by tests and by replay tooling. */
  step(): void {
    this.currentTick += 1;
    this.elapsed += this.tickSec;
    for (const entry of this.commands.drain(this.currentTick)) {
      this.hooks.applyCommand(entry);
    }
    this.resolveDeferred();
    this.hooks.stepRules(this.tickSec);
  }

  private resolveDeferred(): void {
    if (this.deferred.length === 0) return;
    const due = this.deferred.filter((work) => work.tick <= this.currentTick);
    if (due.length === 0) return;
    this.deferred = this.deferred.filter((work) => work.tick > this.currentTick);
    for (const work of due) {
      if (!work.guard()) continue;
      work.resolve();
    }
  }
}
