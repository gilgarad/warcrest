# Day 2 Triple Checkpoint Validation

Date: 2026-07-29  
Branch: `terrain-prototype-central`

## Scope

Day 2 was intentionally limited to three approval gates only:

1. One unit upgraded from 2-direction presentation to a real 8-direction set.
2. One BGM state upgraded from the older thin synth loop to the new layered arrangement.
3. One partial map candidate implemented as switchable data only, without replacing the production lane.

No other units, music states, or full-map replacements were expanded in this step.

## 1. Bronze Spearman 8-Direction Checkpoint

### What changed

- `bronze_spearman` now uses a directional animation registry entry instead of the old west-only + mirror assumption.
- West-facing production frames were reused as instructed.
- Seven new facing directions were added:
  `n`, `ne`, `e`, `se`, `s`, `sw`, `nw`.
- Total pose set for this checkpoint:
  `8 directions x 4 poses = 32 frames`

### QA result

- Spec: [tools/asset-qa/day2-bronze-spearman-eight-direction-assets.json](/data/projects/game_project1/tools/asset-qa/day2-bronze-spearman-eight-direction-assets.json)
- Normalized output:
  [artifacts/day2-triple-checkpoint/bronze-spearman-8dir/normalized](/data/projects/game_project1/artifacts/day2-triple-checkpoint/bronze-spearman-8dir/normalized)
- QA report:
  [prototype-golden-qa-report-v1.json](/data/projects/game_project1/artifacts/day2-triple-checkpoint/bronze-spearman-8dir/normalized/prototype-golden-qa-report-v1.json)

Result:

- `assetCount = 32`
- `passed = true`
- `failures = []`

### Direction-turn validation

- Runtime direction sequence artifact:
  [direction-sequence.json](/data/projects/game_project1/artifacts/day2-triple-checkpoint/bronze-spearman-8dir/direction-sequence.json)
- Review sheet:
  [turnaround-contact-sheet.png](/data/projects/game_project1/artifacts/day2-triple-checkpoint/bronze-spearman-8dir/turnaround-contact-sheet.png)

The runtime probe confirmed that each requested facing resolves to the matching texture:

- `n -> bronze-spearman-n-idle`
- `ne -> bronze-spearman-ne-idle`
- `e -> bronze-spearman-e-idle`
- `se -> bronze-spearman-se-idle`
- `s -> bronze-spearman-s-idle`
- `sw -> bronze-spearman-sw-idle`
- `w -> bronze-spearman-w-idle`
- `nw -> bronze-spearman-nw-idle`

## 2. `bgm.battle.low` Layered Arrangement Checkpoint

### What changed

- `WebAudioBackend` gained a dedicated `bgm.battle.low` scheduler instead of relying on the older generic thin-loop score path.
- Arrangement now follows the approved Day 1 brief:
  `104 BPM`, percussion ostinato, bass pulse, harmony bed, low-color sustain, and restrained lead punctuation.
- Offline measurement support was added so the arrangement can be validated as actual output energy rather than just "play called successfully".

### Offline measurement

Artifact:

- [battle-low-arrangement.json](/data/projects/game_project1/artifacts/day2-triple-checkpoint/audio/battle-low-arrangement.json)

Measured values:

- Mix RMS: `0.01512`
- Mix peak: `0.08964`
- Percussion RMS: `0.00410`
- Bass RMS: `0.01035`
- Harmony RMS: `0.00821`
- Low-color RMS: `0.00328`
- Lead RMS: `0.00214`

Interpretation:

- All five intended layers are present above the floor.
- Peak stays safely below clipping.
- Bass + harmony dominate the body of the cue, which matches the brief for `battle.low`.

### In-game preparation -> battle-low capture

Artifacts:

- [in-game-preparation.png](/data/projects/game_project1/artifacts/day2-triple-checkpoint/audio/in-game-preparation.png)
- [in-game-battle-low.png](/data/projects/game_project1/artifacts/day2-triple-checkpoint/audio/in-game-battle-low.png)
- [audio-transition-side-by-side.png](/data/projects/game_project1/artifacts/day2-triple-checkpoint/audio-transition-side-by-side.png)
- [in-game-transition.json](/data/projects/game_project1/artifacts/day2-triple-checkpoint/audio/in-game-transition.json)

Notes:

- The scene was temporarily paused during capture so the combat-state machine would not immediately promote the music back to `battle-high`.
- Because the built-in scene debug overlay is updated by the scene loop, the capture script added a DOM annotation showing the actual audio debug state read from `__audioDebugControl`.
- JSON confirms:
  - `preparation -> bgm.preparation`
  - `battle-low -> bgm.battle.low`

## 3. Partial Map Candidate Checkpoint (`0.00 - 0.34`)

### What changed

- `battlefieldMaps.ts` now supports switchable map specs instead of a single hardcoded lane.
- A new candidate map spec was added:
  `warcrest-day2-player-front-v1`
- The production map was not replaced.
- `LaneBattleScene` now resolves capture-point and defense-tower progress from the active map spec sockets, so the comparison is data-driven rather than renderer-only.

### Candidate contents

- Lane nodes: 8
- Terrain patches: 7
- Terrain cells: 450
- Terrain props: 8
- Structure sockets:
  - capture 0: `0.17`
  - tower 0: `0.37`
  - tower 1: `0.64`
  - capture 1: `0.84`

The candidate keeps the minimum structure gap rule intact:

- every socket pair stays `>= 0.15` apart

### Comparison artifacts

- Existing map:
  [existing-player-front.png](/data/projects/game_project1/artifacts/day2-triple-checkpoint/map/existing-player-front.png)
- Candidate map:
  [candidate-player-front.png](/data/projects/game_project1/artifacts/day2-triple-checkpoint/map/candidate-player-front.png)
- Side-by-side:
  [map-old-vs-candidate-side-by-side.png](/data/projects/game_project1/artifacts/day2-triple-checkpoint/map-old-vs-candidate-side-by-side.png)
- Snapshot data:
  [map-candidate-comparison.json](/data/projects/game_project1/artifacts/day2-triple-checkpoint/map/map-candidate-comparison.json)

Observed differences:

- The candidate replaces the straight early lane with a broader opening and clearer material event near the player front.
- The player-side capture point moves earlier (`0.375 -> 0.17`) and the linked player tower moves deeper into the route (`0.60 -> 0.37`) while still maintaining socket separation.
- The candidate uses denser prop grouping and more visible shoulder variation than the baseline front section.

## Verification

Commands run:

```bash
npm run build
npm test
npx playwright test tools/validation/day2-triple-checkpoint.spec.ts --workers=1
```

Results:

- `npm run build`: passed
- `npm test`: passed (`29 files`, `117 tests`)
- Day 2 Playwright validation: passed (`3 tests`)

## Approval Gate For The User

Day 2 should be judged on exactly three questions:

1. **8-direction unit standard**  
   Does the bronze spearman still read as the same character while turning through all eight facings?

2. **Battle-low music standard**  
   Does the new layered `battle.low` cue feel like the correct direction for the second cycle before the remaining states are rebuilt?

3. **Map redesign standard**  
   Is the player-front candidate lane meaningfully more interesting than the current front section, without requiring an engine rewrite?

If approved, Day 3 can expand:

- the remaining units to 8 directions,
- the remaining BGM states,
- and the rest of the lane map redesign.

If rejected, only these three checkpoint items should be revised.
