# Three-Track Session Split

Written 2026-07-30 by the consulting session (`stock_predict_rev` harness,
`game_project1`-only scope, source unmodified) at the user's request, to stop
handoff prompts from being ambiguous about which of three parallel work
streams they belong to. Every future Codex/Claude Code prompt for this
project should start with `[담당 세션: <트랙 이름>]` and stay inside that
track's owned files unless a prompt explicitly says otherwise.

## The three tracks

### 1. 그래픽/캐릭터 (Graphics / Character)

- **Scope**: unit sprite production, pose/direction coverage, animation
  timing and staging.
- **Owned files**: `src/data/unitRosters.ts`, `src/presentation/units/**`
  (`unitAnimationRegistry.ts`, `unitPresentation.ts`,
  `combatPresentation.ts`, `unitOverlayDensity.ts`), `public/assets/
  production/units/**`, `tools/asset-qa/*` (unit-related scripts),
  `art-source/**` (unit sheets), `docs/dev-wiki/retro-rts-visual-
  methodology.md`, `art-direction-animation.md`, `style-guide.md`.
- **Current status (2026-07-30)**: all 10 `BattleUnitId` roster entries have
  full production art across all 8 directions
  (`docs/ai-usage/session-log.md`, entries around `d301888`/`818c193`).
  Known, transparently-recorded debt: **4 frames in the NW direction** still
  use temporary substitute frames instead of unique production art (same
  source, not a crash, just a minor visual gap).
- **Next task**: close the NW-direction debt using the same golden-
  reference pipeline already proven for the other 7 directions
  (`asset:prepare:units` / `asset:qa:units` scripts).

### 2. 맵 및 게임 전반 (Map & General Game Systems)

- **Scope**: battlefield map schema and candidates, capture points, towers,
  lane economy, core `LaneBattleScene` game logic (spawning, combat,
  targeting, facing), overall build/test/Playwright regression health.
- **Owned files**: `src/data/battlefieldMaps.ts`,
  `capturePointDefinitions.ts`, `defenseTowerDefinitions.ts`,
  `src/systems/lane-economy/**`, `src/scenes/LaneBattleScene.ts` (the core
  logic — spawning, combat resolution, capture/tower state, facing — not
  the animation-trigger or audio-trigger call sites, see the shared-file
  rule below), most of `tools/validation/*.spec.ts` (map/economy/regression
  specs), `docs/dev-wiki/map-topology-two-lane-brief.md`,
  `terrain-rendering-plan.md` and its validation docs.
- **Current status (2026-07-30)**: `warcrest-two-lane-v1` candidate fully
  verified (regression `53 passed`, 21.2m; playthrough confirms independent
  north/south capture + tower destroy/rebuild). User decided: promote to
  default map, and archive (don't delete) the now-superseded
  `warcrest-day3-three-fronts-v1` single-lane candidate.
- **Next task**: the prompt in `docs/dev-wiki/codex-prompt-log.md`
  2026-07-30 (28) — archive Three Fronts, promote two-lane to default,
  full regression.

### 3. 음악/오디오 (Music / Audio)

- **Scope**: BGM arrangement per game state, SFX synthesis/mixing, audio
  settings UI.
- **Owned files**: `src/systems/audio/**` (`backend.ts`, `bgmManager.ts`,
  `sfxManager.ts`, `assetManifest.ts`, `battleAudioStateMachine.ts`,
  `laneBattleAudioWiring.ts`, `spatialAudio.ts`), `src/ui/
  AudioSettingsPanel.ts`, `tools/audio-lab/**`, `docs/dev-wiki/
  music-style-brief.md`, `audio-integration-validation.md`.
- **Current status (2026-07-30)**: all 4 BGM states (`battle-low` through
  `battle-high`) have measured/verified layered arrangements. No unit-
  acknowledgment SFX category exists yet — confirmed by grepping
  `assetManifest.ts` for `hireSuccess`-style entries; nothing for
  capture-point/tower click or hire acknowledgment
  (`docs/dev-wiki/wc2-systems-gap-review.md` section 4).
- **Next task (optional, small)**: add a minimal synthesized select/
  acknowledge SFX for capture-point clicks, tower clicks, and hire actions,
  reusing the existing synth-fallback pattern in `assetManifest.ts`. This is
  charm, not a blocker — skip it if there's higher-priority work from
  another track that needs audio wiring instead.

## Shared-file rule: `LaneBattleScene.ts`

All three tracks touch this one 3,491-line file (animation trigger calls =
graphics track, core combat/capture/tower/economy logic = map track, audio
trigger calls = music track). Running two tracks against it at the same time
risks silent overwrites or merge conflicts. Until/unless it's split into
per-concern modules (not required to start work, just a future option if
conflicts become frequent):

- Before starting a `LaneBattleScene.ts` change, run
  `git log -1 --format='%H %s' -- src/scenes/LaneBattleScene.ts` and
  `git status` to confirm no other track has an in-flight, uncommitted
  change in this file.
- Commit and push promptly after finishing a change to this file — don't
  sit on an uncommitted edit while another track's prompt might also touch
  it.
- If two tracks genuinely need to touch it in the same window, sequence
  them (one finishes and pushes, then the next starts) rather than running
  both at once.

All other owned-file lists above are already disjoint, so the three tracks
can run fully in parallel as long as `LaneBattleScene.ts` follows this rule.

## How to hand off work

Every prompt written for one of these tracks should open with
`[담당 세션: <트랙 이름>]` and, if it touches `LaneBattleScene.ts`, remind
the session to check the shared-file rule above before editing.
