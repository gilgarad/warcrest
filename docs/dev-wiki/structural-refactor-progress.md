# Structural Refactor Progress

This page records the refactor that must finish before the approved top-down
visual rebuild resumes. It complements the append-only project log and keeps
the independently committable refactor stages reviewable.

## 2026-07-28 - Stage 1.1: retired dungeon prototype

### Confirmed reachability

`src/main.ts` registers only `BootScene`, `LaneBattleScene`, and
`GameOverScene`. Repository-wide source/tool search confirmed that
`DungeonScene` was the sole runtime root for the abandoned dungeon modules.

### Removed

- `src/scenes/DungeonScene.ts`
- `src/systems/dungeonGenerator.ts`
- `src/systems/squad.ts`
- `src/systems/combat.ts`
- `src/data/unitTypes.ts`
- `src/data/commands.ts`
- `src/data/encounterTypes.ts`
- `src/data/skills.ts`
- `src/gfx/chibi.ts`
- `src/gfx/iso.ts`

The removal deletes 2,177 unreachable lines. Historical documentation and old
artifacts remain because they describe the project's development history.

### Verification

- Source/tool references to the deleted modules: zero.
- `npm run build`: passed.
- `npm test`: 16 files, 69 tests passed.

## Next stage

Decompose `LaneBattleScene` by stable domain boundaries. Each extraction must
preserve behaviour and pass build/tests before the next domain is moved. The
four existing terrain renderer modes stay intact until the top-down renderer is
implemented and validated.

## 2026-07-28 - Stage 1.2a: wave and economy rules

Extracted `src/systems/lane-economy/laneEconomy.ts` as a Phaser-free domain
module. It now owns team initialization, resource maps, affordability/payment,
worker production accumulation, age-up cost and AI eligibility, age mutation,
and research-worker conversion.

`LaneBattleScene` retains orchestration that genuinely belongs to the scene:
button feedback, audio events, wave spawning, and UI refresh. Four unit tests
cover production, payment, AI age gates, and atomic worker conversion.

- `LaneBattleScene.ts`: 3,586 -> 3,506 lines.
- `npm run build`: passed.
- `npm test`: 17 files, 73 tests passed.

## 2026-07-28 - Stage 1.2b: capture and construction rules

Extracted `src/systems/lane-capture/captureRules.ts` as the authoritative
catalogue and rule module for capture-point buildings. It owns building
definitions, dismantle cost, age-scaled tower construction/repair costs,
tower HP derivation, and the 70/30 destruction-versus-capture outcome with its
one-to-three-level loss.

`LaneBattleScene` still owns selection, resource mutation, timed construction,
SFX, and visual refresh orchestration. The extracted calculations preserve the
pre-refactor formulas, including metal costs from early iron onward and tower
HP based on five times the first battle-line unit's HP.

- `LaneBattleScene.ts`: 3,506 -> 3,458 lines.
- `npm run build`: passed.
- `npm test`: 18 files, 76 tests passed.

## 2026-07-28 - Stage 1.2c: lane battle audio wiring

Extracted `src/systems/audio/laneBattleAudioWiring.ts`. The wiring class now
owns the battle-state machine, its 0.45-second evaluation cadence, the rolling
three-second combat-event window, fortress warning dispatch, camera-relative
world SFX mixing, and audio debug-line formatting.

The scene continues to decide where semantic events happen and passes only
combat metrics, world coordinates, and camera data to the wiring class. No
asset, synthesis profile, volume, state threshold, or event location changed.
Two unit tests cover state-update throttling and camera-relative SFX options.

- `LaneBattleScene.ts`: 3,458 -> 3,413 lines.
- `npm run build`: passed.
- `npm test`: 19 files, 78 tests passed.
