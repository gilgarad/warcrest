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
  Adding content (a new unit type, a new "방어" command) means adding one
  entry to the relevant registry; `DungeonScene`'s combat UI (button rows,
  sequence icons) renders itself from whatever is in the registry at the
  time.
- **Systems are UI-free** (`src/systems/`): `Squad`, `combat`,
  `dungeonGenerator` know nothing about Phaser. `DungeonScene` is the only
  place that turns their state into GameObjects/physics bodies. Keeps game
  logic testable without a canvas if/when real unit tests get added.
- **`window.__gameDebug`**: `DungeonScene.update()` writes the current
  phase/squad/combat/player-position/dungeon-grid state to
  `window.__gameDebug` every frame (`GameOverScene` writes a terminal
  `{phase:"gameover", win, squadSize}` on the way out). Not read by any
  gameplay code — it exists purely so a headless Playwright script can
  BFS-pathfind the generated grid and drive a full playthrough without a
  real test framework yet (see `docs/rules/testing.md`).
- **Random-walk dungeon carving** (`src/systems/dungeonGenerator.ts`):
  walks a corridor of straight-ish segments (small per-step turn chance,
  forced turn only at map edges), dropping a small room every segment, plus
  1-2 short side branches off the main path. Reachability from the start is
  guaranteed by construction — every carved tile sits on a walk, so there's
  no separate connectivity check needed. Room content (combat vs. rescue)
  reuses the same weighted picker (`pickRandomForkKind`) the old fork system
  used, so that balance knob lives in one place regardless of how it's
  presented to the player.
- **Arcade physics body offset is relative to the frame's top-left, not the
  sprite's display origin.** Cost real debugging time: chibi textures are
  drawn with a default (0.5, 0.5) origin, and a body `setOffset()` computed
  as if origin were (0,0) silently shifted the player's hitbox down into the
  tile row below, making movement stall a couple tiles in (looked like a
  "wall" that wasn't in the grid data). Fix: for a top-down footprint box,
  center it in frame space — `offset = (frameSize - boxSize) / 2` on both
  axes — rather than reasoning about "where the feet are." When collision
  looks wrong but the grid/logic looks right, render with
  `physics: { arcade: { debug: true } }` before doubting the data.
- **Fog-of-war + minimap**: one `Rectangle` per tile (`fogTiles`), alpha set
  per-tile from Chebyshev distance to the player's current tile (0 = fully
  visible inside `VISION_RADIUS`, dim if previously revealed, opaque black
  otherwise). Recomputed only when the player crosses into a new tile, not
  every frame. The minimap (`minimapGfx`) redraws off the same `revealed`
  grid at the same time, so the two never disagree.
- **Pseudo-3D tiles via wall-cast contact shadows, not per-tile banding.**
  First attempt shaded every tile individually (light band top, dark band
  bottom) — repeated across many stacked tiles it just produced a
  venetian-blinds pattern, not depth. What actually reads as "walls have
  height": (1) only bevel *surface* wall tiles (the ones bordering a
  corridor) with a lighter top face + dark bottom edge — tiles fully
  surrounded by other walls stay a flat dark mass, or the same blinds
  problem reappears at a bigger scale; (2) draw a soft multi-band contact
  shadow on floor tiles adjacent to a wall, fading out a few pixels in. The
  shadow correlates with actual grid geometry instead of being decorative
  per-tile noise, which is what sells the illusion. See
  `DungeonScene.buildTilemapVisual()`.
- **Character shading via `shade()`** (`src/gfx/chibi.ts`, exported): a
  small helper that lightens/darkens a hex color toward white/black.
  `drawChibiTexture` uses it for a highlight/shadow pass on the head and
  body (plus a thin outline stroke) instead of flat single-tone fills — a
  cheap way to make procedurally-drawn sprites read as less flat without
  needing real art. All proportions are expressed as fractions of a
  `BASE_W`/`BASE_H` scaled by `s = width / BASE_W`, so requesting a smaller
  texture (`{ width, height }` opts) stays self-similar instead of just
  cropping — used to draw a second, smaller sprite set for the dungeon's
  pulled-back camera without duplicating the drawing code.
- **Texture keys are global, not per-scene.** Phaser's texture manager is
  shared across the whole game, so `BootScene`'s full-size preview sprites
  and `DungeonScene`'s smaller gameplay sprites need *different* texture
  keys (`chibi-soldier` vs `chibi-soldier-sm`) even though both call
  `drawChibiTexture` with the same unit — reusing a key silently returns
  whichever size was generated first, from either scene.
- **Persistent side panel instead of a modal popup for combat.** First combat
  UI was a center-screen box that appeared/disappeared per encounter — user
  feedback: attack/defense should live in an always-visible slot panel (like
  an equipped action bar) that the player interacts with, not a box that
  pops up. Fixed layout now: `setupActionPanel()` builds the panel and one
  button per `COMMANDS` entry *once* in `create()`; combat only toggles
  their active/dim styling (`refreshSlotStyles`) and fills in the
  per-encounter sequence-preview icons and timer bar, it never
  creates/destroys the panel itself.

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
