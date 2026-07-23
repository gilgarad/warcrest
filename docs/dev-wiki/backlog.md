# Dev-Wiki Backlog

GitHub Issues own task status. This file owns planning context.

## How To Use

- Prefer one issue = one branch = one PR.
- Record issue / branch / PR linkage in each active entry.
- Let the owner decide merge order unless a project explicitly delegates it.

## Merge Order

- _(empty)_

## Active Queue

- **User playtest / change requests** — dungeon-exploration MVP is playable
  end-to-end (walk the corridors -> bump combat -> touch-to-rescue -> reach
  exit -> gameover -> retry). Waiting on the user to actually play it
  (`npm run dev`, or via the SSH tunnel — see `docs/dev-wiki/log.md`) and
  give change directions before doing more. Likely next real content:
  unit-type variety (`src/data/unitTypes.ts`) and more commands
  (`src/data/commands.ts`) per the MVP staging in
  `docs/dev-wiki/game-concept.md`. No GitHub Issue yet — should get one + a
  branch as soon as the repo exists.
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

## Cross-Issue Themes

- This project targets the NHN `nan2026` AI game jam. Submission needs a
  playable web/mobile build + full source (this repo), a play video, a game
  intro PDF, an AI-usage PDF, and (if team-based) a role PDF. Only item 1
  lives in this repo as code; the rest are compiled from this repo's docs
  and history later.
