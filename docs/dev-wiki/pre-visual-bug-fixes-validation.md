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
