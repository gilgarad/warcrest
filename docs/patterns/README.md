# Patterns Overview

Recurring implementation approaches for `game_project1`. Stack: Phaser 3 +
TypeScript + Vite.

## Established So Far

- **Programmer-art placeholders via `Phaser.GameObjects.Graphics.generateTexture`**:
  the boot scaffold (`src/scenes/BootScene.ts`) draws simple rectangles/stripe
  textures at runtime instead of loading image assets, so gameplay/rendering
  code can be built and verified before the AI-generated pixel art pipeline
  exists. Keep doing this for new mechanics — swap in real sprites later
  without changing scene logic.
- **Headless visual verification**: launch `npm run dev` in the background,
  hit it with a Playwright screenshot, inspect the image, then kill the dev
  server. Used to confirm the Phaser canvas actually renders (not just that
  the build compiles). Repeat this for any change that affects what's drawn
  on screen.

- **Data registries as the extension point** (`src/data/`): `unitTypes.ts`,
  `commands.ts`, `encounterTypes.ts` are plain arrays of config objects.
  Systems and scenes only ever read these registries generically (loop over
  them, look up by id) — they never hardcode a specific unit/command/kind.
  Adding content (a new unit type, a new "방어" command, a new fork-outcome
  kind) means adding one entry to the relevant registry; RunScene's UI
  (button rows, sequence icons) renders itself from whatever is in the
  registry at the time. Adding a genuinely new *kind* of fork outcome still
  needs one new `start*` handler method in `RunScene` — that dispatch is
  intentionally a plain switch, not further abstracted, because there are
  only 3 kinds so far.
- **Systems are UI-free** (`src/systems/`): `Squad`, `runGenerator`,
  `combat` know nothing about Phaser. RunScene is the only place that turns
  their state into GameObjects. Keeps game logic testable without a canvas
  if/when real unit tests get added.
- **`window.__gameDebug`**: `RunScene.update()` writes the current phase/
  progress/combat state to `window.__gameDebug` every frame. It's not read
  by any gameplay code — it exists purely so a headless Playwright script
  can drive/verify the full fork→combat→rescue→mission loop without needing
  a real test framework yet (see `docs/rules/testing.md`). Harmless to leave
  in; remove it if a proper test harness replaces this pattern later.

Expected future pattern files, once relevant:

- `game-loop.md` — core loop / state machine / scene management approach
- `asset-pipeline.md` — how art/audio/data assets are sourced, licensed
  (important: contest entries need clean-rights assets), and wired in
- `web-build-deploy.md` — how the browser build gets published (candidate:
  GitHub Pages, same as the link format required by submission item 1)
- `mobile-export.md` — only if a mobile/APK target is pursued alongside web
- `ai-collab.md` — house style for directing multiple agents (Claude Code /
  Codex / Gemini) on the same repo without them clobbering each other's
  work; link to `docs/ai-usage/README.md`

Keep these focused on recurring implementation approaches, not on process
rules — process goes in `docs/rules/`.
