# Warcrest Map Redesign Brief

Date: 2026-07-29
Status: second-cycle Day 1 design; runtime map data is unchanged in this step

## 1. Scope boundary

This is a map-content redesign, not a renderer rewrite. The following remain
unchanged and are reused:

- `BattlefieldMapSpec` as the runtime boundary and future adapter target.
- `battlefieldWorldRenderer.ts` and its depth/grounding behavior.
- 16-state marching-squares transitions and production terrain assets.
- Asset QA, unit/structure presentation, gameplay systems, and HUD.
- The structure socket rule: every pair differs by at least `0.15` progress,
  and a tower remains farther from its owning base than its linked capture
  point.

Day 2 may replace values in `battlefieldMaps.ts`: `LANE_PATH_NODES`,
`terrainPatches`, `structureSockets`, and `terrainProps`. It must not replace
the engine that consumes those values.

## 2. Current map audit

### 2.1 Lane geometry

`LANE_PATH_NODES` contains five nodes and therefore only four straight
segments. The segment headings are `-24.8deg`, `-28.0deg`, `-26.7deg`, and
`-35.0deg`; the three heading changes are only `3.2deg`, `1.3deg`, and
`8.3deg`. Across a total path length of about `5,408` world pixels, this reads
as one long diagonal rather than four spatially distinct areas.

All four generated patches use exactly eight rows at `96` world pixels each.
Every cross-section is the same two stone rows, two dirt rows, and four grass
rows. There is no width change, choke, staging basin, material landmark, or
clearing.

### 2.2 Structures

The map has four centerline sockets:

| Kind | Progress |
| --- | ---: |
| defense tower 1 | 0.200 |
| capture point 1 | 0.375 |
| defense tower 0 | 0.600 |
| capture point 0 | 0.767 |

The minimum-gap rule passes, but the sequence is mechanically alternating and
every footprint uses the same two perpendicular bypass slots. Terrain does not
visually announce why each battle location is different.

### 2.3 Props

Only six props occupy the `7000 x 3900` world: two boulders, one rock cluster,
one oak, one pine, and one fallen log. That is roughly one prop per `4.55`
million square world pixels. They are isolated samples rather than coherent
tree lines, rubble fields, boundaries, or landmarks. Every prop currently has
`blocksMovement: false`, so they frame the scene visually but do not create
gameplay navigation.

### 2.4 Confirmed problems

1. **The lane is effectively straight.** Its maximum heading event is only
   `8.3deg`, so camera travel reveals no new composition.
2. **The playable width and materials never change.** Uniform stone/dirt/grass
   stripes make every encounter read as the same repeated board section.
3. **Landmark density is too low.** Six isolated props cannot organize a large
   world into recognizable territories.
4. **Structure placement is legible but mechanical.** Four evenly sequenced
   centerline sockets lack distinct approach spaces and environmental context.
5. **There are no authored tactical beats.** The current data has no open
   staging area, visually compressed passage, central contest clearing, or
   alternate-feeling approach, even though unit bypass slots exist.

## 3. Reference principles

Official Blizzard retrospectives on Lost Temple describe maps as supporting
multiple strategies, accessible but varied expansions, contested central
resources, high-ground/funnel decisions, and fairness review rather than
perfect decorative symmetry. The classic Battle.net map archive also exposes
starting positions, resource locations, shortest paths, ramps, high ground,
and out-of-way resources as the information that defines a map.

Warcrest is a single-lane auto-battle strategy game, so these are adapted as
composition and pressure principles rather than copied mechanics:

- alternate broad deployment space with compressed conflict space;
- vary the distance and visual exposure before important structures;
- create recognizable landmarks around decision points;
- allow controlled visual asymmetry while preserving equivalent travel and
  structure rules;
- make the center a deliberate convergence scene, not merely the midpoint of a
  line.

Sources:

- [Blizzard: Map Spotlight - The Lost Temple](https://news.blizzard.com/en-us/article/20930558/map-spotlight-the-lost-temple)
- [Classic Battle.net: StarCraft Maps](https://classic.battle.net/scc/lp/)
- [Blizzard: Revisiting the Warcraft III Editor](https://news.blizzard.com/en-us/article/23395649/revisiting-the-warcraft-iii-editor)

No map layout or proprietary asset from these games is copied.

## 4. Proposed map: Three Fronts

> Update on July 30, 2026: this candidate remains available as an archived
> single-lane comparison map, but it was superseded as the production direction
> once the user approved the later two-lane redesign.

### 4.1 Lane form

Use a soft S-shaped lane with nine control nodes instead of five nearly
collinear nodes. Consecutive heading changes should generally stay between
`8deg` and `18deg` so marching-squares edges form broad curves rather than
stairs. The world keeps the current player-to-enemy diagonal progression and
overall travel time.

The lane is divided into five readable beats:

1. player deployment basin (`0.00-0.16`);
2. western framed passage (`0.16-0.34`);
3. central contest clearing (`0.34-0.66`);
4. eastern framed passage (`0.66-0.84`);
5. enemy deployment basin (`0.84-1.00`).

Open basins use 10 terrain rows, normal approaches use 8, and visually
compressed passages use 6. This is initially a visual-width change using map
patch data. It must not be described as a collision choke unless a later,
separately tested gameplay change connects terrain occupancy to movement.

### 4.2 Material distribution

- Grass is the continuous world base.
- Dirt follows worn approaches but varies from one to three cells in width.
- Stone concentrates at bases, structure foundations, the central clearing,
  and short fortified road sections; it no longer runs as an unbroken stripe
  across the entire lane.
- Marching-squares overlays blend every boundary. Patch overlap and variant
  seeds must avoid a visible seam at control nodes.
- Material changes announce gameplay beats: dirt entering a passage, broken
  stone around an old fortification, and a broad stone/dirt plaza at center.

### 4.3 Prop density and landmarks

Target `18-24` props, still using the approved production families:

- about 60% in perimeter clusters that frame the lane;
- about 25% in two or three recognizable landmark groups;
- about 15% isolated to break repetition.

Keep the gameplay envelope fair but not visually mirrored. For example, the
western passage may be framed by pines and a fallen log while the eastern
passage uses rocks and one oak cluster. Props must respect ground anchors,
shadows, and occlusion. `blocksMovement` remains false in the Day 2 visual
checkpoint.

### 4.4 Structures

Retain two capture points and two linked defense towers. A candidate progress
sequence is:

| Structure | Progress |
| --- | ---: |
| player-side capture | 0.17 |
| player-linked tower | 0.37 |
| enemy-linked tower | 0.64 |
| enemy-side capture | 0.84 |

Adjacent gaps are `0.20`, `0.27`, and `0.20`, so the `0.15` invariant holds.
Each tower is farther from its owning base than its linked capture point.
Final values must be checked by the existing invariant tests.

Sockets remain on the lane and keep bypass slots, but their surrounding
terrain differs:

- captures sit in wider plazas with visible approach space;
- towers sit at the exit of framed passages;
- center remains open enough that waves can join combat instead of forming a
  visual queue.

## 5. Day 2 partial-map checkpoint

Build only the player-side basin through the first passage (`0.00-0.34`) as a
switchable map-data candidate:

- three or four curved path segments;
- one width transition from 10 to 6 rows;
- grass/dirt/short-stone material event with marching-squares transitions;
- six to eight props arranged as one boundary cluster and one landmark;
- the player-side capture and linked tower positions validated against the
  minimum-gap rule.

The comparison uses the same camera scale and keeps unit, economy, capture,
tower, UI, and renderer behavior unchanged. Expansion to the full map waits
for human approval alongside the Day 2 unit and music checkpoints.
