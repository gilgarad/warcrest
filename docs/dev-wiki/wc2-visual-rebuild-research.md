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
