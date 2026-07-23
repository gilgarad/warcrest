/**
 * Registry of combat commands (an MMO-style hotbar, not a scripted sequence).
 * Each command has a `role` (offense damages the enemy, defense opens a
 * guard window) and its own `cooldownMs`. Combat logic (`systems/combat.ts`)
 * and the UI (`DungeonScene`'s action panel) both iterate this list
 * generically — adding a new command (a second offense skill, a heal, etc.)
 * means adding one entry here.
 */
export interface CommandDef {
  id: string;
  label: string;
  color: number;
  role: "offense" | "defense";
  cooldownMs: number;
}

export const COMMANDS: CommandDef[] = [
  { id: "attack", label: "공격", color: 0xe74c3c, role: "offense", cooldownMs: 650 },
  { id: "defend", label: "방어", color: 0x3d8bd9, role: "defense", cooldownMs: 1500 },
];

export function getCommand(id: string): CommandDef {
  const found = COMMANDS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown command: ${id}`);
  return found;
}
