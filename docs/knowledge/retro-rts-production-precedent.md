# Retro RTS Production Precedent (1990s Studios)

Researched 2026-07-28, consulting session (`stock_predict_rev` harness,
`game_project1`-only scope). Purpose: ground this project's art pipeline
decisions in how the actual 1990s studios that defined this genre solved the
same consistency problem we're hitting now, instead of guessing.

## The one pattern that shows up everywhere

Every studio checked below used the same three-step shape, not because they
copied each other, but because it's the only way to get dozens of animated
sprites to look like one game instead of a pile of separate illustrations:

1. **A single master reference** (a 3D model, or a locked reference sheet)
   defines proportions, camera angle, and lighting once.
2. **A fixed, narrow render/output contract** — one camera angle, one
   palette, one canvas size class — is applied mechanically to every frame,
   removing per-frame human judgment from the parts that must stay
   consistent.
3. **A dedicated cleanup/normalization pass** happens on every frame after
   generation, before it enters the game. Nobody shipped the raw output of
   step 2 as-is.

Skipping step 3 is exactly the failure mode this project has been hitting
(see `docs/dev-wiki/retro-rts-visual-methodology.md` 4.5/4.5.2 and the
2026-07-28 bug diagnosis session: bronze_spearman frames varied up to 48% in
character height because nothing gated them after generation).

## Evidence by studio

### Blizzard — Warcraft II (1995) / StarCraft (1998)

- Tile grid: `32x32px`. Unit/building sprites use Blizzard's proprietary
  `.GRP` format, square canvases, per-unit size class up to `128x128px`
  (small units like the peasant render at `72x72`).
- Team color is **not** a full-image tint. It's a VGA 6-bit palette with a
  small number of indices (around 4) reserved and swapped per player — only
  those specific pixels change, the rest of the sprite is untouched. This is
  the direct ancestor of the fix we already scoped for the bronze_spearman
  "white blob" bug (swap a marked region, don't multiply-tint the whole
  sprite).
- StarCraft's later sprites/backgrounds were built from 3D Studio Max
  renders, then **pixel artists painted over the pre-rendered output** —
  a hybrid 3D-master + manual-cleanup pipeline, not pure hand-pixel and not
  raw 3D output either.
- Cautionary precedent: StarCraft's first public build (E3 1996) was
  unfavorably compared to Warcraft II and the whole thing was overhauled
  before the 1997 relaunch. A full visual-direction do-over mid-project is
  normal even at the studio that made the genre's reference title — this
  project's three direction reversals (dungeon -> isometric -> lane-oblique
  -> top-down) are the same kind of event, not a sign of process failure.

Sources: [sethb.org GRP format notes](http://www.sethb.org/warcraft2/),
[Warcraft II sprite creation thread, Stratagus forums](http://forums.stratagus.com/viewtopic.php?f=44&t=3650),
[The Digital Antiquarian — StarCraft: A History in Two Acts](https://www.filfre.net/2024/07/starcraft-a-history-in-two-acts/).

### Ensemble Studios — Age of Empires (1997)

- All graphics started as **3D models** (3D Studio / 3D Studio MAX), built
  with anywhere from a couple thousand to 100,000 polygons, textured,
  animated, and rendered to `.FLC` with a **fixed 256-color palette**.
- Critically: the rendered `.FLC` output was handed to a **dedicated 2D
  artist** who took the animation apart frame by frame and cleaned up each
  image in Photoshop — sharpening detail, smoothing irregular edges. Sprites
  were only `20-100px` per side, so this manual per-frame pass mattered a
  lot at that scale.
- Camera/perspective (¾ top-down isometric) was decided once, early, as a
  foundational technical constraint before mass content production — not
  revisited per-asset.
- Result: the AoE sprite cleanup pass was singled out for praise by peers at
  E3 1997, specifically because of consistency at small size.

Source: [Game Developer Archives — Postmortem: Ensemble's Age of
Empires](https://www.gamedeveloper.com/game-platforms/the-game-developer-archives-postmortem-ensemble-s-age-of-empires-).

### Westwood Studios — Dune II / Command & Conquer

- Proprietary animation formats (WSA) for sprite sequences from Dune II
  onward.
- Later titles (Tiberian Sun) moved some buildings/vehicles to voxels while
  keeping infantry as sprites — i.e., they mixed rendering techniques
  per-asset-class deliberately, rather than forcing one technique to do
  everything. Relevant precedent for this project's own hybrid terrain plan
  (`terrain-rendering-plan.md`'s "far matte + structured playable tiles"
  hybrid is the same kind of deliberate mixing).

Source: [Command & Conquer Wiki — Westwood
Studios](https://cnc.fandom.com/wiki/Westwood_Studios).

## What this means for `game_project1`

We are not going to build a 3D-model-to-sprite pipeline in 10 days — that's
not the point of citing this. The point is the **shape** transfers directly
to an AI-image-generation pipeline:

| 1990s studio step | This project's equivalent |
|---|---|
| Master 3D model / reference sheet | A locked style guide + one approved "golden" reference frame per asset class (see the 10-day plan) |
| Fixed camera/palette/canvas contract | Fixed tile size, fixed unit canvas class, fixed light direction, locked palette per faction, written down *before* generating more art |
| Manual/mechanical per-frame cleanup pass | An automated validation script (canvas size, alpha bbox height vs. reference ratio, transparent background, ground anchor) that every generated frame must pass before entering the game — see `docs/dev-wiki/wc2-rebuild-plan.md` |
| Team color via palette index swap | Swap a marked region/material, not a whole-sprite multiply tint (fixes the bronze_spearman white-blob symptom at the root) |

None of the individual technical numbers (32px tiles, 256 colors, etc.) are
mandatory to copy exactly — this project isn't reproducing Warcraft II pixel
for pixel, and doesn't need to. What's mandatory to copy is the *process
discipline*: decide the contract once, lock a golden reference, then gate
every subsequent asset against it mechanically instead of eyeballing each
one after the fact.
