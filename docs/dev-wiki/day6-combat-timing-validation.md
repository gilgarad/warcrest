# Day 6 Combat Timing Validation

Day 6 polishes attack presentation without changing attack power, cooldown,
range, wave, economy, or capture rules.

## Confirmed causes

- Melee and ranged attacks had event delays, but every role shared one `0.48s`
  visual duration and hard-coded delay multipliers.
- Support healing applied HP immediately when its attack pose began. The cast
  pose and healing event therefore did not line up.
- Role motion used only small whole-sprite offsets, so windup/event/recovery
  silhouettes were difficult to distinguish at gameplay scale.

## Integrated timing profiles

| Role | Duration | Event progress | Configured event delay | Event |
|---|---:|---:|---:|---|
| Melee | 0.46s | 0.48 | 220.8ms | Damage contact |
| Ranged | 0.58s | 0.42 | 243.6ms | Projectile release |
| Support | 0.66s | 0.52 | 343.2ms | Healing applied |

`src/systems/lane-combat/attackTiming.ts` owns these values. The scene asks for
a role profile instead of multiplying a shared duration by local constants.

## Role presentation

- Melee: shorter windup, larger contact reach and rotation, compact recovery.
  Structure strikes retain greater reach/rotation than unit strikes.
- Ranged: readable pre-release draw-back, release snap, then mild recoil and
  recovery. Projectile creation occurs at the configured release event.
- Support: longer readable cast beat with the smallest horizontal motion of the
  three roles. Mana is committed at cast start; HP changes only at the cast
  event.
- Bronze spearman uses the same melee timing profile and production animation
  registry as the stone axeman.

## Evidence

- Role before/after sheet:
  `artifacts/day6-combat-polish/role-timing-before-vs-after.png`
- Individual before/after role frames and bronze-spearman contact:
  `artifacts/day6-combat-polish/`
- Unit melee/ranged timing: `unit-event-timing.json`
- Support cast timing: `support-event-timing.json`
- Unit-vs-structure regression captures:
  `artifacts/six-issue-followup/axeman-structure-*.png` and
  `slinger-structure-*.png`

Playwright wall-clock values are recorded only as capture diagnostics. Software
WebGL screenshots and debug polling make them much larger than game simulation
time; the configured event delay and before/event HP assertions are the timing
contract.

## Construction tower review

`tower-construction-peacetime-review.png` shows the object without unit or
projectile occlusion. The pulley reads as a small crane attached to an
incomplete stone tower, not as a freestanding gallows or well. No asset change
was made.

## Day 7 handoff

Crowded-battle HP bars and labels were intentionally not changed in Day 6.
Their visibility policy, collision/stacking, and priority belong to the Day 7 UI
composition pass.

