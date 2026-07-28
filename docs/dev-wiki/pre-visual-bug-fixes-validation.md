# Pre-visual Bug Fixes Validation

This page records the three gameplay-visible fixes that must land before the
top-down visual rebuild resumes.

## A1 - Bronze spearman source-color rendering

### Confirmed cause

The PNGs load correctly, retain alpha, and the two-frame attack array is safely
clamped by `resolveUnitAnimationTexture`. No `setTintFill` call or texture-key
collision exists. The remaining presentation mutation was a persistent team
multiply tint on every unit, reapplied after each hit flash. At small gameplay
scale this reduces palette separation on the bronze spearman's bright skin and
gold surfaces.

Persistent unit tint was removed. Team identity remains available through HP
bar color, label color, and the selection ring. Temporary hit tint still clears
after 80 ms without reinstating a multiply tint.

### Evidence

- Before: `artifacts/bronze-spearman-fixes/a1-before-team-tint.png`
- After: `artifacts/bronze-spearman-fixes/a1-after-source-color.png`
- Runtime state: `artifacts/bronze-spearman-fixes/a1-render-state.json`
- Runtime assertion: bronze spearman uses `bronze-spearman-idle` with tint
  `0xffffff` at the normal gameplay camera scale.

### Verification

- `npm run build`: passed.
- `npm test`: 21 files, 83 tests passed.
- Playwright `bronze-spearman-fixes.spec.ts`: 1 test passed.

## A2 - Per-frame silhouette normalization

### Chosen direction

Direction 2 (code correction) was selected. Re-rasterizing already-normalized
1152x1024 PNGs would introduce another lossy asset transform. The shared
animation registry now records each frame's measured alpha-bounds height and
the presentation resolver scales the canvas per texture while retaining the
common ground anchor `(450, 900)`.

The measurement also confirmed smaller but visible variation in the stone
axeman, stone slinger, and supply wagon frames, so all four registered units use
the same per-frame correction rather than special-casing the bronze spearman.

### Evidence

- Raw measurements:
  `artifacts/unit-animation-tower-v2/normalized-frame-metrics.json`
- Sequence screenshots:
  `artifacts/bronze-spearman-fixes/a2-idle-before.png`,
  `a2-windup.png`, `a2-contact.png`, and `a2-idle-after.png`
- Measured runtime sequence:
  `artifacts/bronze-spearman-fixes/a2-attack-height-sequence.json`
- Idle, wind-up, contact, and returned idle all measure 100 CSS px of visible
  silhouette height. The backing canvas height changes as intended while the
  feet retain one ground anchor.

### Verification

- `npm run build`: passed.
- `npm test`: 22 files, 85 tests passed.
- Playwright `bronze-spearman-fixes.spec.ts`: 2 tests passed.

## A3 - Capture points and defense towers are separate structures

### Confirmed cause

The old runtime used one `CapturePointState` for capture ownership, economic
buildings, tower HP, tower attacks, destruction, reconstruction, sprites, and
input. The map likewise exposed one `capture-tower` socket at each capture
progress. Moving only the image could not fix that coupling.

The map contract now has distinct `capture-point` and `defense-tower` sockets.
Capture points retain progress `0.375` and `0.767`; the requested own-base
distance rule places defense towers at progress `0.750` and `0.534`.
`LaneBattleScene` owns separate `capturePoints` and `defenseTowers` collections,
separate selection state, and separate visual refresh paths. Capture actions
now cover only supply depots, mints, and dismantling. Tower HP, cost, attacks,
destruction, and ten-second reconstruction use the dedicated defense-tower
definitions and rules.

### Evidence

- Coordinates: `artifacts/capture-tower-separation/coordinates.json`
- Player-side view: `artifacts/capture-tower-separation/player-side-separated.png`
- Enemy-side view: `artifacts/capture-tower-separation/enemy-side-separated.png`
- Playwright clicks both defense towers and asserts that tower selection clears
  capture selection. The capture-point distinction check independently clicks
  a capture label and exposes only economic-building actions.
- Unit tests assert four map sockets, their distinct kinds, and the requested
  progress-space ratio: own base to tower = 2 x own base to linked capture.

### Remaining map-layout conflict

The exact requested formula exposes a pre-existing asymmetry: player tower
progress `0.750` lies only `0.017` from the unchanged enemy-side capture at
`0.767`. Their state and input paths are independent, but their art remains
close. Changing either progress would violate the explicit instructions to
retain capture progress and use the exact 1:2 rule. This needs an explicit map
layout choice before B2: move the old capture, relax the ratio, or add a
lateral structure lane in the new top-down terrain grammar.

### Verification

- `npm run build`: passed.
- `npm test`: 23 files, 85 tests passed.
- Playwright `capture-tower-separation.spec.ts`: passed.
- Playwright capture-point click plus melee/ranged structure timing checks:
  passed after the debug contract was moved from `controlPoints[].towerHp` to
  `defenseTowers[].hp`.
