import type { BattleCommand, CommandTeam, ScheduledCommand } from "../sim/commands";

/**
 * The rule both peers obey so their simulations stay identical.
 *
 * Lockstep in one sentence: nobody simulates tick T until *everyone's* commands
 * for tick T have arrived. Each peer therefore runs the same commands on the
 * same ticks in the same order, and two deterministic simulations given
 * identical input stay identical.
 *
 * The cost is latency: a peer cannot run ahead of the slowest link. Input delay
 * hides it — a command issued now is scheduled a few ticks into the future, so
 * it has time to cross the network before the tick it belongs to comes up. That
 * is why a click feels slightly delayed in lockstep games, and why the delay is
 * a tuning value rather than a bug.
 *
 * Transport-agnostic on purpose: this decides *when* it is legal to advance and
 * *whether* the peers still agree, and knows nothing about sockets.
 */

export interface LockstepFrame {
  tick: number;
  commands: ScheduledCommand[];
  /** Sender's simulation hash for an already-simulated tick, when it has one. */
  hash?: { tick: number; value: number };
}

export type DesyncReport = { tick: number; localHash: number; remoteHash: number };

export interface LockstepOptions {
  /** Ticks between issuing a command and executing it. */
  inputDelayTicks: number;
  /** How often to exchange a state hash, in ticks. 0 disables the check. */
  hashEveryTicks: number;
}

export const DEFAULT_LOCKSTEP_OPTIONS: LockstepOptions = {
  // Three ticks at 30Hz is 100ms of cover — enough for a normal connection
  // without the input feeling sluggish.
  inputDelayTicks: 3,
  hashEveryTicks: 30,
};

export class LockstepSession {
  private readonly localFrames = new Map<number, ScheduledCommand[]>();
  private readonly remoteFrames = new Map<number, ScheduledCommand[]>();
  private readonly localHashes = new Map<number, number>();
  private readonly remoteHashes = new Map<number, number>();
  private desync: DesyncReport | null = null;
  /** Highest tick whose commands are already known from a reconnect replay. */
  private replayHorizon = 0;

  constructor(
    private readonly localTeam: CommandTeam,
    private readonly options: LockstepOptions = DEFAULT_LOCKSTEP_OPTIONS,
  ) {}

  get inputDelayTicks(): number {
    return this.options.inputDelayTicks;
  }

  /** The tick a command issued now should execute on. */
  scheduleTickFor(currentTick: number): number {
    return currentTick + this.options.inputDelayTicks;
  }

  /**
   * Records what this client will do on a future tick and returns the frame to
   * send. A frame is sent every tick even when empty — silence is
   * indistinguishable from a stalled peer, and the barrier would never open.
   */
  buildLocalFrame(tick: number, commands: BattleCommand[], hash?: { tick: number; value: number }): LockstepFrame {
    const scheduled = commands.map((command) => ({ tick, team: this.localTeam, command }));
    this.localFrames.set(tick, scheduled);
    if (hash) this.localHashes.set(hash.tick, hash.value);
    return { tick, commands: scheduled, hash };
  }

  receiveRemoteFrame(frame: LockstepFrame): void {
    this.remoteFrames.set(frame.tick, frame.commands);
    if (frame.hash) {
      this.remoteHashes.set(frame.hash.tick, frame.hash.value);
      this.compareHashes(frame.hash.tick);
    }
  }

  /**
   * Whether tick `tick` may be simulated.
   *
   * The first `inputDelayTicks` ticks run unblocked: no command can be
   * scheduled that early, so there is nothing to wait for and the match does
   * not stall at the starting line.
   */
  canAdvance(tick: number): boolean {
    if (this.desync) return false;
    if (tick <= this.options.inputDelayTicks) return true;
    if (tick <= this.replayHorizon) return true;
    return this.remoteFrames.has(tick);
  }

  /**
   * Opens the barrier across ticks replayed from the relay's frame log after a
   * reconnect.
   *
   * Those ticks' commands are already known in full, for both sides, so there
   * is nothing left to wait for. The usual "has the peer's frame arrived?" test
   * would refuse to advance, because replayed commands go straight into the
   * simulation's queue rather than arriving as remote frames.
   */
  allowReplayThrough(tick: number): void {
    this.replayHorizon = Math.max(this.replayHorizon, tick);
  }

  get replayThrough(): number {
    return this.replayHorizon;
  }

  /** Commands to apply on a tick, local and remote together. */
  commandsFor(tick: number): ScheduledCommand[] {
    return [...(this.localFrames.get(tick) ?? []), ...(this.remoteFrames.get(tick) ?? [])];
  }

  /** Frees state for ticks already simulated. */
  release(upToTick: number): void {
    for (const map of [this.localFrames, this.remoteFrames]) {
      for (const tick of [...map.keys()]) if (tick < upToTick) map.delete(tick);
    }
  }

  recordLocalHash(tick: number, value: number): void {
    if (this.options.hashEveryTicks <= 0) return;
    this.localHashes.set(tick, value);
    this.compareHashes(tick);
  }

  shouldHashAt(tick: number): boolean {
    return this.options.hashEveryTicks > 0 && tick % this.options.hashEveryTicks === 0;
  }

  /**
   * The two simulations disagreed. Reported rather than repaired: once states
   * diverge, continuing means the players are watching different games, and
   * saying so beats letting them play on toward different winners.
   */
  getDesync(): DesyncReport | null {
    return this.desync;
  }

  private compareHashes(tick: number): void {
    if (this.desync) return;
    const local = this.localHashes.get(tick);
    const remote = this.remoteHashes.get(tick);
    if (local === undefined || remote === undefined || local === remote) return;
    this.desync = { tick, localHash: local, remoteHash: remote };
  }
}
