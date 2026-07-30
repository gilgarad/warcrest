# Ver1 Upgrade Plan (고도화 ver1)

Written 2026-07-30 by the consulting session (`stock_predict_rev` harness,
`game_project1`-only scope, source unmodified) after the user tagged commit
`5ca9a82` as `ver1` — a feature-complete first playable baseline (map, unit
art, audio, core loop all landed) — and asked for the next phase to be a
deliberate deepening/upgrade pass, not more baseline features. This document
is the planning record for that pass; do not start implementation prompts
until the user confirms each item below.

## Why this document exists

The user's initial feedback (4 points) was phrased in abstract, subjective
terms ("자연스럽지 않다", "3D스러운 느낌"). Per the user's own instruction,
each point below was investigated against the actual code/docs/reference
screenshots before being treated as a task, so the reasoning is inspectable
and correctable rather than acted on blind.

## 1. Terrain/tile naturalness (배경 화면 타일 자연스러움)

- **Track**: 맵 및 게임 전반 (owns `terrain-rendering-plan.md` and the
  hybrid terrain renderer).
- **Root cause (confirmed in docs)**: the current renderer is a deliberate
  hybrid — a painted matte background for the far view, plus structured
  tiles/decals only in the actively playable strip
  (`docs/dev-wiki/terrain-rendering-plan.md` option B). The same document
  already names the exact risk the user is seeing: "배경과 타일 경계의
  색/해상도 연결 작업 필요," "타일 반복과 외곽 seam." This is a known,
  documented seam-quality gap in the chosen approach, not a bug.
- **Direction**: tighten the seam blending between the matte background and
  the structured tile strip (color/resolution matching at the boundary),
  and re-check whether the hybrid tiling has actually been extended across
  the full lane or still reads stronger near the center capture point.
  Needs a screenshot pass across multiple lane positions before scoping the
  actual fix.
- **Open question for user**: none blocking — ready for a research/fix
  prompt once screenshots pinpoint the worst offending lane segment.

## 2. Camera/unit angle ("하늘에서 비스듬히" feel)

- **Track**: 그래픽/캐릭터 (unit/prop/structure art), terrain camera itself
  stays with 맵 및 게임 전반 but is *not* the thing changing here.
- **Root cause (confirmed against user's WC2 reference screenshots)**:
  `docs/dev-wiki/style-guide.md` already specifies the intended contract —
  *"Terrain uses a strict orthographic top-down square grid. Units, props,
  and structures use a weak 3/4 top-down view."* Comparing the reference
  screenshots to this game: the ground plane in both matches (flat,
  near-vertical top-down grid — correct, keep as-is). The gap is that WC2's
  buildings show visible front facades (not just roofs) and units show
  visible body/weapon orientation at an oblique angle, while this game's
  current unit/structure art reads flatter/more profile-like than the
  reference. **This is not a reversal of the 2026-07-28 top-down decision —
  that decision was about the terrain grid and is confirmed still correct.
  It's under-delivery on the "weak 3/4" half of the same, already-written
  spec.**
- **Direction**: increase the apparent obliqueness baked into unit,
  building, and prop sprite art (more visible front/side surface, not a
  literal camera tilt) until it matches the reference screenshots' feel.
  Terrain grid rendering is explicitly out of scope for this item.
- **Open question for user**: none blocking, direction confirmed in this
  conversation — ready for a prompt once graphics track has time.

## 3. Camera zoom / scale ratio (줌인 너무 심함)

- **Track**: 맵 및 게임 전반 (`FIELD_CAMERA_ZOOM` in `LaneBattleScene.ts`).
- **Root cause (measured, not yet visually cross-checked)**: unit sprite
  canvas is `384x384` world px; viewport is `1600x900`; current
  `FIELD_CAMERA_ZOOM = 0.46`. On screen a unit renders at roughly `176px`,
  about 11% of viewport width. WC2's reference screenshots show units and
  buildings occupying a visibly smaller fraction of a much busier, more
  populated battlefield view. The raw numbers are consistent with "zoomed
  in too far," but the exact target ratio hasn't been confirmed against a
  side-by-side screenshot comparison yet.
- **Direction**: pull `FIELD_CAMERA_ZOOM` out (lower value) and/or shrink
  effective unit canvas display size, then compare a same-scene screenshot
  against the WC2 reference images the user provided, iterating until the
  relative unit-to-battlefield size feels comparable.
- **Open question for user**: none blocking — this is a measurable,
  iterate-by-screenshot task once graphics/camera changes for item 2 are
  in so both aren't being tuned against each other blind.

## 4. Combat SFX variety + attack/hit vocalizations

- **Track**: 음악/오디오.
- **Root cause (confirmed in `src/systems/audio/assetManifest.ts`)**:
  - `sfx.combat.meleeAttack` / `meleeHit` both use the same `"blade"` synth
    kind for every melee weapon type (sword, axe, spear, knight all sound
    identical).
  - `sfx.combat.rangedFire` / `projectileHit` both use one `"pluck"`/
    `"impact"` pair regardless of projectile type (bow arrow and slung
    stone sound identical).
  - `sfx.combat.unitHit` / `unitDeath` use a single generic `"grunt"` for
    every unit — this is a hit-*reaction* sound only. **No attack-effort
    vocalization ("히얏!" style kiai) exists at all.**
- **Direction**: split melee/ranged attack SFX by weapon family (at least:
  blade/slash, blunt/axe-impact, bow-twang, sling/thrown-stone), and add a
  new attack-effort vocal layer distinct from the existing hit-reaction
  grunt. Reuse the existing synth-fallback pattern; no real audio assets
  needed unless the audio session confirms a generation tool is available.
- **Implemented (2026-07-30)**:
  - Weapon-family split landed as `slash`, `blunt`, `bow`, `thrown`, plus a
    separate `shot` family for `musketeer`.
  - `LaneBattleScene.ts` now branches combat attack/hit playback by unit
    family instead of using one generic melee/ranged pair.
  - A new `sfx.combat.attackShout` grunt layer was added for attack-start
    effort vocalization, throttled by both asset cooldown and scene-level
    probability/min-interval gating so it does not fire on every swing.
- **Open question for user**: none blocking — complete for the current pass.

## Sequencing recommendation

Items 2 and 3 both affect on-screen unit scale/angle and will visually
interact, so do them in this order to avoid tuning one against a moving
target:

1. Item 2 (그래픽/캐릭터: unit/structure obliqueness) first.
2. Item 3 (맵 및 게임 전반: camera zoom) second, screenshot-compared against
   the result of item 2.
3. Item 1 (맵 및 게임 전반: terrain seam) and item 4 (음악/오디오: combat
   SFX) are independent of the above and of each other — can run in
   parallel on their own tracks at any time.

## Status

Items 1-4 all have user-confirmed direction as of 2026-07-30. Item 4
(combat SFX variety + attack vocalizations) is now implemented on the audio
track. Remaining next steps are the visual/map items and any later polish
follow-up after user listening feedback.
