/**
 * Registry of fork-outcome kinds. "combat" and "rescue" are randomly
 * assignable at a fork; "mission" is reserved for the guaranteed final step.
 * To add a new randomly-assignable kind (e.g. "trap", "resource"): add an
 * entry with weight > 0 here, then give RunScene a handler for it (see
 * `docs/patterns/README.md` for the extension note).
 */
export type EncounterKind = "combat" | "rescue" | "mission";

export interface EncounterKindDef {
  kind: EncounterKind;
  label: string;
  hintIcon: string;
  /** relative weight when randomly picking a fork candidate; 0 = never random */
  weight: number;
}

export const ENCOUNTER_KINDS: EncounterKindDef[] = [
  { kind: "combat", label: "전투", hintIcon: "⚔", weight: 2 },
  { kind: "rescue", label: "구출", hintIcon: "🔗", weight: 1 },
  { kind: "mission", label: "미션", hintIcon: "🚩", weight: 0 },
];

export function pickRandomForkKind(): EncounterKind {
  const pool = ENCOUNTER_KINDS.filter((k) => k.weight > 0);
  const total = pool.reduce((sum, k) => sum + k.weight, 0);
  let roll = Math.random() * total;
  for (const k of pool) {
    if (roll < k.weight) return k.kind;
    roll -= k.weight;
  }
  return pool[0].kind;
}

export function getEncounterKindDef(kind: EncounterKind): EncounterKindDef {
  const found = ENCOUNTER_KINDS.find((k) => k.kind === kind);
  if (!found) throw new Error(`Unknown encounter kind: ${kind}`);
  return found;
}
