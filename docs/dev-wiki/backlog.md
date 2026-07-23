# Dev-Wiki Backlog

GitHub Issues own task status. This file owns planning context.

## How To Use

- Prefer one issue = one branch = one PR.
- Record issue / branch / PR linkage in each active entry.
- Let the owner decide merge order unless a project explicitly delegates it.

## Merge Order

- _(empty)_

## Active Queue

- **Game concept selection** — no GitHub Issue yet (no GitHub repo exists
  for this project). Decide game concept, target platform (web vs. web+APK),
  and tech stack with the user before writing any game code. Blocks: tech
  stack decision in `docs/knowledge/index.md`, `docs/rules/testing.md` fill-in.
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

## Cross-Issue Themes

- This project targets the NHN `nan2026` AI game jam. Submission needs a
  playable web/mobile build + full source (this repo), a play video, a game
  intro PDF, an AI-usage PDF, and (if team-based) a role PDF. Only item 1
  lives in this repo as code; the rest are compiled from this repo's docs
  and history later.
