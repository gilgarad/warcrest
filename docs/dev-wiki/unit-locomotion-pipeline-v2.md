# Unit Locomotion Pipeline v2

Written 2026-08-06 by the consulting session (`stock_predict_rev` harness,
`game_project1`-only scope, source unmodified) after the user reported that
the same walk-cycle/leg-crossing problem has persisted across multiple
correction attempts over several days, and asked for a from-scratch
architectural decision rather than another incremental patch. This document
records the diagnosis and the decisions made for each of the user's 14
requirements before any prompt was written, per the user's own instruction
to reason visibly and let them correct it.

## Why the previous attempts kept failing (root causes, confirmed in code)

1. **`walk-b` was never real art.** `tools/asset-qa/generate_pose_board_production_assets.py`
   generates the "passing/leg-crossing" frame by geometrically transforming
   a *different* existing pose — `synth_walk_b()` just rotates the source
   image 3 degrees; `synth_walk_b_shift()` shifts it a few pixels and
   squeezes it 0.985x horizontally. Neither can ever produce a genuine
   crossed-leg silhouette, because both operate on one flat source image as
   a single rigid shape. This explains the "some rows look fine, some don't"
   pattern the user observed: units whose *source* pose happened to have
   asymmetric leg spacing look passable after the transform; units with a
   symmetric stance never will, no matter how the transform is tuned. Every
   previous "fix" adjusted the rotation/shift parameters — never replaced
   the fake generation with real distinct art. This is why the same
   complaint kept recurring.
2. **Sandbox and the real game do not share a walk function.** The user's
   assumption (point 12) — "same function, same numbers, sandbox is just
   the character alone" — is not currently true.
   `LaneBattleScene.ts` uses `resolveWalkMotion()` (per-step vertical
   bob + lateral sway + slight rotation, tuned in `combatPresentation.ts`).
   `UnitSandboxScene.ts` uses its own inline
   `Math.abs(Math.sin(phase * Math.PI * 2)) * 5` bob and never imports
   `resolveWalkMotion`. They already drift from each other today, so a
   sandbox preview passing does not guarantee the real game will look the
   same, contrary to what's been assumed while iterating.
3. **Frame budget was too low to show a real gait.** The current contract is
   `idle, walk-a, walk-b, walk-c, attack` — a 3-frame walk cycle. A 3-frame
   cycle can show two contact poses and one passing pose at best; it cannot
   show a smooth crossing motion, which needs more in-between coverage. The
   user is asking for a 10-frame cycle, which is a reasonable, standard
   density for a readable walk (most classic 2D walk cycles use 8-16
   frames).
4. **Multi-character sheets as the generation unit.** The screenshots
   reviewed in this conversation (5 characters x 5 poses per image) show
   generation is happening in a **shared sheet containing multiple
   characters**. Regenerating or fixing one character then requires editing
   or discarding a sheet that other, already-approved characters also live
   in — exactly the fragility the user flagged in point 14.

## Decisions (made now, per the user's request that this session decide)

### Camera / angle contract (points 0, 3, 4, 8, 10)

- Confirmed as-is: side-on-with-downward-tilt "weak 3/4" camera, already
  locked via the `bronze-spearman-s-idle.png` reference approved earlier
  this cycle. This document does not reopen that decision — it only adds
  the *locomotion* frames on top of it.
- **Canonical facing = east (right), weapon in the character's right
  hand/shoulder, facing camera-right.** Every unit's *authored* source art
  is built facing this way. This becomes the single reference direction for
  every unit, matching point 4 exactly.
- Diagonal directions keep the already-decided rule (point 8): camera never
  moves, the character's body rotates. Moving away (north) shows the back;
  a diagonal-away (northeast) shows back+shoulder in partial profile. This
  is already how the original 10-unit roster's 8-direction art works
  (`style-guide.md` 1.1) — extend the same discipline to the new roster
  instead of inventing a new one.

### Mirroring (point 9)

- **Decision: use the runtime's existing `legacy-mirrored` direction mode**
  (`shouldMirrorDirection`/`resolveAuthoredDirection` in
  `unitAnimationRegistry.ts`) for the new (modern-era) roster, not the
  "independently author all 8 directions" rule the *original 10 ancient
  units* used.
  - Author **5 directions per unit**: `n`, `s`, `e`, `ne`, `se` (all facing
    right-of-center per the canonical facing above).
  - Runtime mirrors `e -> w`, `ne -> nw`, `se -> sw` automatically (already
    implemented, already used elsewhere — this is not new code, just
    consistent application).
  - **Known tradeoff, accepted knowingly**: mirroring flips handedness —
    a rifle held at the right shoulder will appear at the left shoulder
    when mirrored to face west. This was exactly why the original 10-unit
    roster rejected mirroring. For the new roster this is accepted as a
    deliberate scope/production-time tradeoff given the roster size (29+
    units), not an oversight. If any single unit's mirrored asymmetry looks
    wrong enough to bother the user later, that one unit can be pulled out
    to full 8-direction authoring as an exception — but it is not the
    default.

### Frame count and gait structure (points 1, 2, 13)

- **Decision: 10 evenly spaced phase frames per authored direction**,
  replacing the current `walk-a/walk-b/walk-c` contract with
  `walk-01` through `walk-10` (phase `0.0, 0.1, ... 0.9` of one full gait
  cycle). This is a breaking change to `UnitLocomotionPose` and the
  production file-naming contract — scope it explicitly as v2, not a patch
  to v1's 3-frame poses.
- **Human bipeds**: standard walk-cycle key poses distributed across the 10
  frames — two full **contact** poses (legs maximally apart, one foot just
  landing) and two full **passing** poses (legs crossed/overlapping, the
  single moment of a walk cycle where the swinging leg passes the planted
  leg) are the four structural anchors; the remaining six frames are the
  up/down recoil-and-lift transitions between those anchors. The two
  passing frames are the ones that must show unambiguous leg overlap — this
  is the exact frame type `synth_walk_b` could never produce.
- **Quadrupeds (horses, point 2)**: same 10-frame budget, but gait
  structure follows an actual walk/trot pattern — **front legs cross each
  other's stride independently from the back legs** (a horse's front-left
  and front-right alternate on their own phase relationship to
  back-left/back-right; they are not a mirrored pair of the human 2-leg
  cycle). Do not reuse the human 10-frame key-pose timing for horses;
  derive a separate 10-frame breakdown for the front-leg pair and back-leg
  pair so both pairs individually show a clear alternating/crossing
  stride.
- **Vehicles (tanks, artillery, wagons)**: no leg-crossing concept applies.
  10-frame budget still applies for wheel/track rotation continuity (so
  motion reads smoothly), but the per-frame content is wheel/track rotation
  angle, not a gait.

### Vehicle-specific artifact policy (point 5)

- Explicit negative constraint for the QA checklist (see below): wheels,
  tracks, and gun barrels must render as clean, recognizable geometry at
  every frame. No dust/sandstorm/motion-smear effect is permitted to
  substitute for drawing the actual wheel/track — if the generation step
  produces one, it is a defect, not a stylistic choice, and must be
  regenerated.

### Size consistency (point 6)

- Establish three separate size classes, each internally consistent:
  **human-scale** (all infantry regardless of era/weapon), **horse-scale**
  (cavalry), **vehicle-scale** (artillery/tank/wagon) — each with its own
  canvas/visible-height contract, same discipline the original roster
  already used (`style-guide.md`'s canvas/anchor/visible-height metrics).
  Do not let each new unit re-derive its own scale; measure against the
  class's locked reference the same way the angle reference is locked.

### Sandbox/game parity (point 12)

- **Decision: eliminate `UnitSandboxScene.ts`'s separate bob calculation.**
  Import and call the same `resolveWalkMotion()` (or its v2, 10-frame-aware
  successor) that `LaneBattleScene.ts` uses, with the same input parameters
  (`walkCycleProgress`, facing). Sandbox stays visually simpler only in
  that it has no background/opponents/combat state — the unit's own motion
  math must be the literal same function call, not a re-implementation.
  This closes the actual gap found in this session, not just the
  gap the user assumed already existed.

### One file per character (point 14)

- **Decision: generation must be scoped to one character per source file/
  generation batch**, even though a combined contact-sheet is still useful
  as a *review* artifact afterward. Any tool or prompt step that currently
  asks for "N characters in one image" should be split into N separate
  single-character generation calls, then optionally composited into a
  review sheet as a derived/throwaway artifact — never as the source of
  truth that later edits touch directly.

## QA checklist (point 11) — write this before generating, apply per frame

Human/quadruped:
- [ ] No clipped knees, feet, head, or weapon tip at the canvas edge
- [ ] Silhouette height/proportion consistent with the unit's size class
- [ ] Weapon muzzle/blade orientation consistent across all frames of the
      same direction (does not visually rotate frame-to-frame by accident)
- [ ] The two designated "passing" frames show unambiguous leg overlap
      (human) or correct front/back independent crossing (horse)
- [ ] Gait reads as smooth across all 10 frames in sequence, not jerky or
      teleporting
- [ ] Facing direction, weapon-hand side, and travel direction all agree
      (point 3) — a unit facing east must be stepping toward east, not
      sideways relative to its own facing

Vehicle:
- [ ] Wheels/tracks/barrel fully visible, no part cropped off-canvas
- [ ] No dust/smear/sandstorm artifact substituting for real geometry
- [ ] Size consistent across all vehicle-class units
- [ ] No part of the sprite blends into a same-color background making the
      silhouette unreadable (check against both light and dark backdrops)

All frames:
- [ ] Camera angle matches the locked reference (`bronze-spearman-s-idle.png`
      convention) — not flatter, not steeper
- [ ] Background fully transparent, no matte-color fringe at edges

## Status

All 14 points have a decision recorded above. Next: one detailed
implementation prompt for the 그래픽/캐릭터 track, gated the same way as
the earlier angle-correction work (one unit, full pipeline, user review,
then batch expand) — not a repeat of the "-fix all units in parallel and
hope" pattern that caused this multi-day loop.
