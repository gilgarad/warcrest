# Day 8 Full Regression Validation

Date: 2026-07-28

Branch: `terrain-prototype-central`

Baseline: Day 7.5 integration commit `4bb42fb`

## Scope

Day 8 is a regression and buffer pass only. It does not add the deferred
research tree, unit acknowledgement sounds, multi-selection, fog of war, or
new visual polish.

## Findings And Fixes

The first full Playwright run passed 38 of 41 existing tests. The three
failures were stale presentation assertions rather than gameplay regressions:

- The bronze spearman test expected retired windup/contact texture keys. The
  approved production pose set uses the common attack texture for both phases.
- Unit-direction assertions assumed the retired source facing. Production
  unit art faces left natively, so left movement is unflipped and right
  movement is flipped.
- The terrain comparison included visual coordinates and overlays and still
  expected two structure sockets. It now excludes presentation-only state and
  expects the current four logical sockets while continuing to compare combat
  and economy state.

The HUD label discrepancy in the Day 7.5 screenshots was a validation-helper
timing artifact. `prepareAgeWaveProbe()` changed `player.ageId` directly but did
not refresh the HUD before publishing/capturing. The production age-up path
already calls `refreshUi()`. The helper now does the same, and the Day 8 test
uses the real age-up and instant-wave buttons for every transition.

The new structure regression probe also exposed two test-harness assumptions:
the capture-point setup did not select the prepared point, and the test
expected a live 10-second rebuild timer to remain exactly `10.0` after frames
had elapsed. The helper now follows the real selection path and the assertion
accepts the observed `9-10` second interval.

## Five-Age Playthrough

The real age-up and instant-wave UI buttons were used sequentially. Each newly
spawned player wave matched the production roster and contained no `token-*`
texture:

| Age | HUD label | Spawned roster |
| --- | --- | --- |
| Stone | `시대 석기 시대` | slinger, axeman x2, supply wagon |
| Bronze | `시대 청동기` | slinger, bronze swordsman, bronze spearman, supply wagon |
| Early Iron | `시대 초기 철기` | slinger, archer, iron swordsman, supply wagon |
| Middle Iron | `시대 중기 철기` | archer, iron swordsman, iron spearman, supply wagon |
| Late Iron | `시대 후기 철기` | archer, knight, musketeer, supply wagon |

Evidence:

- `artifacts/day8-regression/age-stone.png`
- `artifacts/day8-regression/age-bronze.png`
- `artifacts/day8-regression/age-iron_early.png`
- `artifacts/day8-regression/age-iron_mid.png`
- `artifacts/day8-regression/age-iron_late.png`
- `artifacts/day8-regression/five-age-playthrough.json`

## Structures And Audio

The regression scenario exercised production actions and rules for supply
depot construction, dismantling, a ruined tower rebuild and completion, and an
enemy mint capture. The captured mint changed owner and dropped from level 4
to level 3. The full existing structure suite also reconfirmed all five tower
visual states, capture palettes, base art, tower/capture separation, and tower
projectiles.

Audio evidence records played construction start/complete and capture-complete
events. Each age-up records a played UI confirmation. The full audio suite
reconfirmed unlock/lifecycle, actual output-bus energy, battle-low/high BGM
state transitions, settings/focus behavior, combat families, and terminal
states.

Evidence:

- `artifacts/day8-regression/structure-interactions.png`
- `artifacts/day8-regression/structure-interactions.json`
- `artifacts/audio-signal/after-signal.json`
- `artifacts/audio-integration/playwright-audio-validation.json`

## Final Verification

- `npm run build`: passed.
- `npm test`: 29 files, 114 tests passed.
- `npx playwright test --workers=1`: 43 tests passed in 13.2 minutes.
- Five-age real-button playthrough: passed.
- Structure and audio regression scenario: passed.

Day 8 is complete. No blocking regression remains before Day 9 contest
material preparation. The research tree and unit acknowledgement sounds remain
explicitly deferred; multi-selection and fog of war remain rejected for this
game direction.
