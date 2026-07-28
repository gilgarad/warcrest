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
