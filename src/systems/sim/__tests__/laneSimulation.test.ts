import { describe, expect, it, vi } from "vitest";
import { LaneSimulation, type LaneSimulationOptions } from "../laneSimulation";
import type { ScheduledCommand } from "../commands";

const hire = (tick: number): ScheduledCommand =>
  ({ tick, team: "player", command: { type: "hire-worker" } });

function make(overrides: Partial<Omit<LaneSimulationOptions, "hooks">> = {}) {
  const applied: ScheduledCommand[] = [];
  const rulesTicks: number[] = [];
  const sim = new LaneSimulation({
    seed: "test",
    hooks: {
      applyCommand: (entry: ScheduledCommand) => applied.push(entry),
      stepRules: (dt: number) => rulesTicks.push(dt),
    },
    ...overrides,
  });
  return { sim, applied, rulesTicks };
}

describe("LaneSimulation", () => {
  it("advances only in whole ticks", () => {
    const { sim, rulesTicks } = make();
    expect(sim.advance(1 / 60)).toBe(0); // half a tick buys nothing
    expect(sim.tick).toBe(0);
    expect(sim.advance(1 / 60)).toBe(1); // the halves add up
    expect(sim.tick).toBe(1);
    expect(rulesTicks).toEqual([sim.tickSec]);
  });

  it("keeps simulated time exactly proportional to ticks", () => {
    const { sim } = make();
    for (let i = 0; i < 30; i += 1) sim.advance(sim.tickSec);
    expect(sim.tick).toBe(30);
    expect(sim.elapsedSec).toBeCloseTo(1, 10);
  });

  it("applies a tick's commands before its rules", () => {
    const order: string[] = [];
    const sim = new LaneSimulation({
      seed: 1,
      hooks: {
        applyCommand: () => order.push("command"),
        stepRules: () => order.push("rules"),
      },
    });
    sim.enqueueCommand(hire(1));
    sim.advance(sim.tickSec);
    // Inputs must be visible to the tick they belong to.
    expect(order).toEqual(["command", "rules"]);
  });

  it("applies each command exactly once, on its own tick", () => {
    const { sim, applied } = make();
    sim.enqueueCommand(hire(3));
    for (let i = 0; i < 5; i += 1) sim.advance(sim.tickSec);
    expect(applied).toHaveLength(1);
    expect(applied[0].tick).toBe(3);
  });

  it("caps catch-up rather than compounding a stall", () => {
    const { sim } = make({ maxStepsPerFrame: 3 });
    // A ten-second hitch must not queue three hundred ticks.
    expect(sim.advance(10)).toBe(3);
  });

  it("clamps a huge frame before it reaches the accumulator", () => {
    const { sim } = make({ maxFrameSec: 0.1, maxStepsPerFrame: 100 });
    expect(sim.advance(60)).toBe(3); // 0.1s clamp / (1/30) = 3 ticks
  });

  it("holds at the barrier instead of running ahead", () => {
    const { sim } = make();
    // Standing in for a peer whose commands have not arrived.
    expect(sim.advance(sim.tickSec * 5, (tick) => tick <= 2)).toBe(2);
    expect(sim.tick).toBe(2);
  });

  it("resumes from where the barrier stopped it", () => {
    const { sim } = make();
    sim.advance(sim.tickSec * 5, (tick) => tick <= 2);
    sim.advance(sim.tickSec * 5);
    expect(sim.tick).toBeGreaterThan(2);
  });

  it("resolves deferred work on the tick it was booked for", () => {
    const { sim } = make();
    const done = vi.fn();
    sim.defer(3, done);
    sim.advance(sim.tickSec * 2);
    expect(done).not.toHaveBeenCalled();
    sim.advance(sim.tickSec);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("never resolves deferred work on the tick that booked it", () => {
    const { sim } = make();
    const done = vi.fn();
    sim.defer(0, done); // booked during tick 0; clamped up to one tick
    expect(done).not.toHaveBeenCalled();
    sim.step(); // tick 1 — the earliest it may run
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("drops deferred work whose guard has stopped holding", () => {
    const { sim } = make();
    const done = vi.fn();
    let alive = true;
    sim.defer(1, done, () => alive);
    alive = false;
    sim.step();
    expect(done).not.toHaveBeenCalled();
    expect(sim.pendingDeferred).toBe(0);
  });

  it("produces the same random sequence for the same seed", () => {
    const a = make().sim;
    const b = make().sim;
    expect(Array.from({ length: 20 }, () => a.random.next()))
      .toEqual(Array.from({ length: 20 }, () => b.random.next()));
  });

  it("reset returns it to a fresh state", () => {
    const { sim } = make();
    sim.enqueueCommand(hire(1));
    sim.defer(5, () => {});
    sim.advance(sim.tickSec * 3);
    sim.reset("test");
    expect(sim.tick).toBe(0);
    expect(sim.elapsedSec).toBe(0);
    expect(sim.pendingDeferred).toBe(0);
    expect(sim.peekCommands(1)).toEqual([]);
  });

  const runFrames = (frames: number[]) => {
    const seen: number[] = [];
    const sim = new LaneSimulation({
      seed: "determinism",
      hooks: {
        applyCommand: () => {},
        stepRules: () => seen.push(sim.random.next()),
      },
    });
    for (const frame of frames) sim.advance(frame);
    return { tick: sim.tick, seen };
  };

  /**
   * The property the whole design exists for: how the real time arrived does
   * not change the run. Uneven frames, dropped frames and idle frames all
   * produce the same ticks in the same order.
   */
  it("reaches the same state whether time arrives smoothly or unevenly", () => {
    const smooth = runFrames(Array.from({ length: 12 }, () => 1 / 30));
    const uneven = runFrames([0, 2 / 30, 0, 1 / 30, 5 / 30, 0, 4 / 30]);
    expect(uneven.tick).toBe(smooth.tick);
    expect(uneven.seen).toEqual(smooth.seen);
  });

  /**
   * A single frame longer than `maxFrameSec` deliberately loses the excess
   * rather than queueing a burst of catch-up ticks. That is the spiral-of-death
   * guard, so the run legitimately falls behind — recorded here so the
   * behaviour is a decision rather than a surprise.
   */
  it("loses time when one frame exceeds the clamp, instead of stampeding", () => {
    const smooth = runFrames(Array.from({ length: 12 }, () => 1 / 30));
    const stalled = runFrames([12 / 30]); // 0.4s in one frame, clamped to 0.25s
    expect(stalled.tick).toBeLessThan(smooth.tick);
    // What it does run is still a prefix of the same sequence.
    expect(stalled.seen).toEqual(smooth.seen.slice(0, stalled.seen.length));
  });
});
