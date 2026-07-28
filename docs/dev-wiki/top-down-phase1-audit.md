# Top-down Rebuild Phase 1 Audit

Date: 2026-07-28

Branch: `terrain-prototype-central`

Baseline commit: `56a6376`

## Scope

This is the frozen visual baseline for the approved full top-down rebuild in
`retro-rts-visual-methodology.md` section 4.5.1. It does not implement the new
terrain grammar. The only source change is a QA-only layer selector and a
deterministic two-unit combat probe used to capture the current state.

## Step 0 result

The suspected interrupted refactor was already completed as commit `56a6376`
(`feat: refine lane objectives and combat presentation`). The worktree contained
only concurrent documentation edits; no uncommitted source or artifact from
that refactor remained.

- `npm run build`: passed.
- `npm test`: 16 files, 69 tests passed.
- No repair or second cleanup commit was required.

## Projection finding

The Phaser camera is already an orthographic 2D camera. There is no perspective
matrix to remove. The remaining high-oblique impression comes from three other
sources:

1. `BattlefieldWorldRenderer` ignores the 368 logical terrain cells and renders
   each map patch as one rotated dirt band plus one rotated stone band.
2. Unit, tower, base, rock, and tree assets use mixed front/three-quarter viewing
   angles even though the ground is a flat orthographic surface.
3. The road runs bottom-left to upper-right, so the correct diagonal lane layout
   is still visually confused with the superseded diagonal camera direction.

The rebuild therefore needs a square-cell terrain renderer and projection-
matched object assets. Changing zoom or merely rotating the lane would not
implement option A.

## Frozen captures

All captures use seed `warcrest-top-down-phase1-before`, camera centre
`(4095, 1740)`, zoom `0.46`, and the current `world-surface` renderer.

- Ground only: `artifacts/top-down-phase1-audit/before-ground.png`
- Ground and props: `artifacts/top-down-phase1-audit/before-props.png`
- Ground, props, and units: `artifacts/top-down-phase1-audit/before-units.png`
- Combat sequence: `before-combat-01.png` through `before-combat-08.png`
- Runtime snapshots: `before-audit-snapshots.json`

## Terrain grammar audit

| Item | Current value | Finding |
|---|---|---|
| Logical patches | 4 | Data exists but is not rendered cell-by-cell |
| Logical cells | 368 | Rectangular cells, not a top-down square grid |
| Cell size | width `134.2..141.7`, height `96` | Variable non-square cells encode the old stretched lane |
| Segment angles | `-24.8`, `-28.0`, `-26.7`, `-35.0` degrees | Correct as a diagonal route, but bands hide grid grammar |
| Visible stone width | `302.4` world px | `3.15 * cellHeight`, not derived from terrain neighbours |
| Dirt band width | `595.2` world px | Rounded mask; no marching-squares boundary |
| Transition rule | none in renderer | Cell materials exist, but neighbour masks are not calculated |
| Surface detail | repeating tileSprite | No cell variant placement or edge/corner ownership |

## Grounding audit

| Object | Ground origin | Shadow | Foundation | Footprint / occlusion |
|---|---:|---|---|---|
| Rock cluster | `0.884` | `(4,2)`, `.92x/.50y`, `-0.08`, alpha `.30` | none | ellipse; movement off; occludes true |
| Tree cluster | `0.902` | `(7,3)`, `.84x/.52y`, `-0.10`, alpha `.34` | none | ellipse; movement off; occludes true |
| Watchtower | `0.8995` | `(6,2)`, `.90x/.54y`, `-0.08`, alpha `.34` | three runtime ellipses | `166x76`; movement off; bypass slots exist |
| Fixed fortress | no runtime instance | dormant asset/code only | none active | removed from current map |
| Main base | `0.84` | none | none | no footprint or occluder data |

The prop anchors are measured and usable, but shadow direction is almost a
contact AO rather than a readable shared top-down light. Main bases remain the
largest grounding gap.

## Animation audit

| Unit | Idle | Walk | Attack | Hit | Death | Timing status |
|---|---:|---:|---:|---:|---:|---|
| Stone slinger | 1 | 2 | 1 | 0 | 0 | release/impact split exists |
| Stone axeman | 1 | 2 | 3 | 0 | 0 | wind-up/contact/recover; contact at about 240 ms |
| Supply wagon | 1 | 2 | 1 | 0 | 0 | support cast timing exists |
| Bronze spearman | 1 | 2 | 2 | 0 | 0 | wind-up/contact only |
| Other age units | 1 placeholder | 0 | 0 | 0 | 0 | outside shared animation registry |

The shared registry and role motion helper are valid foundations. The principal
remaining problem is asset projection and missing state coverage, not the
absence of a state-machine extension point. The approved provisional facing
scope remains left/right sprites through `flipX`, plus short attack rotation.

## Phase 2 decision options

The following are user checkpoints and must be confirmed before implementation.

### Road width and material contrast

- **A. Compact**: 3 stone cells plus one dirt shoulder per side. Clearest small
  skirmish field, but risks returning to the previously rejected narrow lane.
- **B. Medium (recommended)**: 4 stone cells plus one dirt shoulder per side on
  a `96x96` grid. About the current total corridor width, but with a wider
  readable combat surface.
- **C. Wide**: 5 stone cells plus one or two dirt shoulders per side. Supports
  large formations but reduces strategic obstruction and increases empty area.

Recommended contrast is a medium separation: stone clearly lighter and less
saturated than dirt, dirt warmer than grass, without the arcade-bright borders
of a strong-contrast preset.

### Shadow direction and strength

- **A. Contact AO only**: least visual noise, weakest height/readability.
- **B. Contact AO plus short southeast shadow (recommended)**: common direction,
  alpha around `.24..30`, enough to explain height without long silhouettes.
- **C. Strong Warcraft-II-like shadow**: clearest units, but may look stamped on
  the current semi-realistic assets.

### Melee exaggeration

- **A. Restrained**: preserve current body shift; relies mostly on authored pose.
- **B. Readable (recommended)**: contact silhouette expands roughly 15-20% of
  unit width with a short 8-10% body advance, then immediate recovery.
- **C. Heavy**: large arc/lunge and stronger hit-stop; clearer but more arcade-like.

### Music direction

- **A. Martial-tragic orchestral (recommended)**: low brass/strings, restrained
  march pulse, escalating battle layers.
- **B. Stone-age tribal**: skin drums, wood/stone percussion, sparse drone.
- **C. Atmospheric strategy**: lower intensity and fewer rhythmic layers.

### Facing scope

- **A. Left/right plus attack micro-rotation (recommended provisional scope)**.
- **B. Four directions** for wider formations around sockets.

Eight-direction production is explicitly out of scope for this rebuild.

## Phase status

- Phase 0: complete, option A confirmed before this session.
- Phase 1: complete; captures, tables, and deterministic QA probe exist.
- Phase 2-5: not started. Work stops here because section 10 requires the user
  checkpoints above before their visual values are fixed.
