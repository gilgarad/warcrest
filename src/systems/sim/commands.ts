/**
 * Player intent, expressed as data.
 *
 * Everything a player can do to the simulation goes through one of these. Two
 * properties matter and neither is optional:
 *
 * 1. **Self-contained.** A command names its target (`pointId`, `towerId`)
 *    rather than relying on "whatever is selected". Selection is local UI
 *    state — the opponent has no idea what you clicked, so a command that
 *    depends on it cannot cross a network.
 * 2. **Scheduled.** A command executes on a specific tick, not "now". Both
 *    peers must apply the same command on the same tick or their simulations
 *    diverge, so the tick is part of the command rather than an accident of
 *    when the packet arrived.
 *
 * Single-player runs through this same path, which is deliberate: the code
 * that PvP depends on is then exercised by every ordinary game, instead of
 * only waking up when someone starts a match.
 */

export type WorkerRoleId = "gold" | "wood" | "food" | "metal" | "idle" | "research";

export type BattleCommand =
  | { type: "hire-worker" }
  | { type: "hire-research-worker" }
  | { type: "shift-worker"; role: WorkerRoleId; delta: 1 | -1 }
  | { type: "build"; pointId: number; buildingId: string }
  | { type: "dismantle"; pointId: number }
  | { type: "rebuild-tower"; towerId: number }
  | { type: "advance-age" }
  | { type: "instant-wave" }
  | { type: "apply-research" };

export type CommandTeam = "player" | "enemy";

export interface ScheduledCommand {
  /** Simulation tick this executes on. */
  tick: number;
  team: CommandTeam;
  command: BattleCommand;
}

/**
 * Commands waiting to execute, bucketed by tick.
 *
 * Ordering inside a tick is insertion order per team, then player before
 * enemy — fixed rather than incidental, because two peers that apply the same
 * commands in a different order can reach different states.
 */
export class CommandQueue {
  private readonly byTick = new Map<number, ScheduledCommand[]>();

  enqueue(entry: ScheduledCommand): void {
    const bucket = this.byTick.get(entry.tick);
    if (bucket) bucket.push(entry);
    else this.byTick.set(entry.tick, [entry]);
  }

  /** Commands for a tick, in the order they must be applied. */
  peek(tick: number): ScheduledCommand[] {
    const bucket = this.byTick.get(tick);
    if (!bucket) return [];
    return [...bucket].sort((a, b) => teamRank(a.team) - teamRank(b.team));
  }

  /** Removes and returns the commands for a tick. */
  drain(tick: number): ScheduledCommand[] {
    const entries = this.peek(tick);
    this.byTick.delete(tick);
    return entries;
  }

  /** Commands still queued for ticks at or after `tick`. */
  pendingFrom(tick: number): ScheduledCommand[] {
    const pending: ScheduledCommand[] = [];
    for (const [queuedTick, bucket] of this.byTick) {
      if (queuedTick >= tick) pending.push(...bucket);
    }
    return pending.sort((a, b) => a.tick - b.tick || teamRank(a.team) - teamRank(b.team));
  }

  clear(): void {
    this.byTick.clear();
  }

  get size(): number {
    let total = 0;
    for (const bucket of this.byTick.values()) total += bucket.length;
    return total;
  }
}

function teamRank(team: CommandTeam): number {
  return team === "player" ? 0 : 1;
}

/**
 * Ticks between issuing a command and executing it.
 *
 * Zero is correct for a local game. A networked match raises this so a
 * command has time to reach the other peer before the tick it belongs to —
 * the standard lockstep input delay.
 */
export const LOCAL_INPUT_DELAY_TICKS = 0;
