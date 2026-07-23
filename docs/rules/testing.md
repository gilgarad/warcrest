# Testing Rules

Stack: Phaser 3 + TypeScript + Vite (decided 2026-07-23, see
`docs/dev-wiki/game-concept.md` and the bootstrap commits in
`docs/dev-wiki/log.md`).

## Default Harness

```bash
npm run build   # tsc --noEmit && vite build — type-checks + production bundle
npm run dev     # local dev server with HMR, for manual playtesting
```

There is no automated unit-test runner yet (no `npm test`). Until game logic
has enough non-visual complexity to warrant one (e.g. the branching-path
generator, squad attrition math), the baseline verification is:

1. `npm run build` must succeed (type errors + bundle errors both fail this).
2. **Actually play the change in a browser** via `npm run dev`, or verify
   headlessly with Playwright — see `docs/dev-wiki/log.md` for the pattern
   (launch dev server in background, drive it with Playwright, screenshot,
   confirm visually, kill the server). Type checks and a clean build verify
   code correctness, not whether the game looks/plays right.
3. For a full-run smoke check, RunScene exposes `window.__gameDebug`
   (`{ phase, forkIndex, forksTotal, squadSize, combatIndex, combatLength }`)
   every frame. A Playwright script can poll it to branch its clicks by
   phase (fork/combat/rescue/mission) instead of guessing coordinates blind,
   which is what makes it possible to script a full random-branching run
   headlessly. See `docs/patterns/README.md` for the rationale.

If/when pure-logic modules appear (procedural generation, combat resolution)
that are worth unit testing without a browser, add `vitest` and a `test`
script at that point — don't add it speculatively now.

## Test Placement

- once unit tests exist, put them next to the module they cover as
  `*.test.ts`, or under `src/**/__tests__/`
- Playwright/manual playtest scripts are verification aids, not part of the
  build — keep them out of `src/`
- manual scratch scripts should not be collected by default

## Verification Standard

- run the narrowest useful check for the changed surface
- for gameplay/UI changes, actually play the change — `npm run build`
  passing is necessary but not sufficient
- for docs-only changes, run `python3 scripts/check_docs_links.py` if/when
  this repo adds one (not present yet)
- if a command cannot run, report why
