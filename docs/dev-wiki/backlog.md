# Dev-Wiki Backlog

GitHub Issues own task status. This file owns planning context.

## How To Use

- Prefer one issue = one branch = one PR.
- Record issue / branch / PR linkage in each active entry.
- Let the owner decide merge order unless a project explicitly delegates it.

## Merge Order

- _(empty)_

## Active Queue

- **Field-combat rewrite polishing / feedback** — the old "접촉 시 고정 전투"
  모델 has been replaced with a first-pass continuous field-combat model in
  `DungeonScene`: leader + follower squad state, auto basic attacks, melee +
  ranged enemy behaviors, leader skill slots, mana, first skill/item drop
  loop, and a 9-slot shared inventory. This is intentionally a baseline
  implementation from the newly agreed plan, not final balance. Next step is
  user playtest feedback (`npm run dev`) on feel/readability/rough edges,
  then iterate rather than widening scope blindly. No GitHub Issue yet —
  should get one + a branch as soon as the repo exists.
- **GitHub repo linkage** — user will create the GitHub repo separately and
  hand it over. When received: add `remote.origin` reusing the credential
  pattern from `/data/projects/stock_predict` (see
  `docs/knowledge/index.md#github--remote`), then start using real Issues
  for backlog entries going forward.

## Recently Closed

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

## Cross-Issue Themes

- This project targets the NHN `nan2026` AI game jam. Submission needs a
  playable web/mobile build + full source (this repo), a play video, a game
  intro PDF, an AI-usage PDF, and (if team-based) a role PDF. Only item 1
  lives in this repo as code; the rest are compiled from this repo's docs
  and history later. Full official rules: `docs/knowledge/contest-requirements.md`.
