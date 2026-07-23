import { COMMANDS } from "../data/commands";

export interface SlotState {
  commandId: string;
  remainingMs: number; // 0 = ready to press
}

export interface CombatEncounterState {
  enemyHp: number;
  enemyMaxHp: number;
  slots: SlotState[];
  guardMs: number; // > 0 while a defend press is actively blocking
  enemyAttackInMs: number; // countdown to the next enemy attack
  enemyAttackIntervalMs: number;
}

/**
 * MMO-hotbar-style combat: no popup, no scripted sequence. The enemy has HP
 * and attacks on its own timer; the player presses cooldown-gated slots
 * (offense chips away HP, defense opens a brief guard window) at whatever
 * pace the fight demands — "적재적소에" rather than a fixed order.
 */
export function createCombatEncounter(difficulty: number): CombatEncounterState {
  const enemyHp = 3 + difficulty;
  return {
    enemyHp,
    enemyMaxHp: enemyHp,
    slots: COMMANDS.map((cmd) => ({ commandId: cmd.id, remainingMs: 0 })),
    guardMs: 0,
    enemyAttackInMs: 1700,
    enemyAttackIntervalMs: 1700,
  };
}

export type TickResult = "ongoing" | "hit";

/** Advances cooldowns and the enemy's attack timer. Call every frame. */
export function tickCombat(state: CombatEncounterState, deltaMs: number): TickResult {
  state.slots.forEach((s) => {
    if (s.remainingMs > 0) s.remainingMs = Math.max(0, s.remainingMs - deltaMs);
  });
  if (state.guardMs > 0) state.guardMs = Math.max(0, state.guardMs - deltaMs);

  state.enemyAttackInMs -= deltaMs;
  if (state.enemyAttackInMs <= 0) {
    state.enemyAttackInMs += state.enemyAttackIntervalMs;
    return state.guardMs > 0 ? "ongoing" : "hit";
  }
  return "ongoing";
}

export type PressResult = "cooling" | "win" | "ok";

/** Presses one slot by command id. No-op (returns "cooling") if not ready. */
export function pressSlot(state: CombatEncounterState, commandId: string): PressResult {
  const slot = state.slots.find((s) => s.commandId === commandId);
  const cmd = COMMANDS.find((c) => c.id === commandId);
  if (!slot || !cmd || slot.remainingMs > 0) return "cooling";

  slot.remainingMs = cmd.cooldownMs;
  if (cmd.role === "offense") {
    state.enemyHp -= 1;
    if (state.enemyHp <= 0) return "win";
  } else {
    state.guardMs = 500;
  }
  return "ok";
}
