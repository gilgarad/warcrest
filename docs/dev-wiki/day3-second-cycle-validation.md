# Day 3 Second-Cycle Validation

Date: 2026-07-29  
Branch: `terrain-prototype-central`

## Scope

This document consolidates the three second-cycle Day 3 streams into one place:

1. full eight-direction unit expansion for the production lane roster,
2. layered RTS-style BGM expansion across all four looping states,
3. full-map redesign candidate completion.

It does not re-run validation by itself. It gathers the evidence already
produced and committed in the Day 3 stream commits.

## Commit map

| Stream | Commit | Summary |
| --- | --- | --- |
| Units step 0 | `d301888` | Wire six already-normalized eight-direction unit sets |
| Units step 1 | `818c193` | Complete and wire remaining three unit sets |
| Music step 2 | `0f3136e` | Validate layered BGM states and capture evidence |
| Map step 3 | `4b9952f` | Add full `three-fronts` redesign candidate |

## 1. Unit stream

### Outcome

All ten production lane units now use the eight-direction animation schema at
runtime:

- `stone_slinger`
- `stone_axeman`
- `supply_wagon`
- `bronze_swordsman`
- `bronze_spearman`
- `archer`
- `iron_swordsman`
- `iron_spearman`
- `musketeer`
- `knight`

`token-*` runtime placeholders are no longer part of the active lane roster.

### Evidence

- Directional unit artifacts:
  [artifacts/day3-directional-units](/data/projects/game_project1/artifacts/day3-directional-units)
- Runtime registry:
  [unitAnimationRegistry.ts](/data/projects/game_project1/src/presentation/units/unitAnimationRegistry.ts)
- Registry tests:
  [unitAnimationRegistry.test.ts](/data/projects/game_project1/src/presentation/units/__tests__/unitAnimationRegistry.test.ts)

### Notes

- The earlier N/S concern on `bronze_spearman` was rechecked during the Day 3
  interruption recovery. The result was acceptable for the approved weak 3/4
  top-down contract: `n` reads front-biased, `s` reads back-biased.
- A few northwest directional cells were repaired by directional substitution
  to complete normalization. Those are acknowledged asset debt, but not a
  blocker for runtime integration or current review.

## 2. Music stream

### Outcome

All four looping BGM states now share the layered arrangement path:

- `bgm.menu`
- `bgm.preparation`
- `bgm.battle.low`
- `bgm.battle.high`

The expanded arrangement path exposes measurable per-layer energy through the
audio debug interface instead of relying on state flags alone.

### Evidence

- Offline arrangement measurements:
  [offline-arrangements.json](/data/projects/game_project1/artifacts/day3-music/offline-arrangements.json)
- In-game transition capture states:
  [in-game-transitions.json](/data/projects/game_project1/artifacts/day3-music/in-game-transitions.json)
- Transition screenshots:
  [transition-menu.png](/data/projects/game_project1/artifacts/day3-music/transition-menu.png),
  [transition-preparation.png](/data/projects/game_project1/artifacts/day3-music/transition-preparation.png),
  [transition-battle-low.png](/data/projects/game_project1/artifacts/day3-music/transition-battle-low.png),
  [transition-battle-high.png](/data/projects/game_project1/artifacts/day3-music/transition-battle-high.png),
  [transition-battle-low-return.png](/data/projects/game_project1/artifacts/day3-music/transition-battle-low-return.png)
- Validation spec:
  [day3-music-expansion.spec.ts](/data/projects/game_project1/tools/validation/day3-music-expansion.spec.ts)

### Notes

- `bgm.battle.high` is the only looping state with the sixth `counterline`
  layer.
- The retired draft validation file `tools/validation/day3-audio-expansion.spec.ts`
  was removed later during second-cycle integration cleanup because the active
  evidence path is the committed `day3-music-expansion.spec.ts`.

## 3. Map stream

### Outcome

The redesign was extended from the Day 2 player-front slice to a complete full
candidate map:

- Candidate id: `warcrest-day3-three-fronts-v1`

The engine and renderer were not rewritten. The candidate only replaces map
data:

- nine authored path nodes,
- eight terrain patches with width variation,
- twenty props across five readable map beats,
- unchanged structure spacing rule with socket progress
  `[0.17, 0.37, 0.64, 0.84]`.

### Evidence

- Candidate data:
  [battlefieldMaps.ts](/data/projects/game_project1/src/data/battlefieldMaps.ts)
- Data invariants:
  [battlefieldMaps.test.ts](/data/projects/game_project1/src/data/__tests__/battlefieldMaps.test.ts)
- Baseline vs candidate comparison:
  [comparison.json](/data/projects/game_project1/artifacts/day3-map/comparison.json)
- Baseline screenshots:
  [baseline-player-front.png](/data/projects/game_project1/artifacts/day3-map/baseline-player-front.png),
  [baseline-center.png](/data/projects/game_project1/artifacts/day3-map/baseline-center.png),
  [baseline-enemy-front.png](/data/projects/game_project1/artifacts/day3-map/baseline-enemy-front.png)
- Candidate screenshots:
  [candidate-player-front.png](/data/projects/game_project1/artifacts/day3-map/candidate-player-front.png),
  [candidate-center.png](/data/projects/game_project1/artifacts/day3-map/candidate-center.png),
  [candidate-enemy-front.png](/data/projects/game_project1/artifacts/day3-map/candidate-enemy-front.png)

### Decision at Day 3

The candidate was completed, but not promoted to the live default map in the
same step.

Reason:

- `warcrest-full-lane-hybrid-v1` remained the verified production baseline.
- `warcrest-day3-three-fronts-v1` was intentionally left switchable so a human
  play/readability pass could decide promotion explicitly instead of the Day 3
  build changing live behavior by default.

## Verification summary

Commands already run across the Day 3 stream:

```bash
npm run build
npm test
npx playwright test tools/validation/day3-music-expansion.spec.ts
npx playwright test tools/validation/day3-map-redesign.spec.ts
```

Observed results at the end of Day 3:

- `npm run build`: pass
- `npm test`: pass (`29` files / `121` tests after map step)
- Day 3 music Playwright: pass (`2` tests)
- Day 3 map Playwright: pass (`1` test)

## Status after Day 3

The second-cycle Day 3 expansion is complete:

- units: complete
- music: complete
- map redesign candidate: complete as switchable candidate

The next gate is integrated regression on the existing production map plus a
review package that lets a human decide whether the `three-fronts` candidate
should replace the current default map.
