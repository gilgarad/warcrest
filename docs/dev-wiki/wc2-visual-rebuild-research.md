# Warcraft II-style Visual Rebuild Research

This page records the legal and technical research gate before B2. No visual
rebuild code or third-party asset was added during B0/B1.

## B0 - Legal asset boundary

### Decision

- Do not copy, extract, convert, redistribute, or ship Warcraft II terrain,
  sprites, UI, or audio.
- Stratagus and Wargus may be read as engine/data-format references only. No
  Warcraft II-derived output from their import pipeline may enter this repo.
- Original project assets and assets with independently verified compatible
  licenses may be used. The specified OpenGameArt terrain is CC0 and may be
  used as a prototype input, but its source URL and license must remain in the
  asset manifest/documentation.
- "Warcraft II-style" means adopting structural techniques: orthogonal
  top-down cells, deterministic transitions, common grounding/light, and
  readable silhouettes. It does not mean reproducing protected art.

### Primary-source basis

- Blizzard's copyright notice lists *Warcraft II: Tides of Darkness* and
  *Beyond the Dark Portal* as copyrighted works with rights reserved:
  <https://www.blizzard.com/en-us/legal/5515ca11-1c96-42a0-b853-e7876a0d19bf/copyright-notices>
- Blizzard's legal FAQ describes only a limited personal, non-transferable,
  noncommercial display license for downloaded site content and does not grant
  a reusable game-asset license:
  <https://www.blizzard.com/en-us/legal/c1ae32ac-7ff9-4ac3-a03b-fc04b8697010/blizzard-legal-faq>
- Wargus identifies itself as an importer/scripts project and states that game
  data must be extracted from a Warcraft II installer:
  <https://github.com/Wargus/wargus>
- The OpenGameArt entry identifies author TheNess, license CC0, 8x8 tiles, and
  three downloadable PNGs:
  <https://opengameart.org/content/grass-and-dirt-tileset-warcraft-ii-style>

### Repository policy for B2

Every imported file must have an asset-manifest entry containing the original
page, direct file URL, author, license, and whether it is an unmodified source,
derived prototype, or original production asset. A recognizable Blizzard
source or uncertain license blocks import.

## B1 - Terrain grammar and unit projection

### CC0 sheet measurement

The three source PNGs were downloaded to `/tmp` for inspection only; none was
added to the repository. Browser-canvas alpha measurement produced:

| File | Image size | 8x8 cells | Non-empty cells | Unique cells |
| --- | ---: | ---: | ---: | ---: |
| `dirt_6.png` | 32x32 | 16 | 16 | 16 |
| `forest_3.png` | 32x32 | 16 | 16 | 16 |
| `grass_top_0.png` | 48x48 | 36 | 35 | 36 including one empty cell |

This agrees with the source description: transitions merge in every cardinal
direction, include outer and inner corners, and provide three doodle
alternatives. The page explicitly instructs rendering transparent
`grass_top.png` above other tiles.

**Technique choice:** use a 16-state marching-squares transition mask per
material pair, then add transparent edge/doodle overlays. Do not build a
47-tile blob set initially. Add dual-grid corner refinement only where a
playable prototype demonstrates objectionable blunt corners. This is the
smallest grammar that matches both the measured source and the methodology's
recommended scope.

### Stratagus format lessons

The official Stratagus format document states that its playfield uses 32x32
pixel tiles. It separates map tile numbers from graphic tile numbers, reserves
groups for solid terrain, and gives transition groups to terrain pairs such as
water/coast, coast/ground, forest/ground, and light/dark ground. This is a
useful data-model precedent, not code or art to import:

<https://github.com/Stratagus/Stratagus/blob/master/doc/graphics/tileset.html>

The project should therefore keep:

1. logical terrain material and transition mask in map data;
2. visual variant selection in the renderer/adapter;
3. solid ground, transition, and dressing/overlay as separate render passes;
4. an orthogonal 32x32 logical grid, with display scaling controlled by the
   camera rather than changing map semantics.

### Unit projection choice

Use strict top-down orthogonal terrain with **weak 3/4 top-down units and
buildings**. Pure overhead characters make weapons and roles hard to read;
the current near-side-profile poses conflict with a top-down field and cannot
be the production set. New sprites should share one visible ground contact,
short downward shadows, and a common elevation angle. Start with the approved
two horizontal facings plus attack-time micro-rotation; do not generate an
eight-direction set before the first field prototype proves it necessary.

### B2 gate

B2 has not started. Before implementation the user must confirm:

- 16-state transitions plus overlays as the initial terrain grammar;
- weak 3/4 top-down units/buildings on strict top-down terrain;
- whether the `0.750` tower versus `0.767` capture proximity is resolved by
  moving the old capture, relaxing the exact 1:2 ratio, or adding a lateral
  structure lane;
- the Phase checkpoint choices for road width/material contrast, shadow
  strength/direction, melee exaggeration, and music tone.
