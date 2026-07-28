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
