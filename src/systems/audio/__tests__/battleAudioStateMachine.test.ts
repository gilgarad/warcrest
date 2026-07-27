import { describe, expect, it } from "vitest";
import { BattleAudioStateMachine, type BattleAudioSnapshot } from "../battleAudioStateMachine";

function snapshot(overrides: Partial<BattleAudioSnapshot> = {}): BattleAudioSnapshot {
  return {
    nowMs: 0,
    engagedUnits: 0,
    activeProjectiles: 0,
    recentAttackEvents: 0,
    playerBaseHpRatio: 1,
    playerFortressHpRatio: 1,
    ...overrides,
  };
}

describe("BattleAudioStateMachine", () => {
  it("moves preparation -> battle-low when combat starts", () => {
    const machine = new BattleAudioStateMachine();
    expect(machine.update(snapshot()).state).toBe("preparation");
    expect(machine.update(snapshot({ nowMs: 100, engagedUnits: 2 })).state).toBe("battle-low");
  });

  it("enters high at the upper threshold and holds until both time and lower threshold release", () => {
    const machine = new BattleAudioStateMachine();
    expect(machine.update(snapshot({ nowMs: 100, engagedUnits: 6 })).state).toBe("battle-high");
    expect(machine.update(snapshot({ nowMs: 5900 })).state).toBe("battle-high");
    expect(machine.update(snapshot({ nowMs: 6200, engagedUnits: 2 })).state).toBe("battle-low");
    expect(machine.update(snapshot({ nowMs: 9200 })).state).toBe("preparation");
  });

  it("keeps a short battle-low tail before returning to preparation", () => {
    const machine = new BattleAudioStateMachine();
    machine.update(snapshot({ nowMs: 100, engagedUnits: 2 }));
    expect(machine.update(snapshot({ nowMs: 2000 })).state).toBe("battle-low");
    expect(machine.update(snapshot({ nowMs: 3100 })).state).toBe("preparation");
  });

  it("fires fortress warning once, requires recovery, and respects cooldown", () => {
    const machine = new BattleAudioStateMachine();
    expect(machine.update(snapshot({ nowMs: 0, playerFortressHpRatio: 0.3 })).triggerFortressWarning).toBe(true);
    expect(machine.update(snapshot({ nowMs: 1000, playerFortressHpRatio: 0.2 })).triggerFortressWarning).toBe(false);
    machine.update(snapshot({ nowMs: 2000, playerFortressHpRatio: 0.6 }));
    expect(machine.update(snapshot({ nowMs: 5000, playerFortressHpRatio: 0.3 })).triggerFortressWarning).toBe(false);
    machine.update(snapshot({ nowMs: 13000, playerFortressHpRatio: 0.6 }));
    expect(machine.update(snapshot({ nowMs: 14000, playerFortressHpRatio: 0.3 })).triggerFortressWarning).toBe(true);
  });
});
