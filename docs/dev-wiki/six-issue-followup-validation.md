# Six-Issue Lane Follow-up Validation

Date: 2026-07-28

Branch: `terrain-prototype-central`

Baseline: `3438ca1`

This change closes the current high-oblique lane implementation cleanly before
the separately approved top-down rebuild begins. It does not make the current
camera projection a permanent art-direction decision.

## 1. Capture-point layout

### Confirmed cause

The map contained two player-buildable points at progress `0.375` and `0.767`
plus an unrequested fixed fortress at `0.588`. The fixed fortress was only
`0.213` and `0.179` progress away from its neighbours, so its footprint, label,
selection area, and fighting units occupied the same visual region.

### Decision and result

- Option A, removing the central fixed fortress, was selected. It restores the
  intended two-point structure and avoids another special-case interaction.
- Option B, retaining and moving the fortress, was rejected because it would
  preserve an extra objective that was never part of the requested layout.
- The remaining points are `0.392` progress apart. Both use the normal
  build/capture action path and have independent structure sockets.

Evidence:

- `artifacts/capture-point-distinction/after-two-buildable-points.png`
- `artifacts/capture-point-distinction/after-east-buildable-clicked.png`
- `artifacts/capture-point-distinction/layout-v2.json`

## 2. Structure attack presentation

### Confirmed cause

Melee structure damage and ranged projectile release happened when an attack
cycle started, before the visible contact/release phase. Base pressure was a
continuous HP drain and therefore had no attack action at all.

### Result

- Attack presentation now records `unit` or `structure` as the target kind.
- Melee structure damage lands at the contact phase, about `240 ms` after the
  `500 ms` animation begins.
- Ranged projectiles are released at the release phase, about `134 ms` into the
  `280 ms` animation, and damage remains deferred until projectile impact.
- Base pressure now uses the same cooldown-driven attack path instead of a
  continuous drain. Its per-hit damage preserves the prior average attrition
  rate.
- Melee, ranged, and support roles have separate wind-up/contact/recover motion
  profiles. Structure attacks use more reach and recoil than unit attacks.

Evidence:

- `artifacts/six-issue-followup/axeman-structure-windup.png`
- `artifacts/six-issue-followup/axeman-structure-contact.png`
- `artifacts/six-issue-followup/axeman-structure-recover.png`
- `artifacts/six-issue-followup/slinger-structure-release.png`
- `artifacts/six-issue-followup/slinger-structure-hit.png`
- `artifacts/six-issue-followup/melee-structure-timing.json`
- `artifacts/six-issue-followup/ranged-structure-timing.json`

## 3. Grounding

### Confirmed cause

Rocks and trees used approximate origins, while all world props shared a large
rotated shadow offset. Structure sockets and units used similarly exaggerated
offsets. The shadow centres therefore did not follow each asset's measured
opaque ground contact.

### Result

- Rock and tree ground origins now follow measured alpha bounds (`0.884` and
  `0.902` respectively).
- Each prop has its own shadow profile instead of one global offset.
- World props, structure foundations, and units use smaller near-contact
  shadows with a shared light direction.
- Terrain depth continues to use ground Y; combat and collision values are
  unchanged.

Evidence:

- `artifacts/six-issue-followup/grounding-rock-after.png`
- `artifacts/six-issue-followup/grounding-tree-after.png`
- `artifacts/six-issue-followup/grounding-tower-after.png`
- `artifacts/six-issue-followup/ground-anchor-profiles.json`

## 4. Rear-unit participation

### Confirmed cause

The old slot search provided two progress fronts and six reachable slots per
target. Several generated row candidates were already outside the stone
axeman's attack radius, so rear units could reserve a position without ever
becoming a valid attacker.

### Alternatives considered

- Merely reducing separation made every unit attack but produced severe sprite
  overlap.
- Increasing only the lane width improved readability but did not add enough
  forward positions.
- The selected mixed approach widens row spacing to `62`, adds a third progress
  front, lowers friendly clearance from `0.013` to `0.011`, and searches rows
  `-5..5` at one-row steps.

The final layout offers nine reachable slots per target instead of six. In the
deterministic `12v12` probe, all `24/24` units acquired an attack target and
`22` were in an attack animation on the captured frame.

Evidence:

- `artifacts/six-issue-followup/occupancy-12v12-after.png`
- `artifacts/six-issue-followup/occupancy-comparison.json`

## 5. Music

### Tool decision

No licensed music files exist in the repository, all manifest music entries are
marked `missingAsset`, and this session has no dedicated audio-generation tool.
The implementation therefore improves the existing Web Audio fallback rather
than presenting generated synthesis as a production audio asset.

### Result

- Battle harmony was rewritten around darker minor movement and a low pedal.
- A four-section phrase arc (`0.82`, `0.96`, `1.10`, `1.24`) progressively adds
  drone, bass, lead, brass, pulse, and percussion.
- `battle-high` retains more layers and stronger escalation than `battle-low`.
- Percussion now combines filtered generated noise and a low transient instead
  of relying on oscillator tones alone.

Measured output-bus energy:

| State | RMS | Peak |
|---|---:|---:|
| battle-low intro | 0.008444 | 0.033630 |
| battle-low escalation | 0.010536 | 0.063036 |
| battle-high intro | 0.011509 | 0.043752 |
| battle-high sustain | 0.013534 | 0.075450 |
| battle-high escalation | 0.017574 | 0.101381 |
| muted control | 0.000001 | 0.000009 |

Evidence:

- `artifacts/audio-signal/after-signal.json`
- `artifacts/audio-signal/after-waveform.svg`

## 6. Verification

- `npm run build`: passed.
- `npm test`: 16 files, 69 tests passed.
- Playwright target and regression suite: 21 passed in 7.1 minutes.
- The suite covers attack timing, role motion, occupancy, grounding, capture
  interaction, audio output, support mana, terrain, unit pose/tower volleys,
  direction, and world-surface regression.

## Remaining decisions

1. Confirm that two buildable points with no central fixed fortress is the final
   objective layout for this lane.
2. Decide whether the improved synthesized score is acceptable as a prototype
   fallback or should be replaced with licensed/commissioned recorded music.
3. Review the `12v12` formation density. It solves idle rear units, but a later
   top-down battlefield may support less regimented local steering.
4. Re-evaluate the shadow profiles after the approved top-down terrain rebuild;
   the current values are calibrated for the existing projection only.
