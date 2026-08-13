import { describe, expect, it } from "vitest";
import { DEFAULT_LOCKSTEP_OPTIONS, LockstepSession } from "../lockstepSession";

const opts = { inputDelayTicks: 3, hashEveryTicks: 10 };
const session = () => new LockstepSession("player", opts);

describe("LockstepSession", () => {
  it("schedules a command far enough ahead for it to cross the network", () => {
    expect(session().scheduleTickFor(100)).toBe(103);
  });

  it("runs the opening ticks unblocked so the match does not stall at the start", () => {
    const local = session();
    for (let tick = 0; tick <= opts.inputDelayTicks; tick += 1) {
      expect(local.canAdvance(tick)).toBe(true);
    }
  });

  it("blocks a tick until the remote frame for it arrives", () => {
    const local = session();
    expect(local.canAdvance(10)).toBe(false);
    local.receiveRemoteFrame({ tick: 10, commands: [] });
    expect(local.canAdvance(10)).toBe(true);
  });

  it("an empty frame still opens the barrier", () => {
    const local = session();
    local.receiveRemoteFrame({ tick: 7, commands: [] });
    expect(local.canAdvance(7)).toBe(true);
  });

  it("applies local and remote commands for the same tick together", () => {
    const local = session();
    local.buildLocalFrame(5, [{ type: "hire-worker" }]);
    local.receiveRemoteFrame({
      tick: 5,
      commands: [{ tick: 5, team: "enemy", command: { type: "advance-age" } }],
    });
    expect(local.commandsFor(5).map((entry) => entry.team)).toEqual(["player", "enemy"]);
  });

  it("stamps local commands with the local team", () => {
    const frame = new LockstepSession("enemy", opts).buildLocalFrame(2, [{ type: "instant-wave" }]);
    expect(frame.commands[0].team).toBe("enemy");
  });

  it("reports a desync when the two hashes for a tick differ", () => {
    const local = session();
    local.recordLocalHash(10, 111);
    local.receiveRemoteFrame({ tick: 11, commands: [], hash: { tick: 10, value: 222 } });
    expect(local.getDesync()).toEqual({ tick: 10, localHash: 111, remoteHash: 222 });
  });

  it("stays quiet when the hashes agree", () => {
    const local = session();
    local.recordLocalHash(10, 111);
    local.receiveRemoteFrame({ tick: 11, commands: [], hash: { tick: 10, value: 111 } });
    expect(local.getDesync()).toBeNull();
  });

  it("detects a desync no matter which side arrives first", () => {
    const local = session();
    local.receiveRemoteFrame({ tick: 11, commands: [], hash: { tick: 10, value: 222 } });
    expect(local.getDesync()).toBeNull(); // nothing to compare against yet
    local.recordLocalHash(10, 111);
    expect(local.getDesync()?.tick).toBe(10);
  });

  it("stops advancing once desynced, rather than playing on into two different games", () => {
    const local = session();
    local.receiveRemoteFrame({ tick: 20, commands: [] });
    expect(local.canAdvance(20)).toBe(true);
    local.recordLocalHash(10, 1);
    local.receiveRemoteFrame({ tick: 21, commands: [], hash: { tick: 10, value: 2 } });
    expect(local.canAdvance(20)).toBe(false);
  });

  it("keeps the first desync rather than overwriting it with later noise", () => {
    const local = session();
    local.recordLocalHash(10, 1);
    local.receiveRemoteFrame({ tick: 11, commands: [], hash: { tick: 10, value: 2 } });
    local.recordLocalHash(20, 3);
    local.receiveRemoteFrame({ tick: 21, commands: [], hash: { tick: 20, value: 4 } });
    expect(local.getDesync()?.tick).toBe(10);
  });

  it("hashes on the configured interval only", () => {
    const local = session();
    expect(local.shouldHashAt(10)).toBe(true);
    expect(local.shouldHashAt(11)).toBe(false);
  });

  it("can have the hash check disabled", () => {
    const off = new LockstepSession("player", { inputDelayTicks: 2, hashEveryTicks: 0 });
    off.recordLocalHash(10, 1);
    off.receiveRemoteFrame({ tick: 11, commands: [], hash: { tick: 10, value: 999 } });
    expect(off.shouldHashAt(10)).toBe(false);
    expect(off.getDesync()).toBeNull();
  });

  it("releases simulated ticks without touching upcoming ones", () => {
    const local = session();
    local.buildLocalFrame(5, []);
    local.receiveRemoteFrame({ tick: 5, commands: [] });
    local.buildLocalFrame(9, [{ type: "hire-worker" }]);
    local.release(9);
    expect(local.commandsFor(5)).toEqual([]);
    expect(local.commandsFor(9)).toHaveLength(1);
  });

  it("ships a default input delay that covers a normal connection", () => {
    expect(DEFAULT_LOCKSTEP_OPTIONS.inputDelayTicks).toBeGreaterThan(0);
    // 30Hz ticks: the delay must stay well under a noticeable input lag.
    expect(DEFAULT_LOCKSTEP_OPTIONS.inputDelayTicks / 30).toBeLessThanOrEqual(0.15);
  });
});
