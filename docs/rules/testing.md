# Testing Rules

Stack: Phaser 3 + TypeScript + Vite (decided 2026-07-23, see
`docs/dev-wiki/game-concept.md` and the bootstrap commits in
`docs/dev-wiki/log.md`).

## Default Harness

```bash
npm run build   # tsc --noEmit && vite build — type-checks + production bundle
npm test        # Vitest unit suite
npm run test:e2e # Playwright game/audio lifecycle checks on Chromium
npm run dev     # local dev server with HMR, for manual playtesting
```

Vitest covers pure audio state, settings, deduplication, and spatial helpers.
Playwright covers browser-policy and scene-lifecycle behavior that cannot be
proved by unit tests alone. The baseline verification is:

1. `npm run build` must succeed (type errors + bundle errors both fail this).
2. **Actually play the change in a browser** via `npm run dev`, or verify
   headlessly with Playwright — see `docs/dev-wiki/log.md` for the pattern
   (launch dev server in background, drive it with Playwright, screenshot,
   confirm visually, kill the server). Type checks and a clean build verify
   code correctness, not whether the game looks/plays right.
3. For the current lane battle, use the stable query and debug controls
   documented in the relevant validation page. `window.__gameDebug`,
   `window.__terrainPrototypeControl`, and `window.__audioDebugControl` expose
   controlled setup and read-only snapshots for browser verification.
4. Audio integration changes must run the complete Playwright lifecycle in
   `tools/validation/audio-integration.spec.ts`: pre-input lock, unlock,
   dynamic battle states, fortress warning, settings, focus, terminal states,
   and restart.
5. Keep screenshot and JSON evidence under a named `artifacts/` directory;
   do not treat generated Playwright `test-results/` as durable evidence.

## Test Placement

- put unit tests next to the module they cover as
  `*.test.ts`, or under `src/**/__tests__/`
- keep Playwright/manual playtest scripts out of `src/`; this repository
  type-checks `tools/`, so validation code must also pass `npm run build`
- manual scratch scripts should not be collected by default

## Verification Standard

- run the narrowest useful check for the changed surface
- for gameplay/UI changes, actually play the change — `npm run build`
  passing is necessary but not sufficient
- for docs-only changes, run `python3 scripts/check_docs_links.py` if/when
  this repo adds one (not present yet)
- if a command cannot run, report why
