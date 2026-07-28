# Day 7.5 Unit Art Validation

## Scope

Day 7.5 replaces the six remaining procedural unit badges with production art:
`bronze_swordsman`, `archer`, `iron_swordsman`, `iron_spearman`, `musketeer`,
and `knight`. Each unit has idle, walk A, walk B, and attack poses, for 24
player frames and 24 localized enemy-team palette variants.

## Asset Production

- Sources were generated with the approved weak 3/4 top-down contact-sheet
  contract on a chroma background, then processed locally with the imagegen
  chroma-removal helper and `normalize_golden_reference.py`.
- Infantry idle/walk frames use the 384x384 `unit-standard` canvas. Long attack
  poses and all mounted-knight poses use the 512x384 `unit-wide` canvas.
- All frames use ground anchor Y 336, normalized opaque height 270, upper-left
  lighting, and localized blue team-color regions.
- The archer source contained a detached in-flight arrow that would duplicate
  the runtime projectile. The detached alpha component was removed before
  normalization.
- The first iron-spearman and musketeer walk B poses did not read as a clear
  opposing stride. Dedicated replacement walk B sources were produced and used.

## Asset QA

`python3 tools/asset-qa/validate_golden_reference.py --spec tools/asset-qa/day7-5-unit-assets.json --assets public/assets/production/units`
passes all 24 frames. Canvas size, opaque-height range, shared ground anchor,
edge margin, and transparent-corner checks pass. Team palette generation finds
authored swappable blue pixels in all 24 frames (414 to 3,171 changed pixels per
frame).

Human review contact sheet:
`artifacts/day7-5-unit-art/units-contact-sheet.png`.

## Runtime Integration

- `unitAnimationRegistry.ts` now registers all ten roster unit IDs through one
  shared production animation-definition factory. Infantry use standard idle/
  walk canvases with wide attack canvases; the supply porter and mounted knight
  use wide canvases for every pose.
- `unitStats.ts` points the six new units at their authored idle textures.
- The scene no longer creates or invokes procedural `token-*` textures. `rg -n
  "token-" src` returns no matches.
- The existing combat, economy, roster, and wave values were not changed.

## Runtime Verification

- `npm run build`: pass.
- `npm test -- --run`: 29 files and 114 tests pass.
- `npx playwright test tools/validation/day7-5-unit-art.spec.ts --workers=1`:
  pass (1/1).
- The Playwright probe spawns one real player wave for each age, checks the
  exact four-unit roster, and asserts every rendered texture equals an authored
  idle pose with no token fallback.

Evidence:

- `artifacts/day7-5-unit-art/wave-stone.png`
- `artifacts/day7-5-unit-art/wave-bronze.png`
- `artifacts/day7-5-unit-art/wave-iron_early.png`
- `artifacts/day7-5-unit-art/wave-iron_mid.png`
- `artifacts/day7-5-unit-art/wave-iron_late.png`
- `artifacts/day7-5-unit-art/five-age-wave-snapshots.json`

Day 7.5 is complete. The roster has no remaining runtime art placeholders and
is ready for the Day 8 full regression pass.
