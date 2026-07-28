# Day 3-4 Volume Production Validation

## Scope

The approved golden-reference render contract is the fixed source of truth. Day 3-4
produces assets only; production registries and `LaneBattleScene` remain unchanged
until Day 5 integration.

## Stream A: Stone-age unit pose sets

Produced 12 normalized production candidates under
`public/assets/production/units/`:

- `stone-slinger-{idle,walk-a,walk-b,attack}.png`
- `stone-axeman-{idle,walk-a,walk-b,attack}.png`
- `supply-wagon-{idle,walk-a,walk-b,attack}.png`

The support unit keeps the existing gameplay identity of a human supply porter;
`supply_wagon` remains the runtime id only. Standard infantry poses use the
384x384 `unit-standard` class. Extended attacks and every backpack-heavy porter
pose use the 512x384 `unit-wide` class. All frames share ground Y 336.

### Human review findings

The first generated sheets kept consistent screen-left facing, equipment, team
color regions, and upper-left lighting. Normalized side-by-side review then found
that the initial walk A/B silhouettes reused the same leading leg. Dedicated
walk-B sources were generated for all three units with a high-knee passing pose
and opposite arm/weapon swing. These replacements were reviewed before final QA.

Evidence: `artifacts/volume-production/units-contact-sheet.png`.

### Automated validation

- `npm run asset:prepare:units`: 12 normalized assets generated.
- `npm run asset:qa:units`: 12/12 passed canvas, opaque-height, ground-anchor,
  edge-margin, and transparent-corner checks.
- `npm run build`: passed; existing Vite chunk-size warning only.
- `npm test`: 24 files, 87 tests passed.

Source images and chroma-key alpha intermediates are retained under
`art-source/volume-production/units/`. Assets are not registered in the game.

## Stream B: Terrain material families and field props

Produced four seamless, fully opaque 64x64 base materials (`grass`, `dirt`,
`road`, `stone`) and one complete 16-state transparent marching-squares overlay
family for each material. The 4 bases plus 64 overlays provide 68 reusable assets;
an overlay can be composited over any selected base without baking a second base
into the transition.

Produced five normalized `prop-standard` candidates:

- `field-oak.png`
- `field-pine.png`
- `rock-cluster.png`
- `fallen-log.png`
- `field-boulder.png` (the approved golden-reference boulder, production-renamed)

The initial horizontal rock cluster could not meet the 110 px minimum opaque
height without exceeding the canvas width. It was rejected rather than weakening
the contract, then replaced with a compact triangular rock mound. Magenta chroma
remnants and isolated alpha pixels found in the first prop contact sheet were
removed by a repeatable cleanup stage before final review.

Evidence:

- `artifacts/volume-production/terrain-material-families.png`
- `artifacts/volume-production/props-contact-sheet.png`

Validation:

- `npm run asset:qa:terrain`: 68/68 passed dimensions, base opacity, non-empty
  mask rules, and four-corner marching grammar.
- `npm run asset:qa:props`: 5/5 passed canvas, opaque-height, ground-anchor,
  edge-margin, and transparent-corner checks.
- `npm run build`: passed; existing Vite chunk-size warning only.
- `npm test`: 24 files, 87 tests passed.

The terrain generator is deterministic and project-local; it includes no copied
third-party game art. Assets remain unregistered until Day 5.

## Stream C: Structure family

Produced seven normalized `structure-medium` candidates:

- `defense-tower-full.png`
- `defense-tower-damaged.png`
- `defense-tower-critical.png`
- `defense-tower-ruins.png`
- `defense-tower-construction.png`
- `main-base.png`
- `capture-marker.png`

The tower states share one circular stone-and-bronze identity and footprint.
Damage progresses through chipped battlements, partial collapse, and recognizable
ruins; construction uses the same circular masonry with timber scaffolding. The
capture marker intentionally uses an open stepped dais and flagpole, not an
enclosed firing structure, so it remains distinct from the tower without labels.

The generated 3x2 tower source did not obey exact equal-height cell boundaries:
top-row tower bases crossed the nominal 512 px row. Initial grid splitting therefore
left foreign strips in ruins/construction outputs. The candidates were rejected,
and the normalizer gained manifest-defined crop boxes so each complete object is
extracted from the real source spacing before normalization.

Evidence: `artifacts/volume-production/structures-contact-sheet.png`.

Validation:

- `npm run asset:qa:structures`: 7/7 passed canvas, opaque-height,
  ground-anchor, edge-margin, and transparent-corner checks.
- Final aggregate QA: golden 6/6, units 12/12, terrain 68/68, props 5/5,
  structures 7/7.
- `npm run build`: passed; existing Vite chunk-size warning only.
- `npm test`: 24 files, 87 tests passed.

## Day 5 handoff

No production candidate in this document is loaded by a game scene or registry.
Day 5 must integrate them together, add runtime shadows/depth ordering under the
approved contract, and capture the Phase-1 camera positions before gameplay-scale
acceptance. No additional art-direction decision blocks that integration.
