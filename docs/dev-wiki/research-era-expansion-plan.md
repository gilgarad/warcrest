# Era Expansion + Research Panel Plan

Written 2026-08-01 for the main `game_project1` repo after the user confirmed
the next content direction:

1. extend ages past late iron,
2. turn research workers into a real research-point system,
3. let the base panel browse current and previous-age rosters,
4. expose per-unit attack/defense tuning in a clean, table-like UI.

This is a design-and-implementation plan only. It does not claim the feature is
already built.

## Scope

This plan covers:

- age definitions after `iron_late`,
- unit roster expansion rules,
- research-point generation and spending,
- base selection panel UX,
- per-unit attack/defense upgrade persistence,
- production from older ages after the player has advanced.

This plan does not yet cover:

- final art production for new ages,
- balance numbers beyond the first playable defaults,
- AI choosing research upgrades intelligently,
- multiplayer sync or save/load migration.

## User-Confirmed Direction

The requested age chain after the current five ages is:

1. 르네상스
2. 근대 초기
3. 근대 후기
4. 현대 초기
5. 현대 중기
6. 현대 후기

Combined with the already-built ages, the full planned ladder becomes:

1. 석기 시대 (`stone`)
2. 청동기 (`bronze`)
3. 초기 철기 (`iron_early`)
4. 중기 철기 (`iron_mid`)
5. 후기 철기 (`iron_late`)
6. 르네상스 (`renaissance`)
7. 근대 초기 (`industrial_early`)
8. 근대 후기 (`industrial_late`)
9. 현대 초기 (`modern_early`)
10. 현대 중기 (`modern_mid`)
11. 현대 후기 (`modern_late`)

## Current State To Preserve

As of 2026-08-01:

- age data exists only through `iron_late`,
- wave rosters are "one active roster per age",
- research workers only increment `workers.research` and have no actual point
  output or spend path,
- the main HUD shows resource bars and action buttons, not a true base
  management panel,
- production always follows the player's current age rather than a user-chosen
  "produce from previous age" selection.

The new design must preserve existing battlefield rules unless explicitly
replaced:

- wave spawning remains automatic / instant-wave-assisted,
- two lanes each receive a full roster,
- support wagons remain a support slot, not a manually edited research row,
- attack/defense upgrades modify runtime unit stats multiplicatively from a
  preserved base stat.

## Design Goals

1. Keep the battlefield readable. Research choices should live behind base
   selection, not clutter the always-on HUD.
2. Make research reversible before confirmation, but never below the already
   applied baseline after confirmation.
3. Let age advancement unlock newer rosters without deleting older roster
   choices.
4. Keep the data model additive. Existing age/roster/unit systems should extend,
   not be replaced wholesale.
5. Make the first implementation playable before it is fully art-complete.

## Age Data Model Changes

### 1. `AgeId` expansion

`src/data/ages.ts` should extend `AgeId` and `AGES` to the 11-age ladder above.

Each age entry should keep the existing fields and add two more:

- `researchPointTier`: base research-cost scaling bucket
- `productionGroup`: semantic era bucket for roster browsing and UI grouping

Suggested shape:

```ts
interface AgeDef {
  id: AgeId;
  label: string;
  order: number;
  activeResourceIds: ResourceId[];
  baseWaveFoodCost: number;
  bonusUnitFoodBase: number;
  foodWorkerIntervalSec: number;
  killGoldBase: number;
  immediateWaveTokenGranted: boolean;
  researchPointTier: number;
  productionGroup: "ancient" | "classical" | "iron" | "renaissance" | "industrial" | "modern";
  notes?: string;
}
```

### 2. First-pass balancing rule

For the six new ages, do not invent bespoke economy curves first. Start from a
simple monotonic progression:

- wave food cost,
- kill reward total,
- age-up cost,
- research-worker hiring cost,
- later unit stat baselines.

These should initially scale by age order, then get tuned after the panel works.

## Unit Roster Expansion Rules

## 1. Separate "player current age" from "selected production age"

The player must be able to advance to a newer age while still producing an older
age's roster from the base panel. Therefore the team state needs two concepts:

- `ageId`: highest unlocked age
- `selectedProductionAgeId`: the age whose roster the next waves use

Rule:

- `selectedProductionAgeId` defaults to `ageId` when the player advances.
- The base panel can move `selectedProductionAgeId` backward with left/right
  browsing, but never above `ageId`.

Enemy AI can keep using `selectedProductionAgeId = ageId` for the first version.

### 2. Role-lane continuity rule

The user requested that old units remain selectable, but only within role class:

- melee stays melee,
- ranged stays ranged,
- support stays support.

That means the production panel should show rosters by age, not arbitrary unit
mixing. The user is selecting a previous age package, not hand-assembling one
unit at a time for wave production in this phase.

### 3. New roster table structure

`src/data/unitRosters.ts` should eventually distinguish:

- `battleline`: current auto-wave package for that age,
- `researchRows`: units shown in the research panel for that age,
- `roleClass`: `melee | ranged | support`.

Suggested new structure:

```ts
interface ResearchUnitRow {
  unitId: LaneUnitId;
  roleClass: "melee" | "ranged" | "support";
  iconTextureKey?: string;
}

interface AgeWaveRoster {
  ageId: AgeId;
  battleline: Array<RosterEntry<BattleUnitId>>;
  support: Array<RosterEntry<SupportUnitId>>;
  researchRows: ResearchUnitRow[];
}
```

## Research Worker and Research Point System

### 1. Resource generation rule

Research workers should finally do real work:

- each research worker generates `1` research point every `10` seconds,
- points go to a new top-level team resource: `research`,
- the HUD should show this resource beside gold/wood/food/metal with a beaker
  icon and blue-green accent.

This should not replace existing material resources. It is a fifth visible
currency for the player.

### 2. Resource model change

`ResourceId` and `makeResourceMap()` should add:

- `research`

Unlike gold/wood/food/metal:

- it is not spent on buildings,
- it is not dropped from kills,
- it is not assigned to a gatherer lane directly,
- it is produced only by `workers.research`.

### 3. Tick rule

`tickLaneEconomy()` should add a dedicated `research` accumulator with fixed
`10 sec` interval, independent of the normal `BASE_RESOURCE_TICK_SEC`.

This is intentionally separate because the user explicitly asked for:

- normal workers: 1 resource per 5 sec,
- research workers: 1 research point per 10 sec.

## Research Upgrade Model

### 1. Persistent applied baseline

The user's rule means there are two layers:

1. applied upgrades that are already permanent,
2. draft changes the player is currently editing before pressing apply.

Therefore each researchable stat needs:

- `appliedAttackLevel`
- `appliedDefenseLevel`
- `draftAttackDelta`
- `draftDefenseDelta`

Where:

- applied levels can never go below `0`,
- draft deltas can go negative only down to the applied baseline,
- pressing Apply converts draft into applied and spends research points.

### 2. Multiplicative effect rule

Each level changes the underlying unit baseline by 10%.

Formula:

- attack multiplier = `1 + appliedAttackLevel * 0.1`
- defense multiplier = `1 + appliedDefenseLevel * 0.1`

Example:

- base attack `20`, attack level `+5` -> runtime attack `30`
- base defense `10`, defense level `+3` -> runtime defense `13`

For first implementation, round runtime combat stats at the final unit spawn /
construction application boundary, not in the UI model.

### 3. Stat ownership

Research upgrades belong to:

- the player team,
- a specific age,
- a specific unit row within that age.

That means a new age starts with fresh `0/0` upgrades, per the user's request:

- aging up does not carry old attack/defense levels into newly unlocked units,
- old ages retain their own already-applied values if the player goes back and
  produces them.

Suggested ownership key:

- `teamId + ageId + unitId`

### 4. Cost model

First playable rule:

- each `+1` attack or defense level costs `1` research point,
- removing a draft level before apply refunds only the draft preview, not spent
  points, because points are only spent on Apply.

Later balancing can add:

- escalating per-level costs,
- per-age cost multipliers,
- per-unit rarity multipliers.

Do not add those in the first implementation unless necessary.

## Base Panel UX

### 1. Entry

The panel opens only when the player selects the main base.

This panel becomes the place for:

- current age display,
- production-age browsing,
- roster preview,
- research-point spending,
- apply / cancel draft actions.

### 2. Top bar inside panel

The top of the panel should contain:

- current unlocked age label,
- currently selected production age label,
- `<` and `>` browse arrows,
- current research-point total,
- optional close button.

Rules:

- `>` is disabled when selected age already equals unlocked age,
- `<` is disabled at stone age,
- changing the selected production age immediately updates the roster rows shown.

### 3. Table-like layout

The user requested a clean table without visible borders.

Recommended composition:

- left column: unit icon or bust sprite
- next column header: crossed swords icon
- next column header: shield icon
- attack cell: current draft/apply value
- defense cell: current draft/apply value
- right side of each stat cell: `-` and `+` buttons

Visually:

- use alignment and spacing, not hard grid lines,
- alternate row tint very subtly if readability needs help,
- keep the panel theme consistent with the current war-table HUD art,
- do not add spreadsheet borders.

### 4. Row content

Each row should show:

- unit icon,
- unit label,
- current attack level,
- current defense level,
- decrement button,
- increment button.

Recommended stat text format:

- `+0`, `+1`, `+2`, ...

Optional secondary text in a lighter color:

- `x1.0`, `x1.1`, `x1.2`, ...

### 5. Draft/apply UX

At panel bottom:

- `적용` button
- `취소` button

Rules:

- `적용` is enabled only if a draft changed and the player has enough research
  points,
- `취소` restores all rows in the current viewed age to the last applied
  baseline,
- leaving the panel without Apply should discard draft changes unless the team
  wants persistent draft state. First implementation should discard on close for
  simplicity.

## Runtime Combat Integration

### 1. Unit spawn pipeline

When a unit is spawned, its stats should be derived from:

1. base `UNIT_STATS[unitId]`,
2. selected production age's applied research levels for that unit row,
3. any existing contextual modifiers already in the game
   (attrition, supply aura, etc.).

This avoids mutating the shared global stat table.

### 2. Tower and base exclusion

This plan applies only to units shown in the base research panel.

First version should exclude:

- towers,
- main base,
- capture-point buildings,
- economy buildings.

Those can get a later separate structure research track if needed.

## UI Architecture Recommendation

To avoid making `LaneBattleScene.ts` even larger, split the feature into layers:

### 1. Data layer

- `src/data/ages.ts`
- `src/data/unitRosters.ts`
- `src/data/resources.ts`
- `src/data/balance.ts`

### 2. State layer

New modules recommended:

- `src/systems/lane-economy/researchState.ts`
- `src/systems/lane-economy/researchRules.ts`

Responsibilities:

- own applied/draft level data,
- validate increments/decrements,
- compute research cost,
- apply or discard draft,
- resolve modified unit stats for spawning.

### 3. Presentation model layer

New model recommended:

- `src/ui/baseResearchPanelModel.ts`

Responsibilities:

- transform team/base/research state into rows for rendering,
- expose button enabled/disabled state,
- format displayed labels and multipliers.

### 4. Phaser view layer

New view recommended:

- `src/ui/BaseResearchPanel.ts`

Responsibilities:

- render the panel,
- bind icon rows / +/- buttons / age arrows / apply / cancel,
- notify `LaneBattleScene` through callbacks,
- stay hidden unless the base is selected.

This matches the refactor style already used by `AudioSettingsPanel` and
`LaneBattleHudView`.

## Suggested Implementation Order

1. Extend age data through `modern_late` with placeholder numbers.
2. Add `research` as a real resource and make research workers generate it.
3. Introduce `selectedProductionAgeId` on team state.
4. Add research state storage for per-age / per-unit applied levels.
5. Add a base-only research panel with text-only rows first.
6. Wire unit spawn to use researched stats.
7. Upgrade the panel to icon-based row layout with swords / shield columns.
8. Add final validation:
   - build,
   - unit tests for research math,
   - a Playwright probe for base panel flow.

## Validation Targets

The feature is not done until the following are testable:

1. Research worker 1명 -> 10초 후 research `+1`.
2. Apply 없이 `+/-`만 누른 상태에서는 실제 spawned units stats unchanged.
3. Apply 후 spawned units use the upgraded attack/defense values.
4. Applied baseline below로 `-` 불가.
5. Age-up 후 new age rows start at `+0/+0`.
6. 이전 age로 browsing 후 그 roster가 실제 웨이브 생산에 반영됨.
7. Current age보다 미래 age browsing 불가.

## Open Questions Left For Implementation

These are not blockers for coding the first version, but they should be decided
before balancing:

1. New six ages' exact wave rosters and unit names.
2. Whether support wagons also receive researchable attack/defense rows in the
   first version.
3. Whether AI should ignore the research system at first or receive scripted
   periodic upgrades.
4. Whether the panel should remember un-applied draft state when the base panel
   closes.
5. Whether research points need a cap.

## Recommended First Version Defaults

For the first playable pass:

- support wagons appear in the panel but their `attack` row is disabled if their
  combat attack remains `0`,
- AI ignores research and only uses age progression,
- no research cap,
- closing the panel discards un-applied draft,
- new ages use placeholder text/icon rows until full art arrives.

That keeps the feature shippable without waiting on every downstream content
dependency.

## Structural Gaps In The Current Codebase

The current codebase is close enough to extend, but not yet shaped correctly
for this feature. These are the confirmed gaps that would cause a naive
implementation to become brittle:

### 1. There is no base selection model today

`LaneBattleScene` currently tracks only:

- `selectedCapturePointId`
- `selectedDefenseTowerId`

The player main base is rendered visually, but it has no selectable state, no
hit zone, and no UI contract comparable to capture points or defense towers.

Implication:

- the research panel cannot be bolted on as "just another button";
- a new selection domain must be introduced first.

### 2. Wave production is hard-wired to `team.ageId`

`createWaveDeploymentPlan()` in `laneWaveRules.ts` currently uses:

- `getAgeBalance(team.ageId)`
- `getWaveRoster(team.ageId)`

Implication:

- older-age production browsing cannot work until production reads from a
  separate selected production age.

### 3. Team resource state does not contain research

`ResourceId`, `makeResourceMap()`, HUD resource display, and resource-formatting
helpers do not yet recognize a research currency.

Implication:

- research-worker output, UI visibility, and point spending cannot land in one
  place without widening the core resource contract first.

### 4. Unit stat resolution is mostly static

Current unit spawn logic copies values out of `UNIT_STATS` into spawned units.
That is good for runtime mutability, but there is no dedicated stat-resolution
layer that answers:

- "given team X, production age Y, unit Z, what are the final attack/defense
  values?"

Implication:

- if research math is patched directly into `spawnLaneUnit()`, the scene will
  become harder to reason about and harder to test.

### 5. HUD and panel concerns are currently mixed

`LaneBattleHudView` handles:

- always-on top/bottom HUD,
- worker controls,
- strategic actions,
- capture-point actions.

This is not the right place to also host a deep base research panel, because
that panel has a different lifecycle:

- open only when a base is selected,
- modal-like focus,
- draft/apply/cancel state,
- age browsing,
- row-level +/- interactions.

Implication:

- the base research panel should be a separate Phaser view object, not an
  extension of the bottom HUD button strip.

## Required Refactors Before Feature Logic

The safest path is not "add the full feature immediately." These minimal
refactors should land first so the feature has a stable foundation.

### Refactor A. Introduce unified selection type

Add a single selection model in `LaneBattleScene`, for example:

```ts
type LaneSelection =
  | { kind: "none" }
  | { kind: "capture-point"; id: number }
  | { kind: "defense-tower"; id: number }
  | { kind: "main-base"; team: TeamId };
```

This replaces parallel nullable ids in scene-owned interaction logic.

Why this must happen:

- base selection needs to coexist cleanly with point/tower selection;
- debug snapshot output should report one canonical selection;
- UI visibility logic becomes simpler and less error-prone.

Compatibility note:

- legacy helper getters can continue deriving `selectedCapturePointId` /
  `selectedDefenseTowerId` temporarily if other code still expects them.

### Refactor B. Split current age from production age

Extend `TeamState` with:

- `selectedProductionAgeId: AgeId`

Rules:

- initialized to `ageId`,
- reset to the newest unlocked age after each successful age-up,
- used by wave production and base research panel display,
- never exceeds `ageId`.

### Refactor C. Add research to the resource contract

Widen the core resource layer first:

- `ResourceId`
- `RESOURCES`
- `MVP_ACTIVE_RESOURCE_IDS`
- `makeResourceMap()`
- HUD formatting helpers
- debug snapshot output

This avoids special-casing research outside the main resource system.

### Refactor D. Add stat resolution utility

Introduce a pure helper module, for example:

- `src/systems/lane-units/unitStatResolver.ts`

Responsibilities:

- accept base stat definition,
- accept team research state,
- accept production age,
- return final runtime attack/defense values,
- stay independent of Phaser.

This module becomes the one authority for research-adjusted stats.

## Canonical State Ownership

This feature should only succeed if ownership is explicit.

### 1. Scene-owned state

`LaneBattleScene` should own:

- currently selected object (`LaneSelection`),
- current `TeamState`,
- when the base panel is shown/hidden,
- callbacks between panel and game rules,
- final unit spawning.

`LaneBattleScene` should not own:

- raw draft math for every row,
- research stat mutation rules,
- age browsing validation rules.

### 2. Economy-owned state

`laneEconomy` or adjacent new rule modules should own:

- research worker ticking,
- research point accumulation,
- affordability checks for applying research,
- production-age validity checks.

### 3. Research-state-owned data

A dedicated module should own:

- per-team / per-age / per-unit applied levels,
- per-age / per-unit draft levels,
- apply/discard semantics,
- plus/minus clamping rules.

Recommended shape:

```ts
interface UnitResearchLevels {
  appliedAttackLevel: number;
  appliedDefenseLevel: number;
}

interface UnitResearchDraft {
  targetAttackLevel: number;
  targetDefenseLevel: number;
}

type ResearchAgeTable = Record<string, UnitResearchLevels>;
type ResearchDraftTable = Record<string, UnitResearchDraft>;
```

The draft should store absolute target levels, not deltas, because absolute
levels are easier to render, validate, and compare to applied baselines.

### 4. Base panel view-owned state

The panel view should own only ephemeral presentation concerns:

- open/closed animation state,
- currently highlighted row,
- button hit areas,
- scroll position if needed later.

The panel view should not own authoritative research data.

## Proposed Module Additions

The earlier plan named some modules; this section makes the boundaries stricter.

### 1. `src/systems/lane-economy/researchState.ts`

Purpose:

- pure storage container + lookup helpers.

Exports should include:

- `createTeamResearchState()`
- `getAppliedResearchLevels(teamResearch, ageId, unitId)`
- `getDraftResearchLevels(teamResearch, ageId, unitId)`
- `setDraftResearchLevels(...)`
- `discardResearchDraftForAge(...)`

### 2. `src/systems/lane-economy/researchRules.ts`

Purpose:

- pure mutation and validation rules.

Exports should include:

- `canIncrementResearchLevel(...)`
- `canDecrementResearchLevel(...)`
- `getDraftResearchApplyCost(...)`
- `canApplyResearchDraft(...)`
- `applyResearchDraft(...)`
- `resolveResearchMultiplier(level)`

### 3. `src/systems/lane-units/unitStatResolver.ts`

Purpose:

- compute spawn-time stats without mutating global data.

Exports should include:

- `resolveSpawnUnitStats(unitId, team, productionAgeId, researchState)`
- `resolveDisplayedResearchBaseline(unitId, ageId, researchState)`

### 4. `src/ui/baseResearchPanelModel.ts`

Purpose:

- gather all UI data for the base panel into a render-ready snapshot.

It should receive:

- player team state,
- selected base team,
- unlocked age,
- selected production age,
- current research points,
- roster rows for the viewed age,
- applied and draft levels.

It should return:

- header labels,
- whether left/right arrows are enabled,
- whether apply/cancel are enabled,
- per-row icon/unit/stat/button state,
- optional shortage reason text.

### 5. `src/ui/BaseResearchPanel.ts`

Purpose:

- Phaser rendering and pointer handling only.

Callbacks outward should be narrow:

- `browseAge(delta)`
- `adjustRow(unitId, stat, delta)`
- `applyDraft()`
- `discardDraft()`
- `close()`

## Selection And Panel State Machine

This is the part most likely to become messy if not decided now.

### States

The panel system should behave like this:

1. `no-selection`
2. `capture-selection`
3. `tower-selection`
4. `base-selection-panel-open`
5. `audio-settings-open`

### Rules

- selecting a capture point closes the base panel,
- selecting a tower closes the base panel,
- selecting the player base closes capture/tower action focus and opens the base
  panel,
- selecting the enemy base does not open the research panel in the first
  version,
- opening audio settings should pause base-panel pointer interaction to avoid
  focus overlap.

### Close conditions

The base panel closes when:

- player clicks outside onto the battlefield,
- player selects another interactable structure,
- game ends,
- optional close button is pressed.

When it closes:

- draft changes are discarded in first version,
- selected production age remains persisted,
- applied research levels remain persisted.

## Research Draft Interaction Rules

This section replaces ambiguous wording with explicit implementation rules.

### Attack/defense row semantics

Each row has two independent editable values:

- attack level target
- defense level target

There is no shared point pool per row. The only shared pool is global research
points.

### Plus rule

Pressing `+` on a stat:

- increases the draft target by `1`,
- never changes the applied baseline immediately,
- may exceed currently affordable cost in the draft, but then `Apply` becomes
  disabled.

This is preferable to blocking `+` early, because the user explicitly wants to
experiment before committing.

### Minus rule

Pressing `-` on a stat:

- decreases the draft target by `1`,
- cannot go below the applied baseline,
- never refunds already-applied points.

Example:

- applied attack = 2
- draft attack currently = 5
- user can step back to 4, 3, 2
- user cannot step down to 1

### Apply rule

Applying:

- computes the total positive increase across all draft rows of the viewed age,
- checks affordability against current research points,
- subtracts the research-point cost,
- writes the draft targets into applied levels,
- clears draft state for that age.

### Cancel rule

Cancel:

- clears draft state for the viewed age,
- does not touch applied levels,
- does not refund or spend anything because nothing was committed.

## Production-Age Browsing Semantics

This needs to be explicit because it affects gameplay balance and user
expectation.

### 1. What browsing changes

Browsing a production age changes:

- the roster shown in the base panel,
- the roster used for future auto-wave spawning,
- the roster used for instant-wave spawning.

### 2. What browsing does not change

Browsing does not change:

- unlocked age,
- age-up cost or age-up eligibility,
- existing units already on the field,
- tower visuals or economy tech level,
- the viewed age's applied research levels.

### 3. Age-up interaction

After age-up:

- unlocked age increments,
- selected production age auto-snaps to the newly unlocked age,
- that new age starts with `0/0` research for all rows,
- older ages remain browsable and preserve their previous applied upgrades.

## Roster Data Strategy For New Ages

The earlier plan intentionally left new unit names open. To avoid blocking the
system architecture, the implementation should separate:

1. age-system expansion,
2. roster-data completion,
3. art completion.

### First-pass roster policy

For the six new ages:

- define placeholder unit ids only when the combat system actually needs them,
- until then, allow temporary reuse of nearest-role predecessor units if needed
  for system bring-up,
- do not block the panel or research architecture on unfinished art.

Recommended rule:

- no new age should ship without at least one melee row, one ranged row, and one
  support row in data,
- but those can initially reference placeholder or reused unit art while the
  system stabilizes.

## Runtime Stat Application Pipeline

The stat path should be:

1. player unlocks / browses production age,
2. player applies research draft for age A and unit U,
3. research state stores applied level,
4. later wave spawn asks for roster of `selectedProductionAgeId`,
5. each spawned unit resolves final attack/defense from:
   - base `UNIT_STATS`,
   - research levels for that age/unit,
   - existing combat modifiers such as attrition or local building buffs.

This ordering is important because:

- research modifies the age-specific base of future spawns,
- combat modifiers still happen later at runtime,
- previously spawned units do not need retroactive stat mutation in first
  version.

### Decision: existing live units should not update retroactively

For the first implementation, already-spawned field units keep the stats they
were created with.

Reason:

- easier to reason about,
- easier to test,
- avoids hidden mass mutation when Apply is pressed.

If later desired, a follow-up can introduce retroactive aura-like upgrades, but
that is out of scope for version one.

## Debug And Validation Surface Changes

This feature should not land without debug observability.

### `window.__gameDebug` / debug snapshot additions

Extend `laneBattleDebugSnapshot.ts` output with:

- `selectedObjectKind`
- `player.selectedProductionAgeId`
- `player.researchPoints`
- current applied research table summary
- current draft research table summary
- whether base panel is open
- currently viewed panel age

This will make Playwright and manual diagnosis possible without scraping UI
text.

### Unit-test additions required

At minimum add pure tests for:

1. research worker tick rate,
2. selected production age fallback and clamping,
3. draft `-` not going below applied baseline,
4. apply cost calculation,
5. multiplier resolution,
6. spawn stat resolution for researched vs non-researched units.

### Playwright probe additions required

At minimum add one scenario that:

1. opens the player base panel,
2. verifies the age header,
3. changes production age backward,
4. drafts attack/defense changes,
5. applies them,
6. confirms research points decreased,
7. forces a wave and verifies newly spawned unit stats in debug snapshot.

## Migration / Compatibility Notes

Even without a saved-game system, there are compatibility edges:

### 1. Existing helper assumptions

Files like `laneBattleHudModel.ts` currently assume the age list ends at
`iron_late` and manually derive age-up copy from a hard-coded five-age array.

Those helpers must be replaced with:

- generic index lookup through `AGES`,
- no fixed-length assumptions.

### 2. Resource formatting

Current cost/resource formatters only know:

- `G`, `W`, `F`, `M`

Research must get:

- its own icon and short label,
- but should not be mixed into ordinary build costs unless a feature explicitly
  spends research points there.

### 3. Existing dirty code paths

The player-base art is currently purely decorative. Converting it into a
selectable object means:

- adding a hit zone,
- deciding whether the label is also clickable,
- ensuring it does not conflict with nearby unit hit areas.

That overlap risk is real because similar interaction conflicts were previously
seen with dense unit hit areas around structures.

## Recommended Delivery Phases

To reduce risk, implementation should not be attempted as one large patch.

### Phase 1. Foundations

- widen `AgeId`,
- add `selectedProductionAgeId`,
- add `research` resource,
- genericize age summary helpers.

Exit gate:

- build and unit tests pass with no UI changes yet.

### Phase 2. Research state and math

- add research state storage,
- add draft/apply rules,
- add stat resolver.

Exit gate:

- pure tests prove the math and clamping rules.

### Phase 3. Base selection and panel shell

- make player base selectable,
- add panel open/close behavior,
- show age header and roster rows read-only first.

Exit gate:

- panel opens from base click and closes cleanly.

### Phase 4. Editable rows and apply flow

- add +/- buttons,
- add apply/cancel,
- hook research-point spending.

Exit gate:

- draft/apply works in UI and debug snapshot.

### Phase 5. Production-age integration

- connect selected production age into wave spawn and instant wave,
- verify older-age production after age-up.

Exit gate:

- wave roster actually changes when browsing to older ages.

### Phase 6. New age content completion

- fill rosters and placeholder balancing for six new ages,
- wire any missing icons/art fallbacks.

Exit gate:

- full ladder is playable end-to-end.

## Full Re-Review Checklist

Before calling the design implementation-ready, verify all of the following are
still true:

1. There is exactly one authoritative selection model.
2. Production age and unlocked age are separate everywhere.
3. Research is a first-class resource, not a side variable.
4. Draft state is not stored in the Phaser view.
5. Spawn-time stats use a resolver, not inline ad-hoc math.
6. Apply cannot partially commit; it is atomic per panel confirmation.
7. Minus can never go below the last applied baseline.
8. Existing field units do not silently mutate when research is applied.
9. All hard-coded five-age assumptions have been removed.
10. Base panel and audio/settings overlays cannot both consume input at once.
11. Debug snapshot exposes enough state to diagnose the feature headlessly.
12. The feature can ship incrementally even before all new unit art is done.

## Final Assessment After Re-Review

After comparing the existing codebase against the original high-level plan, the
core direction is still correct, but it was not yet implementation-safe.

The critical fixes made by this detailed design are:

- explicit base selection architecture,
- explicit ownership boundaries,
- explicit production-age semantics,
- explicit draft/apply atomicity,
- explicit stat-resolution pipeline,
- explicit phased rollout and validation gates.

With those additions, the plan is now coherent enough to implement without
hidden cross-system gaps. The remaining unknowns are mostly content/balance
choices, not structural blockers.
