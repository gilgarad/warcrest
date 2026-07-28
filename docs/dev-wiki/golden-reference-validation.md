# Day 1/2 Golden Reference Validation

Date: 2026-07-28
Branch: `terrain-prototype-central`
Status: complete for human review; volume production is blocked.

## Scope

This work implements only the Day 1 mechanical foundation and the Day 2
golden-reference set. It does not replace the battle scene or produce the
remaining units, props, structures, or terrain families.

## Day 1 foundation

### Asset QA

`tools/asset-qa/normalize_golden_reference.py` converts one generated source
sheet into the canvas classes in `style-guide.md` without changing the shared
ground baseline. `validate_golden_reference.py` then checks:

- exact canvas dimensions;
- opaque-height range;
- ground-anchor delta of at most 2 px;
- at least 12 px top/side alpha margin;
- transparent corners.

All six outputs pass. The machine-readable report is
`public/assets/golden-reference/prototype-golden-qa-report-v1.json`.

### Terrain grammar

`src/systems/terrain/marchingSquares.ts` owns the 4-corner to 16-state mapping
and deterministic polygons, including disconnected diagonal states 5 and 10.
`src/data/terrain/goldenReferenceTerrain.ts` supplies a small diagonal dirt
lane over a continuous grass base. The running reference also displays all 16
states as a legend so missing or reversed masks are visible immediately.

## Day 2 reference set

| Class | Prototype output |
| --- | --- |
| Terrain family | grass base + 16-state dirt transition |
| Grounded prop | `prototype-golden-field-boulder-v1.png` |
| Unit poses | bronze spearman idle, walk A, walk B, attack |
| Structure | `prototype-golden-defense-tower-v1.png` |

The route `/?golden=1` opens an isolated reference scene. It deliberately does
not change `LaneBattleScene` gameplay or its production asset registry.

## Provenance

The raster source was created with the built-in OpenAI image generation tool
from an original prompt for this project. No asset from Warcraft, StarCraft,
Age of Empires, or another game was supplied as an input or copied.

- Raw generated sheet:
  `art-source/golden-reference/prototype-golden-contact-sheet-v1.png`
- Chroma-key removal:
  Codex imagegen skill's local `remove_chroma_key.py` helper, auto-key sampled
  as `#05f80b`, soft matte and despill enabled.
- Alpha source retained for deterministic splitting:
  `prototype-golden-contact-sheet-alpha-v1.png`
- Production status: all files use `prototype-golden-*`; none is approved as a
  production asset.

Prompt contract: one 3-by-2 sheet with the same bronze spearman in idle, two
opposed walk poses, and spear-thrust contact; one boulder; one tower; weak 3/4
top-down projection; late-1990s RTS value grouping; upper-left light; blue sash
as the only team-color area; flat green removable background; no floor,
shadows, text, watermark, or proprietary reference asset.

## Visual evidence

- `artifacts/golden-reference/old-oblique-central.png`: current battle scene,
  1600x900, camera focused on the central structure region.
- `artifacts/golden-reference/new-topdown-golden.png`: new isolated reference,
  1600x900, central structure focus.
- `artifacts/golden-reference/old-vs-new-side-by-side.png`: direct comparison.
- `artifacts/golden-reference/golden-reference-debug.json`: loaded assets,
  terrain masks, projection contract, and camera dimensions.

The comparison is intentionally presentation-to-presentation, not a claim that
the new terrain has already replaced the gameplay map.

## Verification

| Check | Result |
| --- | --- |
| `npm run asset:prepare:golden` | 6 assets normalized |
| `npm run asset:qa:golden` | pass, 6/6 |
| `npm run build` | pass |
| `npm test -- --run` | pass, 24 files / 87 tests |
| Golden-reference Playwright | pass, 1/1 |
| Golden + two structure regressions, repeated twice | pass, 6/6 |

## Human review points

The architecture and asset contract are ready for review, but these visual
judgments remain intentionally open:

1. The dirt transition is readable and seamless at cell boundaries, but its
   stepped contour is deliberately coarse. Decide whether production should
   add rounded/painted edge variants while preserving the 16-state masks.
2. Walk A and walk B preserve body scale and ground anchor, but their silhouette
   difference is subtle. Decide whether the production walk cycle needs more
   exaggerated limb separation.
3. Confirm whether the bronze spearman and tower have enough top-plane exposure
   for the selected weak 3/4 top-down contract.
4. Confirm tower-to-unit scale and shadow density.

No Day 3/4 volume work may start until the user explicitly approves this set.
