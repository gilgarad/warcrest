# AI Economy Design

Written 2026-08-07 after the user reported the AI "only ever tries to age
up" and asked for the AI to also decide whether to upgrade its own capture
points, with the correlations behind the design worked out first.

## Root cause

Before this change, `tickAi()` did exactly three things: tick the wave
clock, check a hardcoded elapsed-time threshold + affordability gate for
age-up (`shouldAdvanceAiAge`), and check for an instant-wave token. Nothing
in the codebase ever changed `this.enemy.workers` after
`createTeamState()` set it to `{ gold: 1, wood: 1, food: 1, metal: 1,
research: 0, idle: 0 }`. The AI's income was frozen at 1 worker per base
resource for the entire match.

Meanwhile `getAgeUpCost()` compounds by `~1.5x` per age step from a base of
`gold 35 / wood 20 / metal 28` — by `modern_mid → modern_late` the cost is
`gold 1368 / wood 777 / metal 1092` (see the age-up table in
`unit-balance-reference.md`). A frozen 1-worker economy can never keep pace
with that growth. The two *existing* opportunistic systems —
`enemyAutoBuildCapturePoint()` and `enemyAutoRebuildDefenseTower()`, both
already called every frame — rarely fired in practice not because they
were missing, but because the frozen economy almost never had leftover
resources: every tick's income was being hoarded toward the next age-up
threshold, and building costs (10-18 resources) got starved out by the
occasional huge age-up lump sum draining the pool to near zero right when
threshold + affordability aligned.

So "AI only ever tries to age up" was an accurate read of the *outcome*,
but the actual bug was upstream: a workforce that never grows or
rebalances, not a missing building-decision code path.

## Correlations used to design the fix

| Resource | What it's actually needed for | Design implication |
| --- | --- | --- |
| gold / wood / metal | Age-up cost is the AI's single largest recurring expense, and its composition shifts by age (not evenly split) | Weight worker allocation toward these three in the same ratio as the *next* age-up cost |
| food | Continuous wave-spawn cost (`baseWaveFoodCost`, scaled by `foodCostMultiplier`) — this is recurring per wave, not a one-off lump sum, and isn't part of age-up cost at all | Weight food by recurring wave cost, not by age-up cost; starving food stalls offense entirely, which is worse than a delayed age-up |
| research | Only relevant once `activeResourceIds` includes `"research"` (renaissance+); acquired via a separate lump-sum purchase (`hireResearchWorker`-equivalent), not by reallocating an existing worker | Model as its own gated one-off buy, not part of the gold/wood/food/metal reallocation pool |
| worker hiring (`BASE_WORKER_COST` = 10/10/10) | Cheap relative to the permanent +1/tick income it buys | Hire whenever affordable with a reserve, on a cooldown, rather than waiting for a "need" signal |
| capture-point buildings (10-18 resources) | Cheap and permanent value (attack tower / heal / buff), but were always competing with the age-up lump sum for the same pool | Let an affordable-and-unbuilt point's building claim the spend *before* an age-up is allowed to fire that tick |

## What changed

`src/systems/lane-economy/aiEconomy.ts` (new module, tested in
`__tests__/aiEconomy.test.ts`):

- `shouldAiHireWorker` — hires a new worker (into the idle pool) on a
  6s cooldown whenever `BASE_WORKER_COST` is affordable *after* reserving
  `15%` of the next age-up cost, so hiring never permanently blocks the
  age-up the time-threshold gate is working toward.
- `pickNeediestResourceRole` — assigns a freshly hired (or otherwise idle)
  worker to whichever of gold/wood/food/metal has the largest gap between
  its target share (from the weighting table above) and its current share
  of the assigned workforce.
- `planAiWorkerRebalance` — on a 9s cooldown, moves one already-assigned
  worker from the resource with the smallest need-gap to the one with the
  largest, but only when the gap exceeds `0.18` (to stop it flip-flopping
  a single worker back and forth every cycle) and never strips the last
  remaining assigned worker.
- `shouldAiHireResearchWorker` — buys exactly one research worker, once,
  once the current age's `activeResourceIds` includes `"research"`.

`LaneBattleScene.ts`:

- `tickAi()` now calls a new `tickAiEconomy()` every tick, which runs the
  four functions above against `this.enemy`.
- `shouldAiAgeUp()` now first checks `hasAffordableUnbuiltAiCapturePoint()`
  — if the AI can afford a building at one of its owned, unbuilt buildable
  capture points, it holds off age-up for that tick so the (already
  existing) `enemyAutoBuildCapturePoint()` gets first claim on the
  resources. This is the explicit "upgrade my point, or age up" decision
  point the user asked for.

## What was deliberately left alone

- The elapsed-time thresholds in `shouldAdvanceAiAge` are unchanged —
  this fix is about the AI actually being *able* to afford its age-ups on
  schedule, not about changing when it's allowed to try.
- `enemyAutoBuildCapturePoint()`'s building-type choice
  (`target.id % choices.length`) is still a simple deterministic pick, not
  a scored decision — it was already capable of firing, it just needed a
  funded economy and priority-over-age-up to actually do so regularly.
- Research worker count is capped at 1 by this pass; a second one isn't
  clearly worth the (large, age-scaled) direct cost given the current
  research-multiplier formula, and over-buying it would starve gold/wood/
  metal/food. Revisit if research turns out to be underpowered for the AI
  in practice.
