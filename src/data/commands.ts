/**
 * Registry of combat commands (the Patapon-style "deck"). Only "공격" exists
 * today. Add entries here (e.g. "방어") to widen the deck — CombatEncounter
 * picks required commands from this list generically, and RunScene renders
 * one button per entry, so nothing else needs to change to add a command.
 */
export interface CommandDef {
  id: string;
  label: string;
  color: number;
}

export const COMMANDS: CommandDef[] = [
  { id: "attack", label: "공격", color: 0xe74c3c },
];

export function getCommand(id: string): CommandDef {
  const found = COMMANDS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown command: ${id}`);
  return found;
}
