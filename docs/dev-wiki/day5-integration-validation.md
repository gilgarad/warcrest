# Day 5 Integration Validation

Day 5 replaces presentation assets one subsystem at a time. Gameplay data and
combat/economy/capture rules remain unchanged.

## Step 1: production terrain

- Runtime mode: `?terrain=world-surface`
- Logical map contract: unchanged `TerrainPatchSpec` cells and structure sockets
- Visual mapping: logical grass -> production grass, logical dirt/stone shoulder
  -> production dirt, logical stone center -> production road
- Structure ground: production stone texture beneath the existing foundation
- Transition grammar: shared-corner 16-state marching squares; adjacent tile
  edges are asserted to use identical corner bits
- Assets loaded: four material bases and 64 transition overlays from
  `public/assets/production/terrain/`

### Verification

- `npm run build`: pass
- `npm test`: pass, 25 files / 90 tests
- `npx playwright test tools/validation/world-surface.spec.ts --workers=1`:
  pass
- Gameplay equivalence: `artifacts/world-surface/gameplay-equivalence.json`
- 1x capture: `artifacts/world-surface/production-terrain-1x.png`
- 2x capture: `artifacts/world-surface/production-terrain-2x.png`
- Four fixed camera captures: `artifacts/world-surface/world-surface-*.png`

The renderer no longer synthesizes the lane from two tinted rounded bands. It
uses the existing logical terrain cells and production textures. Segment
geometry, walkability, sockets, and path coordinates were not modified.

The 1x/2x comparison uses the same 1024x576 CSS viewport with Playwright
`deviceScaleFactor` 1 and 2. Screenshots are emitted at CSS scale so the files
can be compared directly without making the software-WebGL readback itself the
performance bottleneck.

## Step 2: production props

- Reused all six existing `TerrainPropSpec.position` coordinates and unchanged
  non-blocking footprints.
- Replaced the old two-texture set with the approved oak, pine, rock cluster,
  boulder, and fallen-log production family.
- Applied the shared 256x256 canvas ground anchor `(128, 224)`, resulting in
  Phaser origin `(0.5, 0.875)` for every prop.
- Removed the renderer's old whole-sprite tint so production palette and
  upper-left lighting remain intact.

### Verification

- `npm run build`: pass
- `npm test`: pass, 26 files / 91 tests
- Grounding Playwright probe: pass, 1/1
- Captures and anchor profile: `artifacts/six-issue-followup/grounding-*-after.png`
  and `ground-anchor-profiles.json`

No prop position, movement obstacle, or path coordinate changed.

## Step 3: production units

- Replaced all four registry families with production assets: stone slinger,
  stone axeman, supply porter, and the approved bronze spearman attack-v2 set.
- Removed the old 1152x1024 canvas assumption. Every frame now records its own
  384x384 or 512x384 aspect while sharing visible height `270/384` and ground
  anchor `(0.5, 0.875)`.
- Recorded the approved native left-facing direction; runtime flip now compares
  movement facing against that contract instead of assuming right-facing art.
- Added deterministic blue-to-red authored-region variants. The generator
  changed designated pixels in all 16 frames while preserving alpha and all
  non-team materials; no persistent whole-sprite tint is used.

### Verification

- `npm run build`: pass
- `npm test`: pass, 26 files / 92 tests
- `npm run asset:qa:units`: pass, 12/12 volume assets
- Team palette generation: pass, 16/16 (`team-palette-report.json`)
- Unit animation/tower Playwright suite: pass, 6/6
- Pose galleries, team comparison, metrics, and bronze-wave capture:
  `artifacts/unit-animation-tower-v2/`

The approved volume set has one authored attack pose per unit. Existing combat
timing and attack contact rules are unchanged; Day 6 can add temporal staging
without changing these integrated frame contracts.

## Step 4: production structures

- Replaced the main bases, five defense-tower states, and capture marker with
  the approved `structure-medium` production family.
- Added deterministic player/enemy structure palettes and a neutral capture
  marker. Runtime selection changes authored team-color regions only; no
  whole-sprite tint is applied.
- Kept every structure progress/socket coordinate unchanged. The existing
  minimum separation and ownership/capture rules are unaffected.
- Applied one ground origin `(0.5, 0.875)` and state-specific visible bounds so
  full, damaged, critical, ruins, and construction tower states remain at the
  same perceived gameplay height.

### Verification

- `npm run build`: pass
- `npm test`: pass, 27 files / 94 tests
- `npm run asset:qa:structures`: pass, 7/7 source assets
- Structure Playwright suite: pass, 3/3
- Five-state metrics, three marker palettes, both bases, and construction
  review: `artifacts/day5-structures/`

The isolated construction capture reads primarily as an incomplete stone tower
with scaffolding. It does not read as a well or freestanding gallows at gameplay
scale because the pulley is attached to the tower body. The small upper crossbar
can still read as a cross-shaped silhouette at a glance; retain this as a manual
play-review point rather than blocking Day 5 integration.

Day 6 rechecked this asset in a peacetime, unoccluded runtime capture and found
that the crossbar reads as a crane attached to the incomplete tower. No asset
revision was required.

## Final four-layer audit

The Phase 1 fixed central camera, seed, and layer controls were reused without
overwriting the baseline. Day 5 captures are in
`artifacts/day5-integration-audit/`:

- `after-ground.png`: production terrain and unchanged structure foundations
- `after-props.png`: production props and structures with shared grounding
- `after-units.png`: production unit families and authored team palettes
- `after-combat-01.png` through `after-combat-08.png`: deterministic combat
  sequence
- `golden-vs-integrated.png`: approved golden reference beside the integrated
  runtime scene

The runtime now matches the golden reference's top-down projection, upper-left
lighting, grounded shadows, and authored-region team-color contract. Remaining
differences are the runtime lane's deliberately straight, uniform geometry and
the density of HP bars/labels during crowded combat. Those require later map/UI
composition work rather than further asset-registry changes.
