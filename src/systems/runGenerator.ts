import { pickRandomForkKind, type EncounterKind } from "../data/encounterTypes";

/** How many fork choices happen before the guaranteed mission step. Tune freely. */
export const RUN_FORK_COUNT = 5;

export interface ForkCandidate {
  kind: EncounterKind;
}

export interface ForkStep {
  left: ForkCandidate;
  right: ForkCandidate;
}

/**
 * Produces the sequence of forks for one run. Each fork offers two random
 * candidates (their `hintIcon` is shown to the player before choosing); the
 * unpicked candidate is simply discarded. This is intentionally the
 * lightest possible generator — swap it for something with difficulty
 * ramps / a real branching tree later without touching RunScene, as long as
 * it keeps returning `ForkStep[]`.
 */
export function generateRunForks(count: number = RUN_FORK_COUNT): ForkStep[] {
  const steps: ForkStep[] = [];
  for (let i = 0; i < count; i++) {
    steps.push({
      left: { kind: pickRandomForkKind() },
      right: { kind: pickRandomForkKind() },
    });
  }
  return steps;
}
