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

  **Canonical per-frame table (2026-08-06, user-authored, mandatory —
  supersedes any looser paraphrase of the above)**. Call the leg that
  starts in front "Leg A" and the other "Leg B". This covers exactly two
  full steps (one for each leg) in 10 frames, looping cleanly back to
  frame 1:

  | Frame | Leg A (starts front) | Leg A angle* | Leg B (starts back) | Leg B angle* |
  | --- | --- | --- | --- | --- |
  | 1 | just stepped slightly forward from center | ~+15° | trailing behind | ~-10° |
  | 2 | extends further forward (bigger stride than 1) | ~+30° | still trailing | ~-15° |
  | 3 | heel touches down — full forward contact (no ground drawn, just the pose) | ~+45° (max) | still trailing, max back | ~-20° (max) |
  | 4 | holds forward contact, weight rolling onto it | ~+40° | begins swinging forward, knee bending, foot lifting | ~-10° |
  | 5 | starts becoming the trailing leg as weight shifts off it | ~+30° | mid-swing, knee bent, nearly under the body | ~0° |
  | 6 | now clearly the trailing leg | ~+10° | swings past Leg A, now slightly ahead — passing complete, roles swapped | ~+15° |
  | 7 | trailing, moving further back | ~-10° | extends further forward (bigger stride than 6) | ~+30° |
  | 8 | trailing, max back | ~-20° (max) | heel touches down — full forward contact, max forward | ~+45° (max) |
  | 9 | begins swinging forward, knee bending, foot lifting | ~-10° | holds forward contact, weight rolling onto it | ~+40° |
  | 10 | mid-swing, knee bent, nearly under the body — approaching the next crossing point | ~0° | starts becoming the trailing leg as weight shifts off it | ~+30° |

  *Angle = approximate leg swing angle from vertical at the hip, `+` =
  forward of the body, `-` = behind the body. These are directional
  guidance, not exact degrees to enforce pixel-perfect — the point is
  every single frame must be visibly, unambiguously different from its
  neighbors, especially frames 5 and 6 (the crossing point), which
  previous generation attempts rendered as near-identical because the
  instruction only said "legs close/crossing" without a concrete angle
  delta.

  Frame 10 -> frame 1 (wraparound) is the second crossing: Leg A swings
  past Leg B the same way Leg B passed Leg A between frames 5 and 6. This
  second crossing is implied by the loop, not drawn as its own numbered
  frame — do not insert an extra frame for it, the 10-frame budget already
  accounts for it via the wraparound.

  **Leg-identity chain rule (mandatory, added 2026-08-06 after a
  generation attempt violated it)**: once a leg starts swinging forward
  (e.g. Leg B from frame 4 through frame 8), it must keep swinging forward
  monotonically across every one of those frames — it must never reverse
  and show the *other* leg swinging forward again until its own swing
  phase is properly finished and passed. A generated set where, say,
  frame 7 shows Leg B mid-swing and frame 8 suddenly shows Leg A swinging
  forward again instead of Leg B completing its contact, is wrong — that
  is a leg-identity reversal bug, not a valid alternate pose. Before
  accepting a generated set, trace each leg's angle column top to bottom
  and confirm it changes monotonically within each half-cycle (frames
  1-3 Leg A rises then holds, 4-8 Leg B rises/holds/Leg A falls, 9-10 Leg A
  begins rising again) — any non-monotonic jump back is a defect.

  Quantitative check for any generated set: measure foot-region alpha-bbox
  width (stride width) per frame. It must show **two clear maxima**
  (frames ~3 and ~8, full contact) and **two clear minima** (frames ~5-6
  and the 10->1 wraparound, crossing) — not a flat plateau followed by a
  sudden narrow tail, which is what `synth_walk_b`-era and the first v2
  attempt both produced.

  **Fallback: 3-frame contract (2026-08-06, user-authored, supersedes the
  abandoned 5-frame ping-pong experiment)**. The 10-frame and 5-frame
  variants both kept failing the same "same leg still leads" defect.
  For the current rifleman pilot, authored walk frames are reduced to
  **3**:

  | Slot | Content |
  | --- | --- |
  | walk-01 | right foot forward, left foot back |
  | walk-02 | neutral middle pose, feet near center |
  | walk-03 | left foot forward, right foot back |

  **Playback sequence** (repeats): `01, 02, 03, 02`.

  The acceptance rule is stricter than before: `walk-01` and `walk-03`
  must not only differ in silhouette, they must invert left/right foot mass
  in the lower-foot region. If `walk-01` is right-heavy, `walk-03` must be
  left-heavy, and vice versa.
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

All 14 points have a decision recorded above.

### Active contract override (2026-08-06)

The user replaced the earlier 8-direction/10-frame rollout decisions with a
simpler global production contract. The earlier sections remain as design
history and dormant implementation context, but no longer govern active
presentation:

- Every newly regenerated unit authors canonical east-facing source art only.
- West-facing presentation mirrors the east frame at runtime.
- `N/NE/SE/S/SW/NW` definitions, assets, and supporting code remain in the
  repository, but game and sandbox lookup are disconnected from them.
- A unit moving only north or south preserves its most recent E/W facing.
- Each unit uses three authored walk frames plus separate idle and attack
  frames. Walk playback loops `01, 02, 03, 02`.
- The 2026-08-06 roster expansion applies this contract to every standing
  biped infantry entry, not merely generator rows tagged `board == "human"`.
  The 21 regenerated entries span ancient infantry through modern infantry;
  cavalry, artillery/vehicles, and the evolving supply unit remain separate
  locomotion classes.
- Each regenerated biped keeps an uncut five-slot source strip and a marked-leg
  diagnostic strip. Production crops are generated only after the diagnostic
  tracks the same near anatomical leg in red and the same far anatomical leg
  in blue across both stride slots. Slot 2 must place red forward and blue
  back; slot 4 must place the same red leg back and the same blue leg forward.
  Independent per-frame coloring of whichever leg leads is explicitly invalid.
- Runtime registration for those 21 entries is canonical E only, mirrored for
  W, with `walk-01, walk-02, walk-03, walk-02` playback.
- Visual identity is now part of the source-strip gate. The installer records
  each roster entry's expected equipment, while
  `artifacts/human-3frame-v2/visual-mapping-audit.md` records the checked game
  label and observed art. This prevents a valid locomotion strip from passing
  when it depicts the wrong class, such as a rifleman under `pikeman`.
- Attack extraction no longer assumes the fifth pose stays inside a fixed 20%
  slot. It reads an expanded region and selects the rightmost substantial
  connected figure. If the uncut strip itself lacks safe outer-canvas room, a
  standalone `<prefix>-e-attack-source.png` override is required and must keep
  at least 32 pixels of foreground margin on every side.
- Team markers are clipped to opaque sprite pixels. Wide attacks therefore
  cannot place a detached marker in empty space when their weapon changes the
  overall alpha bounding box.

Rifleman gate update:

- The regular rifleman E-facing idle, three walk frames, and attack were
  approved in sandbox.
- Runtime and generator authored directions are now E only for this unit.
- Stale regular-rifleman directions and walk-04..10 production files were
  removed. `rifleman-late` remains a distinct untouched asset family.
- Next gate is user approval of the current `human`-board standing-infantry
  list before one pilot unit is regenerated.

2026-08-06 update:
- Runtime/code migration started for the first v2 pilot unit, `rifleman`.
- `UnitLocomotionPose`/file naming moved to `idle | walk-01 ... walk-10 |
  attack`.
- Synthetic walk generation was removed from
  `generate_pose_board_production_assets.py`; v2 walk frames now have to be
  authored source cells.
- `UnitSandboxScene` now imports the same walk-motion resolver as
  `LaneBattleScene` instead of running its own sine-bob approximation.
- `rifleman` now uses 5 authored directions (`n / ne / e / se / s`) plus
  runtime mirroring for `nw / w / sw`.
- Approved corrective pass:
  - `rifleman-n-idle` was replaced with an actual rear-facing north view
  - `rifleman-ne-idle` was replaced with a true between-`n`/`e` away-angle
    view
  - `rifleman-n` and `rifleman-ne` `walk-01..10` plus `attack` were then
    regenerated from those approved angles
  - `remove_background()` gained a despill step and rifleman's 5 authored
    directions were regenerated through the updated pipeline
- Stage-1 cleanup/proof step completed for `rifleman`:
  - dead directionless runtime-unused duplicates were removed
  - generator alias emission for `rifleman` / `rifleman-late` was disabled
    so those files are not recreated
  - `rifleman_late` was aligned to the same v2 10-frame mirrored contract
  - sandbox and `LaneBattleScene` were compared at the same walk phase
    (`e/w`, phase `0.55`, `walk-06`) and matched on texture key, mirrored
    state, and facing direction
  - a runtime bug found during parity work was fixed:
    `LaneBattleScene.create()` now initializes team state before calling
    `syncGameplayMusicTheme()`
- Gate status:
  - rifleman stage-1 is complete and ready for user approval
  - expansion to any other unit remains blocked until that approval is given

2026-08-06 fallback update:
- The east-facing rifleman walk pilot now uses the documented 3-frame
  fallback contract.
- Implemented runtime playback array:
  `walk-01, walk-02, walk-03, walk-02`.
- Automated validation under `tools/asset-qa/validate_rifleman_pingpong.py`
  now checks:
  - `walk-01 > walk-02` foot width
  - `walk-03 > walk-02` foot width
  - silhouette MAD(`walk-01`, `walk-03`)
  - left/right foot-mass inversion between `walk-01` and `walk-03`
- Current east pilot source strip:
  `docs/dev-wiki/visual-drafts/rifleman-e-3frame-strip-2026-08-06-attempt-1.png`
- Accepted metrics:
  - widths = `182, 79, 182`
  - foot masses:
    - `walk-01` = `595814 / 623849`
    - `walk-03` = `623849 / 595814`
  - silhouette MAD = `70.29`
- Scope remains gated:
  - no expansion to other rifleman directions
  - no expansion to other units
  - no sandbox-final signoff yet

## Final simplification: 3-frame ping-pong (2026-08-06)

Both the 10-frame and 5-frame contracts above failed repeatedly at the
same root cause: the image generation tool could not reliably swap which
leg leads when asked to produce multiple frames of the same character in
one pass or across separately-prompted frames. An external specialist
tool (aetherforgeai) was also tried for a pure camera-angle/facing fix and
judged too time-consuming to learn under deadline pressure.

**Adopted final contract**: 3 frames only, idle/attack untouched.

| Slot | Content |
| --- | --- |
| walk-01 | right leg forward, crossed stride |
| walk-02 | neutral — both feet close together under the body |
| walk-03 | left leg forward, crossed stride (must be the opposite leg from walk-01) |

Playback (repeats): `01, 02, 03, 02` then loop to `01`. Implemented via
`walkPoses: ["walk-01","walk-02","walk-03","walk-02"]` in
`directionalProductionAnimation()`, same mechanism as the earlier 5-frame
plan — no new rendering logic needed, only 3 files per direction.

This supersedes the 10-frame and 5-frame contracts above for now. A generated
set is accepted only through a continuous anatomical identity chain: the same
near leg is marked red and the same far leg blue in both stride frames, then
their screen positions must exchange. The previous diagnostic independently
colored each frame's apparent lead leg and therefore produced false positives.
After the identity-chain strip passes automated centroid checks, diagnostic
colors are removed without changing the verified poses and the clean strip is
split into production assets.

### Long-weapon canvas exception (2026-08-07)

Standing bipeds still target a 270px visible person height. A weapon that
extends substantially beyond that body must not participate in body-scale
normalization. Pikeman locomotion therefore uses a 384x512 transparent canvas
and pikeman attack uses a 1024x384 transparent canvas. Runtime presentation
records each canvas aspect and visible-body ratio explicitly, preserving the
same soldier scale while retaining the complete pike.

Long-weapon attack frames also record the person's foot-center `originX`; the
canvas midpoint is not a valid body anchor when most of the width is weapon.
Frame canvas dimensions are applied immediately rather than interpolated,
because independently lerping width and height across unlike canvas aspects
temporarily deforms the character. Position/attack-motion easing remains
independent. Ground shadows and selection rings always use idle body width.
