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
