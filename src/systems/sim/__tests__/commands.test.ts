import { describe, expect, it } from "vitest";
import { CommandQueue, type ScheduledCommand } from "../commands";

const at = (tick: number, team: "player" | "enemy" = "player"): ScheduledCommand =>
  ({ tick, team, command: { type: "hire-worker" } });

describe("CommandQueue", () => {
  it("starts empty", () => {
    const queue = new CommandQueue();
    expect(queue.size).toBe(0);
    expect(queue.drain(0)).toEqual([]);
  });

  it("returns only the commands for the requested tick", () => {
    const queue = new CommandQueue();
    queue.enqueue(at(5));
    queue.enqueue(at(7));
    expect(queue.drain(5)).toHaveLength(1);
    expect(queue.drain(5)).toHaveLength(0);
    expect(queue.size).toBe(1);
  });

  it("keeps insertion order within a team", () => {
    const queue = new CommandQueue();
    queue.enqueue({ tick: 1, team: "player", command: { type: "advance-age" } });
    queue.enqueue({ tick: 1, team: "player", command: { type: "instant-wave" } });
    expect(queue.drain(1).map((entry) => entry.command.type)).toEqual(["advance-age", "instant-wave"]);
  });

  /**
   * Two peers applying the same commands in a different order can reach
   * different states, so the order has to be fixed rather than incidental.
   */
  it("applies player commands before enemy commands regardless of arrival order", () => {
    const queue = new CommandQueue();
    queue.enqueue(at(2, "enemy"));
    queue.enqueue(at(2, "player"));
    expect(queue.drain(2).map((entry) => entry.team)).toEqual(["player", "enemy"]);
  });

  it("peek does not consume", () => {
    const queue = new CommandQueue();
    queue.enqueue(at(3));
    expect(queue.peek(3)).toHaveLength(1);
    expect(queue.peek(3)).toHaveLength(1);
    expect(queue.size).toBe(1);
  });

  it("lists pending commands from a tick onward, in tick order", () => {
    const queue = new CommandQueue();
    queue.enqueue(at(9));
    queue.enqueue(at(4));
    queue.enqueue(at(6));
    expect(queue.pendingFrom(5).map((entry) => entry.tick)).toEqual([6, 9]);
  });

  it("clears everything", () => {
    const queue = new CommandQueue();
    queue.enqueue(at(1));
    queue.enqueue(at(2));
    queue.clear();
    expect(queue.size).toBe(0);
  });

  it("carries the target inside the command rather than relying on selection", () => {
    const queue = new CommandQueue();
    queue.enqueue({ tick: 1, team: "player", command: { type: "build", pointId: 2, buildingId: "defense_tower" } });
    const [entry] = queue.drain(1);
    expect(entry.command).toEqual({ type: "build", pointId: 2, buildingId: "defense_tower" });
  });

  it("survives being drained for ticks that were never scheduled", () => {
    const queue = new CommandQueue();
    queue.enqueue(at(10));
    for (let tick = 0; tick < 10; tick += 1) expect(queue.drain(tick)).toEqual([]);
    expect(queue.drain(10)).toHaveLength(1);
  });
});
