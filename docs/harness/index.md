# Local Harness Notes

This repository contains a local copy of the reusable operating harness.

## Local Authority

Once this harness is copied into a repository, the files in this repository are
the authoritative version for that project.

- Update this repository's `AGENTS.md` and `docs/` files here.
- Do not assume updates made in `/data/projects/harness` automatically apply.
- If you want newer shared wording later, re-run the shared harness carefully
  and review the diff instead of blindly replacing local rules.

## Applied From

- shared source: `/data/projects/harness`
- target repository: `/data/projects/game_project1`
- project name: `game_project1`
- initial apply date: `2026-07-23`

## Session Start

For normal work inside this repository, agents should start with:

1. `AGENTS.md`
2. `docs/index.md`
3. `docs/dev-wiki/contract.md`

Then they should load only the docs relevant to the task.

## Runtime Records

If this repository uses `harness-run`, lightweight session logs should be kept
under `docs/harness/runs/`.

## Adaptation Reminder

These files usually need local rewriting after the first apply:

- `docs/rules/testing.md`
- `docs/patterns/*`
- `docs/knowledge/*`
- `docs/wiki/*`
- `docs/dev-wiki/backlog.md`
