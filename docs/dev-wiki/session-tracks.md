# Three-Track Session Split

Written 2026-07-30 by the consulting session (`stock_predict_rev` harness,
`game_project1`-only scope, source unmodified) at the user's request, to stop
handoff prompts from being ambiguous about which of three parallel work
streams they belong to. Every future Codex/Claude Code prompt for this
project should start with `[담당 세션: <트랙 이름>]` and stay inside that
track's owned files unless a prompt explicitly says otherwise.

## Working directories (git worktrees)

Each track runs in its own `git worktree` — same repo/object store, separate
working directory and branch, so three sessions can run at once without
clobbering each other's uncommitted changes or fighting over `npm run dev`
ports. Set up 2026-07-30:

| Track | Directory | Branch |
| --- | --- | --- |
| 맵 및 게임 전반 | `/data/projects/game_project1` (unchanged, main session) | `master` |
| 그래픽/캐릭터 | `/data/projects/game_project1-graphics` | `track-graphics-nw-frames` |
| 음악/오디오 | `/data/projects/game_project1-audio` | `track-audio-ack-sfx` |

Both new worktrees already have `npm ci` run and `npm run build` verified
clean as of creation. Each track commits/pushes on its own branch; merge to
`master` when a track's unit of work is done (open a PR, or fast-forward
merge directly per this project's existing light-process convention — see
`AGENTS.md`). Run `git worktree list` from any of the three directories to
see all three at once. Do not `git worktree remove` one of these without
checking for uncommitted work first (`git status` inside it).

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
- **Current status (2026-07-30, updated later same day)**: all 10
  `BattleUnitId` roster entries now have full production art across all 8
  directions with the previously-recorded NW debt closed. The audited/fixed
  gaps were exactly 4 frames:
  `stone_slinger` `nw walk-b`, `stone_axeman` `nw attack`, `archer`
  `nw walk-a`, `iron_spearman` `nw attack`.
- **Next task**: no open directional coverage debt remains. Future graphics
  work can return to higher-level staging/polish tasks rather than emergency
  frame substitution cleanup.

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
trigger calls = music track). Now that each track has its own worktree and
branch (see above), simultaneous edits no longer silently clobber each
other's working-directory state — they become a normal git merge conflict
at merge time instead, which is a much safer failure mode. Still:

- Keep `LaneBattleScene.ts` edits small and focused on your track's call
  sites (animation triggers / core logic / audio triggers) so any merge
  conflict is easy to resolve by hand.
- Commit and push your branch promptly after finishing a change to this
  file rather than sitting on a large uncommitted diff.
- Merge tracks into `master` one at a time, resolving any
  `LaneBattleScene.ts` conflict by hand at merge time (it's the only file
  likely to conflict — everything else is disjoint by ownership).
- Before merging, pull `master` into your branch first
  (`git fetch origin && git merge origin/master`) so conflicts, if any,
  surface locally before you push.

All other owned-file lists above are already disjoint, so the three tracks
can run fully in parallel with no coordination needed except this file.

## How to hand off work

Every prompt written for one of these tracks should open with
`[담당 세션: <트랙 이름>]` and, if it touches `LaneBattleScene.ts`, remind
the session to check the shared-file rule above before editing.
