# Day 7 UI Composition Validation

Day 7 reduces world-space combat annotation density and the fixed HUD footprint
without changing unit HP, combat, wave, economy, capture, or camera rules.

## Day 6 timing rationale (retrospective)

Day 6 chose role-specific timing around a readable event beat rather than a
shared animation duration. Melee uses `0.46s` with contact at `48%` (`220.8ms`)
so the short windup still gives way to a pronounced impact silhouette. Ranged
uses `0.58s` with release at `42%` (`243.6ms`) to leave visible draw time before
the projectile exists and reserve the remaining animation for recoil. Support
uses the longest duration, `0.66s`, with its cast at `52%` (`343.2ms`), keeping
the motion restrained while making the delayed HP change readable. The
before/after sequences in `artifacts/day6-combat-polish/` show that the same
production frames now communicate different role rhythms; event assertions
verify that damage, projectile creation, and healing occur at those beats.

## Confirmed UI density cause

- Every visible unit previously retained an individual HP bar.
- Disabling the label policy for a baseline frame produced 24 simultaneous
  names and HP bars in the deterministic 12-vs-12 probe.
- The display policy had no screen-space cluster concept, so overlapping units
  could not share a readable summary.

## Adaptive unit overlays

`unitOverlayDensity.ts` forms connected same-team clusters in screen space.
Groups of three or more use one representative overlay showing team count and
aggregate HP percentage. Other members hide only their redundant overlays;
their unit sprites and underlying HP values are untouched. Selected or hovered
units remain detailed even inside a cluster, preserving individual inspection.
Sparse units keep individual HP bars, and priority support units retain their
mana bar.

In the deterministic crowded probe:

| Metric | Before | After |
|---|---:|---:|
| Units | 24 | 24 |
| Individual overlays | 24 | 0 |
| Aggregate summaries | 0 | 2 |
| Redundant overlays hidden | 0 | 22 |

The two summaries are `아군 ×12 · HP 100%` and `적군 ×12 · HP 100%`. This is
information hierarchy, not deletion: aggregate state remains visible and a
specific unit returns to detail on pointer hover or selection.

## Fixed HUD composition

The ornate HUD texture is retained, but its occupied source slices changed
from `188 + 278` to `160 + 220` pixels. Controls were repacked into those
shorter bands, base HP bars moved into the lower edge of the top band, and the
worker/action rows moved into the compact bottom band.

At the 1600x900 validation viewport, the unobstructed world-height ratio rises
from `0.5045` to `0.5960` (about 18% more open vertical world area relative to
the old open area). The HUD on/off captures use an identical camera and unit
state; the off frame confirms that the central battle and adjacent structures
remain in the same positions.

## Evidence

- Density before/after: `artifacts/day7-ui-composition/density-before-vs-after.png`
- HUD on/off, same camera: `artifacts/day7-ui-composition/ui-on-vs-off.png`
- Raw captures: `artifacts/day7-ui-composition/*.png`
- Overlay counts: `artifacts/day7-ui-composition/density-metrics.json`
- HUD footprint: `artifacts/day7-ui-composition/ui-composition-metrics.json`

## Verification

- `npm run build`: pass
- `npm test`: pass, 29 files / 102 tests
- `day7-ui-composition.spec.ts`: pass, 2/2
- Day 6 regression Playwright: pass

## Plan status and next gate

The originally approved Day 1-7 visual rebuild phases are complete. A later
cross-roster audit added Day 7.5: five post-stone-age battle units still use
runtime token placeholders. That is a separate asset-coverage gap, not an
unfinished Phase 6 item, but it must be closed before Day 8 full regression so
the age-by-age regression run tests production visuals rather than known
placeholders. Day 8 should therefore start only after Day 7.5.

Manual Day 8 review should still check pointer/touch inspection during a moving
crowd and the compact bottom controls at the project's supported desktop aspect
ratios.
