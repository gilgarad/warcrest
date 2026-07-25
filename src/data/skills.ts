export interface SkillDef {
  id: string;
  label: string;
  color: number;
  manaCost: number;
  cooldownMs: number;
  kind: "heal" | "strike";
}

export const SKILLS: SkillDef[] = [
  {
    id: "heal",
    label: "치유",
    color: 0x2ecc71,
    manaCost: 16,
    cooldownMs: 2600,
    kind: "heal",
  },
  {
    id: "strike",
    label: "강타",
    color: 0xe67e22,
    manaCost: 24,
    cooldownMs: 4200,
    kind: "strike",
  },
];

export function getSkill(id: string): SkillDef {
  const found = SKILLS.find((skill) => skill.id === id);
  if (!found) throw new Error(`Unknown skill: ${id}`);
  return found;
}
