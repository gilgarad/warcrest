# Warcrest Golden Reference Style Guide

Date: 2026-07-28
Status: first-cycle production contract retained; second-cycle eight-direction
extension confirmed on 2026-07-29.

## 1. Rendering contract

Terrain uses a strict orthographic top-down square grid. Units, props, and
structures use a weak 3/4 top-down view so their silhouettes remain readable.
The camera contract must not be changed per asset.

- Logical terrain tile: `32 x 32` world pixels.
- Authored terrain tile: `64 x 64` pixels, downsampled or displayed at the
  logical size with one shared filtering policy.
- Terrain transition grammar: 16-state marching squares.
- Transition artwork: transparent material overlays over a continuous base
  material. A transition does not contain its own unrelated base texture.
- Facing: eight authored directions (`N/NE/E/SE/S/SW/W/NW`). The existing
  west-facing production art is the migration source, not disposable work.
  Horizontal reflection is allowed only as a temporary compatibility fallback
  while a unit is incomplete; it is not accepted as final production art.

### 1.1 Eight-direction animation contract

Every completed production unit owns one pose set per direction:

```ts
type UnitFacingDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface UnitDirectionalPoseSet {
  idle: string;
  walkA: string;
  walkB: string;
  attack: readonly string[];
}

interface UnitAnimationDefinition {
  directions: Partial<Record<UnitFacingDirection, UnitDirectionalPoseSet>>;
  fallbackDirection: UnitFacingDirection;
  legacyHorizontalMirror: boolean;
  // Existing canvas, anchor, visible-height, and scale metrics follow unchanged.
}
```

- Final production requires all eight direction keys. A partial record exists
  only so units can migrate one at a time without breaking the playable build.
- Motion vectors are quantized into eight equal `45deg` screen-space sectors.
  A stopped unit retains its last non-zero direction.
- Direction selection changes texture lookup only. The canvas class, ground
  anchor, visible-height normalization, team palette region, and combat timing
  contracts remain unchanged.
- The final eight-direction set uses independently authored views. A
  four-cardinal-plus-mirror compromise was rejected because reflection cannot
  synthesize diagonal body volume and reverses handed equipment, directional
  lighting, and asymmetric team-color regions.
- New directional keys use
  `<unit-id>-<direction>-<pose>` (for example,
  `bronze-spearman-ne-walk-a`). Existing west assets keep their current keys
  during migration so the approved first-cycle art remains usable.
- Each direction keeps the same silhouette and equipment identity. Facing
  changes camera-relative orientation, not character design, proportions,
  palette, or weapon loadout.
- Day 2 is the migration gate: one unit must provide `8 x 4 = 32` direction-pose
  frames, pass the existing canvas/anchor QA, and be approved before the other
  nine units are expanded.

## 2. Measured source problem

The current pose PNGs are `1152 x 1024`, while their alpha bounds are much
smaller. Across the 19 measured frames in
`artifacts/unit-animation-tower-v2/normalized-frame-metrics.json`:

| Metric | Measured value |
| --- | ---: |
| Median opaque width | 373 px |
| Median opaque height | 571 px |
| Maximum ordinary pose width | 598 px |
| Maximum pose height | 642 px |
| Average unused canvas area | 80.4% |
| Runtime normal-unit target | 94-106 CSS px high |

The bronze spear contact frame is a `1019 px` width outlier caused by a long
horizontal weapon pose. It must not force every idle/walk frame onto a
`1152 x 1024` canvas.

## 3. Canvas classes and anchors

All production frames use transparent RGBA PNGs. Coordinates below are source
pixels and refer to the untrimmed production canvas.

| Class | Canvas | Ground anchor | Opaque height target | Use |
| --- | --- | --- | --- | --- |
| `unit-standard` | `384 x 384` | `(192, 336)` | `230-288` | infantry idle/walk and compact attacks |
| `unit-wide` | `512 x 384` | `(256, 336)` | `230-288` | spear thrusts, ranged attacks, support carts |
| `prop-standard` | `256 x 256` | `(128, 224)` | `110-200` | rocks, trees, small field props |
| `structure-medium` | `512 x 512` | `(256, 448)` | `280-420` | tower or capture structure |

Rules:

- Every frame in an animation shares the same ground anchor in its canvas
  class. Feet or the structure footprint touch the anchor baseline.
- Alpha bounds must stay at least 12 px from the canvas edge. If an attack
  exceeds `unit-standard`, only that attack uses `unit-wide`; runtime alignment
  still uses the same normalized ground anchor.
- The opaque height difference among idle/walk frames is at most 8%. Attack
  frames may differ by 15%, but the feet may not move vertically.
- Runtime scaling targets visible silhouette height, not full canvas height.
- Source master, generated raw render, normalized production frame, and runtime
  texture are separate artifacts. Raw generated images are never loaded by the
  game directly.

## 4. Light and shadow

One light is fixed above the upper-left of the screen. Lit planes face
upper-left; cast shadows travel lower-right.

- Key light screen direction: upper-left to lower-right (`135deg` cast
  direction in screen coordinates).
- Light elevation target: about `50deg`, kept consistent rather than simulated
  per object.
- Ambient fill is cool and restrained. Occlusion at feet and foundations is
  darker and warmer than broad cast shadows.
- Unit contact shadow: compact ellipse centered 2-4 px below the ground anchor.
- Prop and structure cast shadows must share direction and softness with the
  unit shadow. A baked shadow must not be combined with a contradictory runtime
  shadow.

## 5. Palette and team color

The shared world palette uses muted olive grass, warm earth, neutral gray
stone, bronze metal, and cool blue accents. Values should remain grouped like a
late-1990s RTS sprite rather than using continuous photographic gradients.

- Team color is limited to authored mask regions such as a shield emblem,
  shoulder sash, pennant, or narrow trim.
- Team regions use four ordered values so a palette swap preserves shading.
- Whole-sprite multiply tint is prohibited. The A1 no-tint presentation path is
  retained.
- Skin, metal, wood, and ground shadow pixels are never team-swapped.
- The default player swatch is blue; enemy validation uses a red swap of only
  the designated mask.

## 6. Golden-reference acceptance

Day 2 contains exactly one terrain material family, one grounded prop, one full
unit pose set, and one structure. Before volume production, all must satisfy:

1. Asset QA reports the declared canvas, alpha margin, ground anchor, and
   opaque-height tolerance.
2. A tiled terrain sample has no visible seam at 1x and 2x display scale.
3. Unit feet, prop base, and structure foundation share the same ground plane.
4. Shadows agree in direction and density.
5. The bronze spearman reads as weak 3/4 top-down in idle, both walk poses, and
   attack without changing apparent body size.
6. Old-oblique and new-topdown captures use the same viewport and camera focus.
7. No additional unit, terrain family, prop, or structure is produced until a
   human explicitly approves this reference set.

## 7. Evidence and provenance

The canvas decision is based on the repository's measured frame metrics and
runtime target heights, not on another game's assets. The production method
follows the precedent documented in
`docs/knowledge/retro-rts-production-precedent.md`: fixed master reference,
fixed render contract, then mechanical cleanup and normalization. No Warcraft,
StarCraft, or other proprietary game asset may be copied into this repository.
