# Two-Lane Map Topology Brief

Date: 2026-07-29
Status: design checkpoint only; no runtime schema or map data changes in this step

## 1. Goal

Replace the current single diagonal lane with a two-lane battlefield:

- player base on the left;
- enemy base on the right;
- one northern lane and one southern lane between them;
- the two lanes spread apart through the middle and rejoin near each base,
  reading as a shallow oval / rounded rectangle rather than a straight slash.

This step is a schema and map-data design checkpoint only. It does **not**
replace the current production map yet.

## 2. Current constraint: why the existing schema cannot express this cleanly

`BattlefieldMapSpec` currently assumes exactly one playable lane:

- `lanePath: LanePathNodeSpec[]` is singular.
- `StructureSocketSpec.progress` is a single normalized progress over that one
  path.
- Capture points and defense towers are inferred against that single scalar
  progress.
- Helper functions such as `getLanePositionAtProgress()` assume one path and
  one interpolation space.

This is sufficient for the current diagonal map, but it breaks down for a
two-lane topology because the same progress value cannot distinguish:

- north lane `0.35` vs south lane `0.35`;
- a socket attached to the north lane vs one attached to the south lane;
- per-lane terrain width changes and prop composition.

## 3. Proposed schema change

### 3.1 Core direction

Keep the renderer and terrain grammar. Change only the runtime map **data
shape** so it can hold multiple authored lanes.

Recommended direction:

```ts
interface BattlefieldLaneSpec {
  id: string;
  path: LanePathNodeSpec[];
  role: "north" | "south" | "center" | "custom";
}

interface LaneSocketProgressRef {
  laneId: string;
  progress: number;
}

interface StructureSocketSpec {
  id: string;
  kind: "capture-point" | "defense-tower" | "base";
  laneRef: LaneSocketProgressRef;
  position: WorldPointSpec;
  footprint: StructureFootprintSpec;
  bypassSlots: WorldPointSpec[];
  teamOwner?: "player" | "enemy" | "neutral";
  linkedSocketId?: string;
}

interface TerrainPatchSpec {
  id: string;
  laneId?: string;
  center: WorldPointSpec;
  rotationRad: number;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  cells: TerrainCellSpec[];
}

interface TerrainPropSpec {
  id: string;
  laneId?: string;
  ...
}

interface BattlefieldMapSpec {
  schemaVersion: 2;
  id: string;
  lanes: BattlefieldLaneSpec[];
  terrainPatches: TerrainPatchSpec[];
  structureSockets: StructureSocketSpec[];
  terrainProps: TerrainPropSpec[];
}
```

### 3.2 Why this shape

- `lanes[]` removes the one-lane ceiling without hard-coding lane count.
- `laneRef` gives every socket a stable `laneId + progress` address.
- Cached `position` still lets the renderer and gameplay consume sockets
  without recomputing every frame.
- `linkedSocketId` is more robust than positional inference when more than one
  lane exists.
- `laneId` on patches and props is optional so shared plazas / base courtyards
  can span both lanes without artificial duplication.

### 3.3 Recommended lane-count rule

- Immediate target: `2` lanes.
- Schema capacity: arbitrary `n >= 1`.
- Practical guidance for now: author and validate up to `4` lanes without
  redesigning the schema again.

That keeps the 2-player implementation simple now while not blocking later
3-player / 4-player authored maps.

## 4. Coordinate draft for the first two-lane map

These are **draft authoring anchors**, not final numbers:

- Player base court: around `x 900-1200`, `y 1900-2050`
- Enemy base court: around `x 5850-6150`, `y 1900-2050`
- North lane travel band: mostly `y 1050-1450`
- South lane travel band: mostly `y 2450-2850`

### 4.1 North lane draft

- Start near player base at `(1180, 1600)`
- Rise into a shallow northern bend
- Mid-lane choke around `(3550, 1280)`
- Exit toward enemy base near `(5840, 1500)`

### 4.2 South lane draft

- Start near player base at `(1180, 2320)`
- Drop into a broader southern arc
- Mid-lane fight pocket around `(3520, 2660)`
- Exit toward enemy base near `(5840, 2400)`

### 4.3 Readability goals

- Lanes must feel separate enough that players can tell at a glance which
  fight belongs to which route.
- The center should not collapse into one overlapping mass of props and
  sockets.
- The two lanes should still read as one battlefield, not two unrelated maps.

## 5. Structure placement rules

### 5.1 Base placement

- Bases are no longer diagonal corners.
- Player base anchors left, enemy base anchors right.
- Both base courts should visually connect to both lanes.

### 5.2 Capture/tower placement per lane

Each lane gets its own socket chain:

`player-side capture -> player-side tower -> enemy-side tower -> enemy-side capture`

Per-lane rules:

- A team's tower must remain farther from its own base than its linked capture.
- A team's tower must remain on its own half of that lane.
- Minimum socket spacing remains `0.15` **within a lane**.
- Do not compare north-lane progress directly against south-lane progress for
  spacing; they are separate progress spaces.

### 5.3 Suggested progress template per lane

- player capture: `0.16-0.22`
- player tower: `0.34-0.42`
- enemy tower: `0.58-0.66`
- enemy capture: `0.78-0.84`

This preserves the corrected A2 rule set from the current bugfix:

- own capture before own tower;
- own tower on own half;
- enough spacing to avoid socket overlap.

## 6. Terrain and prop authoring rules

### 6.1 Terrain patches

The current marching-squares renderer and terrain material pipeline are still
valid. The new authored map should reuse them exactly as-is:

- same grass / dirt / stone material set;
- same 16-state transition overlays;
- same patch overlap and deterministic variant seeding.

What changes is **where** patches are placed:

- two independent lane patch chains instead of one;
- shared left/right base plazas that bridge into both lanes;
- optional center divider grass mass between north/south routes.

### 6.2 Props

Props should support lane identity:

- north lane: denser rock / pine framing, narrower sightline;
- south lane: more open dirt edge, wider oak / log silhouettes;
- center divider: landmark clusters that separate the two routes without
  blocking the lane visually.

Renderer-side grounding, occlusion, shadow direction, and QA rules stay the
same.

## 7. Current-map problems this redesign addresses

The present map has several concrete limits:

1. `LANE_PATH_NODES` defines one near-straight diagonal route, so every wave
   meets along the same visual axis.
2. `structureSockets` all sit on one centerline, which makes ownership and
   tactical space feel mechanical rather than territorial.
3. `terrainPatches` express one continuous road grammar instead of two
   distinct approach stories.
4. `terrainProps` are too sparse and too lane-agnostic to separate battle
   spaces once more units are visible at the same time.
5. A single scalar `progress` over one lane cannot scale to north/south paths,
   much less later 3-player or 4-player authored layouts.

## 8. Future 3-player / 4-player compatibility

This step does **not** implement 3-player or 4-player maps, but the schema
should not block them.

Why the proposed structure still scales:

- `lanes[]` is not capped at 2.
- `laneId + progress` already separates multiple travel routes cleanly.
- Additional bases can be represented as sockets or future `baseSockets[]`
  without rewriting terrain/prop patch grammar.
- A triangular 3-player map could be authored as three lanes and three base
  courts.
- A 4-player map could be authored as four perimeter approach lanes or paired
  lanes with inserted midpoint bases.

The future extension problem becomes authored map design, not runtime schema
replacement.

## 9. Engine reuse check

The following systems are lane-count-agnostic and should be reused:

- `battlefieldWorldRenderer.ts`
- marching-squares transition logic
- production terrain / prop / structure asset QA pipeline
- unit grounding / shadow / depth presentation

The following areas need lane-aware adapters when implementation begins:

- `BattlefieldMapSpec` runtime typing
- `getLanePositionAtProgress()` style helpers
- socket lookup utilities that currently assume one scalar progress domain
- any debug/validation tooling that serializes a single `lanePath`

This is still a data-model evolution, not a renderer rewrite.

## 10. Day 2 implementation checkpoint scope

The next implementation checkpoint should build only:

- the multi-lane schema in code,
- one authored partial map slice that includes:
  - left base court,
  - north lane opening,
  - south lane opening,
  - at least one per-lane capture/tower socket pair,
- a toggle path so the current production map and the new two-lane candidate
  can be compared side by side.

Do **not** replace the production map by default until the user reviews the
candidate.
