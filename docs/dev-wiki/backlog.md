# Dev-Wiki Backlog

GitHub Issues own task status. This file owns planning context.

## How To Use

- Prefer one issue = one branch = one PR.
- Record issue / branch / PR linkage in each active entry.
- Let the owner decide merge order unless a project explicitly delegates it.

## Merge Order

- _(empty)_

## Active Queue

- **Tech stack selection** — no GitHub Issue yet (no GitHub repo exists for
  this project). Game concept is decided (see `docs/dev-wiki/game-concept.md`);
  next is picking a web framework that fits a side-view/parallax,
  procedural-branching, command-timer-combat game, then filling in
  `docs/rules/testing.md` and `docs/patterns/README.md` for real.
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

## Cross-Issue Themes

- This project targets the NHN `nan2026` AI game jam. Submission needs a
  playable web/mobile build + full source (this repo), a play video, a game
  intro PDF, an AI-usage PDF, and (if team-based) a role PDF. Only item 1
  lives in this repo as code; the rest are compiled from this repo's docs
  and history later.
