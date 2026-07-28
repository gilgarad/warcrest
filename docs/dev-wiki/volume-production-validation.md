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
