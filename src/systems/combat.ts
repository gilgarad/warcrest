import { COMMANDS } from "../data/commands";

export interface CombatEncounterState {
  sequence: string[]; // command ids required, in order
  index: number; // how many have been correctly entered so far
  timeLimitMs: number;
}

/**
 * Builds the required command sequence for one combat encounter by sampling
 * `COMMANDS`. With only "attack" registered, every sequence is all-attack;
 * once more commands exist (e.g. "defend") this starts producing mixed
 * sequences with zero changes here — the Patapon-deck feel is meant to
 * emerge from the registry filling up, not from special-casing combat logic.
 */
export function createCombatEncounter(difficulty: number): CombatEncounterState {
  const length = Math.max(3, 3 + difficulty);
  const sequence: string[] = [];
  for (let i = 0; i < length; i++) {
    const cmd = COMMANDS[Math.floor(Math.random() * COMMANDS.length)];
    sequence.push(cmd.id);
  }
  return { sequence, index: 0, timeLimitMs: 3500 + length * 350 };
}

export type CommandResult = "correct" | "wrong" | "complete";

export function submitCommand(state: CombatEncounterState, commandId: string): CommandResult {
  if (commandId !== state.sequence[state.index]) return "wrong";
  state.index += 1;
  return state.index >= state.sequence.length ? "complete" : "correct";
}
