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
