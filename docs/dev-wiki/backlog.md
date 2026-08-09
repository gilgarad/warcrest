# Dev-Wiki Backlog

GitHub Issues own task status. This file owns planning context.

## How To Use

- Prefer one issue = one branch = one PR.
- Record issue / branch / PR linkage in each active entry.
- Let the owner decide merge order unless a project explicitly delegates it.

## Merge Order

- _(empty)_

## Active Queue

- **[PRIORITY 1 — fix as soon as reproduced] Unit sprite semi-transparency
  bug** — user-reported, screenshot-confirmed: a friendly/enemy unit
  (originally described as a supply/보급 unit) sometimes renders visibly
  translucent in actual play, at an unspecified moment/age/situation. This
  is flagged by the user as something that "무조건 곧바로 고쳐야 되는"
  (must be fixed the moment it's reproducible), ranked above normal queue
  order once repro info exists — treat the next report of this as
  drop-everything priority, not routine backlog.
  - **Investigated 2026-08-08, not yet reproduced.** Two tracks were run:
    (a) 80+ seconds of live Playwright monitoring of every support unit's
    `sprite.alpha`/`sprite.tint` during real combat — always normal (alpha
    1, no tint) the whole time; (b) a full alpha-channel scan of all
    ~1845 unit PNGs under `public/assets/production/units/`, which found a
    *different*, real bug: several late-era units' (`breakthrough-trooper`,
    `grenadier-late`, `heavy-gunner`, `cannon-i`, `light-cavalry`, `tank`,
    `shock-trooper`, `special-forces`) `walk-a`/`walk-b` frames had
    genuinely low alpha (~170-200 vs a healthy ~240+), caused by
    `tools/asset-qa/generate_late_era_unit_variants.py` output going stale
    relative to later base-art updates. That was fixed (script re-run,
    frames regenerated, confirmed healthy) — see `docs/dev-wiki/log.md`
    2026-08-08 "적 팀 색상 자산 파이프라인 재생성..." entry — but it is
    **not** the bug the user's screenshot showed: those stale frames are
    `walk-a`/`walk-b`, and the shipped animation registry
    (`src/presentation/units/unitAnimationRegistry.ts`) only ever
    references numbered `walk-01/02/03` poses for these units, so the
    stale frames were never actually visible on screen.
  - **What to check next, when it recurs**: capture (in order of ease) —
    (1) the exact unit type and team (player/enemy), (2) the age/시대 at
    the time, (3) what the unit was doing (idle/walking/attacking/just
    spawned/just died/being healed), (4) whether it's the "opening wave"
    right at battle start vs. a later regular/instant wave, (5) if
    possible, a Playwright repro script with `sprite.alpha`/`sprite.tint`
    logged every frame for a few seconds around the moment, since this
    turn's monitoring found runtime alpha/tint always normal — meaning if
    it's real, it's not a static per-unit `alpha` bug like the one just
    fixed — a repo-wide grep found **zero** `setAlpha(`/`.alpha =` calls on
    `unit.sprite` anywhere in `LaneBattleScene.ts` (2026-08-08), so nothing
    in this scene's code currently touches unit sprite alpha at all. That
    points toward something more transient/environmental: a single-frame
    render artifact during a texture swap, GPU/driver blending quirk (the
    dev console has repeatedly logged "GPU stall due to ReadPixels"
    warnings from the WebGL driver during testing), or a browser/hardware-
    specific compositing issue that a static code read won't surface —
    which is exactly why a fresh repro (screenshot + the checklist above)
    matters more than more code archaeology at this point.
- **Concept pivot planning: lane siege / hiring / tech / fortress economy game** —
  the user has now clarified that the target is no longer a dungeon squad
  action roguelite. The new target is a mobile-friendly lane-based siege game
  inspired by DotA/LoL lane structure plus Civilization Wars-style tech
  progression, unit unlocks, and economy. Before rewriting code, capture the
  structural shift precisely: opposing corner bases (up to 4 players),
  recruitable units with ongoing wages, capturable mid-map strongholds,
  buildable forts, and base-only tech unlocks/upgrades. Working doc:
  `docs/dev-wiki/concept-pivot-lane-siege.md`. Immediate next step is user
  consultation to lock MVP shape (2p vs 4p, lane count, recruit flow, leader
  role), then replace dungeon generation/combat/inventory systems in planned
  phases. GitHub repo now exists and `origin` is connected; next process step
  is opening the first real Issue for the pivot and moving work off `master`.
- **Field-combat rewrite polishing / feedback** — the old "접촉 시 고정 전투"
  모델 has been replaced with a first-pass continuous field-combat model in
  `DungeonScene`: leader + follower squad state, auto basic attacks, melee +
  ranged enemy behaviors, leader skill slots, mana, first skill/item drop
  loop, and a 9-slot shared inventory. This is intentionally a baseline
  implementation from the newly agreed plan, not final balance. Next step is
  user playtest feedback (`npm run dev`) on feel/readability/rough edges,
  then iterate rather than widening scope blindly. This is likely to be
  superseded by the lane-siege pivot rather than expanded much further.
- **Structural refactor debt (found 2026-07-28, consulting session, source
  unmodified)** — a code-structure check requested by the user (they
  suspected an earlier "finish the refactor" instruction hadn't actually
  been completed) found concrete debt, separate from and larger than the
  visual/projection rework in `retro-rts-visual-methodology.md`:
  - **~2177 lines of fully dead code** from the abandoned dungeon-squad
    prototype: `src/scenes/DungeonScene.ts` (1333 lines) is not registered
    in `src/main.ts` (only `BootScene`/`LaneBattleScene`/`GameOverScene`
    are) since the 2026-07-26 pivot to `LaneBattleScene`, and everything
    only it references is dead too — `src/systems/dungeonGenerator.ts`,
    `src/systems/squad.ts`, `src/systems/combat.ts`, `src/data/unitTypes.ts`,
    `src/data/commands.ts`, `src/data/encounterTypes.ts`, `src/data/skills.ts`,
    `src/gfx/chibi.ts`, `src/gfx/iso.ts`. None of this has been deleted in
    the ~2 days since the pivot.
  - **`src/scenes/LaneBattleScene.ts` is a 3532-line god-scene** — by far
    the largest file in the project. Recent extractions
    (`src/presentation/units/combatPresentation.ts` 64 lines,
    `src/systems/lane-combat/laneOccupancy.ts` 25 lines,
    `src/gfx/battlefieldWorldRenderer.ts` 148 lines, landed in commit
    `56a6376`) are real but tiny relative to the file's size — combat,
    wave/economy logic, capture points, terrain-mode toggling, UI, and
    audio wiring are still crammed into one file. A 2026-07-27 log entry
    already flagged this ("실제 병목은 `LaneBattleScene.ts`에 집중... 도메인별
    서브모듈로 나눠야") but no decomposition plan has been executed since.
  - **Four terrain renderers coexist live in the scene**:
    `BattlefieldPrototypeRenderer` is instantiated twice
    (`terrainPrototype`, `terrainPrototypeV2`) plus
    `BattlefieldWorldRenderer` (`terrainWorld`), toggled via a
    `legacy/prototype/prototype-v2/world-surface` debug flag. Useful for
    A/B comparison during iteration, but now that `world-surface` won and
    a brand-new top-down renderer is about to be built (see
    `retro-rts-visual-methodology.md` 4.5.1, decision confirmed 안 A), this
    should be retired rather than becoming a 5th mode.
  - Recommended order: delete the dead dungeon-prototype files first
    (cheap, zero-risk), then decompose `LaneBattleScene.ts` by domain
    before or alongside the top-down rebuild (rebuilding terrain rendering
    inside a 3500-line file makes the rebuild itself harder to review),
    then retire the legacy/prototype/prototype-v2 render-mode scaffolding
    once the new top-down renderer replaces `world-surface`.
- **Independent audio system prototype (parallel track)** — built entirely
  in `src/systems/audio/` + `tools/audio-lab/`, deliberately not wired into
  any scene yet (no BGM/SFX files exist in the repo; the manifest marks
  everything `missingAsset: true` with synthesized fallback tones). Full
  writeup + integration guide/patch examples:
  `docs/dev-wiki/audio-system-prototype.md`. Next step for whoever picks
  this up: apply the patch examples in that doc's §25 to
  `BootScene.ts`/`LaneBattleScene.ts`/`GameOverScene.ts` once the
  lane-siege pivot's scene structure has settled (no point wiring it into
  a scene shape that's still actively changing).

## Recently Closed

- **Unit art coverage gap closed (Day 7.5, 2026-07-28)** — all 6 remaining
  battle unit types (`bronze_swordsman`, `archer`, `iron_swordsman`,
  `iron_spearman`, `musketeer`, `knight`; 24 frames) now have production art
  through the same golden-reference pipeline, replacing the `token-*`
  procedural placeholders. Verified independently: `npm run build`/`npm test`
  (29/114) pass, `token-*` fully removed from `src` (`rg -n "token-" src`
  empty), and a 5-age wave Playwright probe confirms every age's roster
  renders authored art with no fallback. Full record:
  `docs/dev-wiki/day7-5-unit-art-validation.md`. Minor follow-up: two
  evidence screenshots (`wave-bronze.png`, `wave-iron_late.png`) show a HUD
  age label one tier behind the roster actually on screen — likely a
  capture-timing artifact, flagged for a quick sanity check during Day 8
  regression rather than treated as a confirmed bug.
- **Harness bootstrap** (2026-07-23) — applied the local operating harness
  from `/data/projects/harness`, rewrote testing/patterns/knowledge/wiki for
  this game-jam project, initialized local git, set up
  `docs/ai-usage/session-log.md` for contest AI-usage tracking. No GitHub
  Issue (repo doesn't exist yet); recorded via this backlog entry +
  `docs/dev-wiki/log.md` per the fallback rule in `AGENTS.md`.
- **Game concept decided** (2026-07-23) — settled on "갈림길 정찰대":
  roguelite branching-path squad game with Patapon-style command/timer
  combat, rescue-to-grow squad mechanic, AI-generated pixel art, web-only,
  completeness/polish as the judging impact angle. Full writeup in
  `docs/dev-wiki/game-concept.md`. No GitHub Issue yet; same fallback
  recording as above.
- **Tech stack + scaffold** (2026-07-23) — Phaser 3 + TypeScript + Vite.
  Manually scaffolded (the `npm create vite` CLI wouldn't run non-interactively
  in a non-empty dir), added a placeholder `BootScene` with programmer-art
  parallax + a moving placeholder soldier, verified `npm run build` and a
  Playwright screenshot of `npm run dev` both work. Real commands now live in
  `docs/rules/testing.md`; first pattern notes in `docs/patterns/README.md`.
  No GitHub Issue yet; same fallback recording as above.
- **MVP core loop implemented** (2026-07-23) — full fork -> combat -> rescue
  -> mission -> gameover loop, built on data-driven registries
  (`src/data/unitTypes.ts`, `commands.ts`, `encounterTypes.ts`) so new unit
  types/commands/fork-kinds can be added without touching scene code.
  Chibi ("가분수") characters procedurally drawn via `src/gfx/chibi.ts`
  (no image-gen tool available in this environment). Verified with
  `npm run build` and a full headless Playwright playthrough driven by a
  `window.__gameDebug` hook (see `docs/patterns/README.md`). No GitHub
  Issue yet; same fallback recording as above. **Superseded the same day**
  by the dungeon-exploration rewrite below — the menu/fork UI didn't match
  what the user actually asked for.
- **Dungeon-exploration rewrite** (2026-07-23) — user feedback: the fork-menu
  MVP lost the "actually move through a Diablo-style dungeon" core of the
  concept. Replaced `RunScene` (menu/cards) with `DungeonScene` (real-time
  top-down movement, fog-of-war + minimap, bump-to-fight /
  touch-to-rescue, procedurally carved corridors via
  `src/systems/dungeonGenerator.ts`). Kept the combat/squad/registry systems
  from the previous implementation, only replaced the interaction layer.
  Fixed a real Arcade-physics body-offset bug found along the way (see
  `docs/patterns/README.md`). Verified with `npm run build` and a
  BFS-pathfound headless Playwright playthrough (movement, combat, rescue,
  exit, win screen all confirmed). No GitHub Issue yet; same fallback
  recording as above.
- **Visual/UI/camera correction pass** (2026-07-23) — user feedback: tiles
  too flat/80s, combat should live in a persistent right-side slot panel
  not a popup, camera too close. Added highlight/shadow character shading,
  wall-adjacent floor contact shadows (after two failed banding attempts —
  see `docs/patterns/README.md`), a persistent `setupActionPanel()`, and
  pulled the camera back (smaller tiles, wider vision radius, bigger
  dungeon). Verified with `npm run build` + BFS playthrough. **Superseded
  the same day** by the isometric rewrite below — still top-down, not the
  diagonal Diablo view the user actually wanted. No GitHub Issue yet; same
  fallback recording as above.
- **Isometric rewrite + MMO-hotbar combat** (2026-07-23) — user feedback
  (explicitly asked for a confirm-understanding-then-plan step first, given
  two prior misses): true isometric projection (Diablo-style diagonal
  view), a brighter/chunkier Clash-of-Clans-ish tone, and cooldown-gated
  hotbar combat instead of a scripted sequence. Added `src/gfx/iso.ts`
  (projection math, wall-block/floor-diamond textures); logic
  (movement/collision/fog/minimap) stayed on the existing orthogonal grid,
  only draw positions changed, via paired invisible-physics-body +
  visible-iso-sprite objects. Walls depth-sort per-tile against moving
  characters; floor is one baked texture. Camera now follows the player
  (`startFollow`) instead of showing the whole map at once; HUD/minimap/
  panel pinned via `setScrollFactor(0)`. `systems/combat.ts` rewritten
  around enemy HP + independent per-slot cooldowns + an enemy attack timer
  (`commands.ts` gained `role`/`cooldownMs`). Chibi art redrawn
  brighter/chunkier with a bold outline; squad now clusters loosely around
  the leader instead of single-file. Verified with `npm run build`, a
  console/pageerror-listening Playwright run, and a BFS-pathfound
  playthrough exercising movement, combat (HP drops on attack, squad loses
  members on unguarded enemy hits), and a clean game-over transition. No
  GitHub Issue yet; same fallback recording as above.
- **`project_development.md` status hub** (2026-07-23) — user asked whether
  a single document exists that a new session could read to get fully
  oriented and start the next task; none did. Added
  `project_development.md` at repo root as a maintained snapshot
  (architecture, how-to-run, file map, work-so-far summary emphasizing the
  three visual/UX correction rounds, active queue, gotchas, doc map) —
  supplements rather than replaces `AGENTS.md`. Linked from `AGENTS.md` and
  `docs/index.md` with one-line pointers. Also found and deleted
  `src/systems/runGenerator.ts`, dead code left over from the deleted
  menu-based `RunScene`. No GitHub Issue yet; same fallback recording as
  above.
- **Contest requirements saved verbatim + AI-usage log now quotes directly**
  (2026-07-24) — added `docs/knowledge/contest-requirements.md` (full
  official submission rules, unparaphrased). Submission item 4 explicitly
  asks for the actual prompts/instructions given to AI, not a summary, so
  `docs/ai-usage/README.md` now asks for verbatim quotes on
  direction/correction turns specifically (routine turns still just get a
  summary). No GitHub Issue yet; same fallback recording as above.
- **GitHub repo linkage** (2026-07-26) — connected local repo to
  `https://github.com/gilgarad/game_project1.git` using the same credential
  pattern as `/data/projects/stock_predict`, pushed `master`, and set upstream
  tracking to `origin/master`. The next discipline improvement is to stop
  continuing on `master` and open real GitHub Issues/branches for subsequent
  work units.

## Cross-Issue Themes

- This project targets the NHN `nan2026` AI game jam. Submission needs a
  playable web/mobile build + full source (this repo), a play video, a game
  intro PDF, an AI-usage PDF, and (if team-based) a role PDF. Only item 1
  lives in this repo as code; the rest are compiled from this repo's docs
  and history later. Full official rules: `docs/knowledge/contest-requirements.md`.
