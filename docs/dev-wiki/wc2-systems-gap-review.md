# WC2 System-Parity Gap Review

Date: 2026-07-28

Written by the consulting session (`stock_predict_rev` harness, scoped to
`game_project1` only, source-unmodified) after Day 0-7 of
`wc2-rebuild-plan.md` landed. The user asked for a fresh pass over the whole
project — not just visuals — to find what would actually make this play
closer to Warcraft II's systems, and to document whatever is still
unaddressed clearly enough that the next prompt can act on it without
re-deriving this analysis.

This document is ranked by what actually threatens the outcome of the
10-day plan, not by how interesting each idea is. Read section 1 first —
it is the one finding that can undo the entire visual rebuild if left
unaddressed.

## 1. Critical: 6 of 9 battle unit types still render as generic token
badges, not production art (highest priority, do before Day 8)

**Correction (2026-07-28, same day):** the table below always listed 6
placeholder units — the section heading and downstream references
originally miscounted it as "5". It is 6 units x 4 poses = 24 frames, not
5 x 20. Fixed here and in `backlog.md`; if any handoff prompt still says
"5종/20 frames," treat this note as authoritative.

### What was found

`src/data/unitRosters.ts` declares 9 `BattleUnitId` values and wires them
into `AGE_WAVE_ROSTERS` across all 5 ages (`stone`, `bronze`, `iron_early`,
`iron_mid`, `iron_late`). Cross-checking against
`src/presentation/units/unitAnimationRegistry.ts` and
`src/systems/lane-units/unitStats.ts`:

| Unit | Age(s) it spawns in | Art status |
| --- | --- | --- |
| `stone_slinger` | stone, bronze, iron_early | Full production pose set (Day 3-4/5) |
| `stone_axeman` | stone | Full production pose set |
| `bronze_spearman` | bronze | Full production pose set (the original golden reference unit) |
| `supply_wagon` | every age | Full production pose set |
| `bronze_swordsman` | bronze | **`textureKey: "token-axe"`** — a generated placeholder shape, not a character sprite |
| `archer` | iron_early, iron_mid, iron_late | **`textureKey: "token-ranged"`** — placeholder |
| `iron_swordsman` | iron_early, iron_mid | **`textureKey: "token-axe"`** — placeholder (reuses the same shape as bronze_swordsman) |
| `iron_spearman` | iron_mid | **`textureKey: "token-spear"`** — placeholder |
| `musketeer` | iron_late | **`textureKey: "token-ranged"`** — placeholder (same shape as archer) |
| `knight` | iron_late | **`textureKey: "token-elite"`** — placeholder |

`LaneBattleScene.ts` (around line 432) generates these `token-*` textures
procedurally at runtime — simple colored shapes, a leftover from the
pre-golden-reference era. This is not a crash or a missing-texture error;
it renders fine. But it means **any playthrough that reaches bronze age or
later shows a mix of fully painted, top-down, team-palette-swapped
characters next to plain colored badges**, which is a worse visual
regression than any single bug fixed so far in this rebuild — it's visible
to every player and every contest judge who advances past the opening
minutes, not just an edge case.

### Why this was missed

Day 0-7 scoped "unit" work to exactly the 4 units already spawned by
default at game start (stone age roster + supply wagon), because that's
what's on screen in the first minute of play and what earlier bug reports
(bronze_spearman white blob, facing flip) were about. Nobody cross-checked
the full `AGE_WAVE_ROSTERS` table against the animation registry, so the
5-unit gap was never on a checklist.

### What to do about it

Two options, ranked by fit with the remaining schedule (Day 8-10 is
regression + buffer + submission prep per `wc2-rebuild-plan.md`):

- **Option A (recommended): produce the 6 missing units through the exact
  same pipeline already proven in Day 3-4.** It is mechanical at this
  point — golden-reference-style generation, chroma-key removal,
  `normalize_golden_reference.py`, QA gate, registry wiring. The pipeline,
  canvas classes, and QA scripts already exist and don't need to be
  redesigned. This is real work (6 units x 4 poses = 24 frames, under the
  same facing/silhouette discipline as Day 3-4), but it is the same kind
  of work already done twice successfully, not new risk.
- **Option B (fallback if Day 8 regression reveals no schedule room):
  visually degrade gracefully instead of leaving raw token badges.** Reuse
  the closest existing production silhouette (e.g. `iron_swordsman` and
  `bronze_swordsman` temporarily point at `stone_axeman`'s melee frames
  with a palette-only recolor, `archer`/`musketeer` point at
  `stone_slinger`'s frames) so nothing reads as an obvious placeholder,
  and log this explicitly as scoped debt for after the jam. This is
  strictly worse art direction than Option A but costs a fraction of the
  time and removes the "different game entirely" jump in fidelity.

Either way, **do not ship the current `token-*` badges** — they are the
single biggest remaining threat to this rebuild's payoff, bigger than any
UI density or motion polish item still open.

## 2. Design-vs-implementation gap: the Civilization Wars-style tech tree
does not exist yet (informational — do not attempt to close this gap in
the remaining schedule)

`docs/dev-wiki/concept-pivot-lane-siege.md` section 6/6-1 describes a
~40-item research tree gating unit unlocks, upgrades, and age transitions.
In the running code, `research` is only one of six worker-allocation
categories (`gold`/`wood`/`food`/`metal`/`research`/`idle` in
`src/systems/lane-economy/laneEconomy.ts`) that accumulates a `research`
resource count with **no consumer** — nothing currently spends it on an
unlock, upgrade, or unit. Age transitions themselves are already gated by
whatever the "시대 업" button requires (worker/resource thresholds), not
by research.

This is a real gap between the design doc's ambition and the shipped game,
but it is **not** a system to build in the 4 remaining days of a 10-day
jam. Two honest options for the next session, in order of preference:

- Leave it as-is and let the game-intro/AI-usage documentation (contest
  submission items 2 and 4) describe research as "an economic sink with a
  planned tech-tree consumer, scoped out for the jam build" — this is a
  true statement and does not misrepresent the build.
- If Day 8-9 buffer genuinely has slack after regression passes clean, add
  a **minimal** WC2-scale tech tier instead of the concept doc's 40-item
  vision: 3-5 flat upgrades (e.g. "+10% melee attack," "+1 tower range,"
  "unlock `bronze_swordsman`") that the accumulated `research` resource can
  buy from a small panel. This is closer to how Warcraft II itself scoped
  upgrades (a handful of building-gated tech items, not dozens) than to
  the concept doc's Civilization Wars ambition, and it's a much smaller,
  safer unit of work.

Do not attempt the full 40-item tree — there isn't time, and a half-built
version would look worse than no tech tree at all.

## 3. WC2-flavor touches that do not fit this game's genre (documented so
nobody spends time on them later)

Warcraft II's other defining systems were checked against this project's
actual design (`concept-pivot-lane-siege.md`) and don't transfer:

- **Multi-unit selection and direct micromanagement**: WC2's big
  innovation over Warcraft I was selecting and commanding multiple units
  at once. This project's design is explicit that "플레이어는 병력을
  직접 낱개 조종하지 않음" (the player never directly pilots individual
  units) — the whole game is an auto-battler on a lane. There is nothing
  to add here; the auto-battle identity is the point, not a gap.
- **Fog of war over unexplored terrain**: WC2's fog hides enemy units/
  buildings once they leave sight while keeping explored terrain visible.
  This project has one fixed, fully-visible lane between two symmetric
  bases with no unexplored map area — there is no "unseen territory" for
  fog of war to hide. Forcing this system in would fight the genre, not
  strengthen it.

Do not add either system. If a future session proposes them, point back to
this section rather than re-litigating.

## 4. Cheap WC2-flavor win, optional if Day 8-9 buffer allows

Warcraft II's unit acknowledgment voice lines (a unit says something
different, and eventually annoyed, the more times it's clicked) were one
of its most-remembered small touches. `src/systems/audio/assetManifest.ts`
already has a clean pattern for adding scoped SFX
(`sfx("sfx.ui.hireSuccess", ...)` etc.) but no unit-acknowledgment category
exists at all today.

A minimal version that fits this game's auto-battle identity: a short,
synthesized "select/acknowledge" blip when the player clicks a capture
point, tower, or hires a unit — reusing the existing synth-fallback
pipeline (no real audio files needed, same as everything else in
`assetManifest.ts` today). This is small, optional, and should only be
picked up after section 1 (unit art coverage) and the Day 7 UI density
work are both done and verified — it is charm, not a blocker.

## Priority order for the next prompt

1. Section 1 (missing unit art) — before Day 8 regression starts, because
   Day 8's full regression pass should exercise every age, and right now
   that would surface this gap as a "regression" when it's actually a
   pre-existing scope hole from Day 3-4.
2. Continue `wc2-rebuild-plan.md` Day 8 (regression + buffer) as planned.
3. Section 2's minimal-tech-tier option and section 4's acknowledgment SFX
   are both optional stretch goals for Day 9 buffer only, and only if
   Day 8 finishes clean with time to spare.
4. Section 3's items are closed questions — do not revisit.
