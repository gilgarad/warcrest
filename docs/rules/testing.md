# Testing Rules

**Stack not chosen yet.** This file is a placeholder until the game engine /
framework is decided (see `docs/knowledge/index.md`). Whoever makes that
decision must fill in real commands below in the same change.

## Default Harness (TBD)

No automated test command exists yet. Until one does, the baseline
verification is: **run the build/dev server and actually play it in a
browser** (or on a device/emulator for a mobile build) before calling
anything done. This repo has a CLAUDE.md rule of thumb already: for UI/game
changes, don't claim success without exercising the feature.

Candidates once the stack is picked:

- Web (JS/TS, e.g. Phaser/PixiJS/plain canvas): `npm test` for unit logic +
  manual playtest in browser; add a smoke check that the build output
  actually boots (no console errors) before it's considered shippable.
- Godot/Unity export: engine's built-in test runner if used, plus a manual
  playtest of the exported build (not just the editor).

## Test Placement

- safe automated tests should live in a predictable place (e.g. `test/` or
  `tests/` at repo root once the stack exists)
- integration/playtest scripts should be explicitly marked and documented
- manual scripts should not be collected by default

## Verification Standard

- run the narrowest useful check for the changed surface
- for gameplay/UI changes, actually play the change — type checks and unit
  tests verify code correctness, not fun or playability
- for docs-only changes, run `python3 scripts/check_docs_links.py` if/when
  this repo adds one (not present yet)
- if a command cannot run, report why
