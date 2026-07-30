# 10-Day Warcraft II-Grade Visual Rebuild Plan

Date: 2026-07-28

Written by a consulting session (`stock_predict_rev` harness, scoped to
`game_project1` only, source-unmodified). This is the execution plan for
the decision already locked in `retro-rts-visual-methodology.md` (4.5.1,
안 A: full top-down projection) plus the bug fixes and WC2-level visual
ambition raised in the same day's consultation. Historical grounding for
the process below is in
`docs/knowledge/retro-rts-production-precedent.md` — read that first if
"why this order" isn't obvious.

## Constraints this plan is built around

- **Timeline: 10 days**, starting 2026-07-28.
- **Tooling: Claude Code (1 seat) + Codex (3 seats)**, all paid plans — the
  user does not expect to hit token/usage limits. The bottleneck is
  therefore **not** compute — it's **coordination and human review
  bandwidth**. Everything below is designed around that bottleneck, not
  around token budget.
- Difficulty framing: the visual target is a **late-1990s** RTS, not a
  modern one. `docs/knowledge/retro-rts-production-precedent.md` shows the
  actual complexity involved (fixed camera + fixed palette + a cleanup
  pass) — this is achievable with AI image generation standing in for the
  "3D master render" step, as long as the discipline in that doc is
  followed.

## The coordination problem this plan exists to prevent

This same day, a background Codex session started Phase 1 visual audit work
*while* a structural-refactor instruction was still being drafted, and a
separate instance had already landed a feature commit without the
dev-wiki log entry that should have accompanied it. With 3 Codex seats plus
Claude Code all touching one repo, **uncoordinated parallel work is the
single most likely way this plan fails**, not art quality or code
difficulty. Two rules follow directly from that:

1. **No two agents get overlapping file ownership at the same time.** Every
   day's plan below names which agent touches which files. If a human
   decides to run agents in parallel, split by the boundaries listed, not
   by whatever seems free.
2. **Every "golden reference" checkpoint is a hard stop.** No agent
   mass-produces content from a golden reference until a human has looked
   at it and said so explicitly. This mirrors Ensemble/Blizzard locking
   camera+palette once, early, before spending the bulk of the art budget.

## What "developing through this session" (Claude Code, prompt-relay role)
should look like

This session's established role (per `docs/dev-wiki/codex-prompt-log.md`)
is: don't write source directly, track real repo state, translate the
user's direction into scoped prompts for the implementing sessions
(Codex/other Claude Code instances). For this rebuild specifically, that
means each day should follow this loop:

1. **Check real state first, not the plan on paper.** `git status`,
   `git log --oneline -10`, and a glance at any relevant `artifacts/`
   folder — other sessions may have already advanced or diverged since
   this plan was written (this happened twice already on 2026-07-28).
2. **Confirm which checkpoint is next** from the day list below, and
   whether the previous one was actually approved by the user or just
   completed by an agent (those are not the same thing — a golden
   reference existing is not the same as it being approved).
3. **Write one scoped prompt per agent**, naming exact files/directories it
   owns for that step, referencing the exact doc sections it needs
   (not "read everything"), and stating explicitly what NOT to touch.
4. **Log the turn** (`docs/ai-usage/session-log.md` every turn — mandatory
   for this project; `docs/dev-wiki/log.md`/backlog for the One Rule).
5. **Report back to the user in plain terms**: what's ready to look at,
   what decision they need to make before the next step, what's still
   running in the background.

If at any point the user's feedback contradicts a locked decision (style
guide, projection, distance rule), that's a checkpoint failure, not a bug —
stop mass production, fix the golden reference, then resume.

## Standing rule (added 2026-07-28): verify completeness before writing the
next prompt, and always cross-check the gap review

The user's explicit instruction for every remaining handoff in this plan:

1. When a "finished" report comes in for whatever prompt is currently in
   flight, **do not immediately write the next prompt**. First verify the
   just-finished work against that prompt's own "결과물/검증" checklist —
   build, test, screenshots, and whether it actually completed everything
   asked, not just whether it landed a commit. If it's incomplete or
   partially regressed, the next prompt's first job is closing that gap,
   not starting new work.
2. Once the in-flight work is confirmed complete (or its gaps are queued
   first), the next prompt must explicitly reference
   `docs/dev-wiki/wc2-systems-gap-review.md` and name whichever of its
   items are relevant to what's being asked next — including anything
   still undone, anything that needs rework, or anything intentionally
   scoped out (section 3's rejected systems) so the implementing session
   doesn't waste time re-deriving or re-proposing them.

This rule applies to every remaining prompt in this document (Day 7.5
onward), not just the next one.

## Day-by-day plan

### Day 0 (today, half day) — Lock the contract, not the art

**Goal:** produce one page the user signs off on, before any new art is
mass-generated.

- Claude Code (this session or its successor): draft a **Style Guide**
  section inside `retro-rts-visual-methodology.md` (or a new
  `docs/dev-wiki/style-guide.md` if it gets long) covering, per
  `docs/knowledge/retro-rts-production-precedent.md`'s table:
  - Tile size (recommend `32px` logical, can render upscaled)
  - Unit sprite canvas class(es) — replace the current wasteful
    `1152x1024` canvas with something close to the actual content bounds
    (e.g. a `320x320`-class canvas is plenty for a `600px`-tall subject at
    the display scale this game actually uses)
  - Light source direction (pick one, e.g. upper-left, apply to everything)
  - Team-color method: **palette/region swap on a marked area (shield
    emblem, sash, trim), not whole-sprite multiply tint** — this is also
    the fix for the bronze_spearman white-blob bug, so it isn't extra work,
    it's the same work done at the root.
  - Facing count: already decided in methodology doc 7.4 (2 directions +
    attack micro-rotation) — carry forward, don't re-litigate.
- Fix the 3 concrete bugs from the 2026-07-28 bug-diagnosis prompt
  (`codex-prompt-log.md` (5), items A1-A3) if not already done — they feed
  directly into the style guide (A1/A2 are literally style-guide
  violations: inconsistent canvas usage and no per-frame normalization).

**Checkpoint:** user reads the style guide page and says "이걸로 간다" or
requests changes. Nothing in Day 1+ starts before this.

### Day 1 — Tooling and terrain foundation (parallel-safe)

- **Codex #1**: build the **asset validation script** (Python or a small
  Node script — whichever is faster to wire into `npm run` scripts).
  Input: a frame PNG + a reference spec (canvas size, expected alpha bbox
  height ratio, tolerance). Output: pass/fail + measured values. This is
  the mechanical version of the manual check this consulting session did
  by hand for bronze_spearman. Owns: new `tools/asset-qa/` directory only.
- **Codex #2**: implement the terrain tile system per
  `retro-rts-visual-methodology.md` 5.2.1 (marching squares, 16-tile),
  using the CC0 "Warcraft II style" tileset
  (https://opengameart.org/content/grass-and-dirt-tileset-warcraft-ii-style)
  as the concrete reference for how many tiles and what transition rules
  are needed. Owns: new `src/systems/terrain/` + `src/data/terrain/`
  (per methodology doc 8.1 candidate locations), does not touch
  `LaneBattleScene.ts` yet beyond a narrow integration point.
- **Codex #3**: finish the structural refactor items still open from
  `backlog.md`'s "Structural refactor debt" (dead code deletion if not
  done, `LaneBattleScene.ts` decomposition) — this is independent of art
  work and should not be blocked waiting on it.
- Claude Code (prompt-relay role): review each agent's output against its
  owned-files boundary, keep `log.md`/`session-log.md` current, resolve any
  overlap before Day 2 starts.

**Checkpoint:** none required (no user-facing art yet), but verify
`npm run build` / `npm test` stay green across all three streams before
merging.

### Day 2 — Golden reference set (hard stop before mass production)

- Produce **one** fully-styled example of each asset class under the Day 0
  style guide: one terrain tile family fully tiled in a small test area,
  one prop (tree or rock) with correct grounding, one unit's full pose set
  (idle/walk-a/walk-b/attack stages) re-generated or re-normalized to the
  new canvas class, one structure (tower or capture point marker).
- Run every one of these through the Day 1 validation script. Fix until
  they pass.
- Assemble a single comparison screenshot: old (oblique/inconsistent) vs.
  new (top-down/consistent) at the same camera position.

**Checkpoint — the most important one in this whole plan:** show this to
the user before generating anything else. If they say the direction is
right, everything after this day is mostly volume, not judgment calls. If
they say it's wrong, it's cheap to redo at this stage and catastrophic to
discover after Day 6.

### Day 3-4 — Volume production (parallel-safe once Day 2 is approved)

- **Codex #1**: remaining terrain tiles, transitions, and prop placements
  across the full map, using the approved golden tile family.
- **Codex #2**: remaining unit pose sets (stone_slinger, stone_axeman,
  supply_wagon, bronze_spearman) re-normalized to the approved golden unit
  canvas/style; capture-point vs. tower distance fix from
  `codex-prompt-log.md` (5) item A3 (data model split, 1:2 distance rule)
  if not already done — this is data work, independent of art volume.
- **Codex #3**: building/structure states (base, tower stages, fixed
  fortress if it returns in the new layout) under the same style guide.
- Every output from every stream must pass the validation script before
  being wired into `unitAnimationRegistry.ts` / `battlefieldMaps.ts` /
  etc. Treat a failing asset as "not done," not "done with a known issue."

**Checkpoint:** spot-check a handful of assets per stream, not all of them
— the script is doing the exhaustive check.

### Day 5 — Integration

- Wire terrain + props + units + structures together in
  `LaneBattleScene.ts` (or its decomposed successors from Day 1's Codex
  #3 work). This is where `retro-rts-visual-methodology.md` Phase 4
  (Animation Skeleton) and the earlier terrain-rendering-plan.md hybrid
  architecture actually get assembled into one running scene.
- Full Phase 1-style audit capture (ground/props/units/combat layers) at
  the same camera position used in Day 2's comparison shot, to confirm the
  full assembly reads as well as the isolated golden reference did.

**Checkpoint:** user plays a build, not just looks at screenshots.

### Day 6 — Combat timing and animation polish

- `retro-rts-visual-methodology.md` Phase 5 (Combat Timing): melee/ranged/
  support motion differentiation, unit-vs-structure timing (the 3
  concrete bugs from Day 0 should already be fixed by now — this day is
  feel polish, not bug fixing).
- Re-run the validation script against any assets touched during polish
  (polish is exactly when frames quietly drift out of spec).

### Day 7 — UI composition pass

- `retro-rts-visual-methodology.md` Phase 6: HUD density, world
  readability with UI on/off comparisons, per the doc's existing
  checklist.

### Day 7.5 — Close the missing-unit-art gap (added 2026-07-28, do before Day 8)

- A post-Day-7 system review (`docs/dev-wiki/wc2-systems-gap-review.md`
  section 1) found that 5 of the 9 declared battle unit types
  (`bronze_swordsman`, `archer`, `iron_swordsman`, `iron_spearman`,
  `musketeer`, `knight`) still render as generic colored `token-*`
  placeholder badges instead of production art — any playthrough that
  reaches bronze age or later will show this. This was missed because
  Day 3-4's unit work only covered the 4 units spawned at game start.
- Read that document's section 1 before starting; it has the full
  per-unit table, root cause, and two ranked options (produce the
  remaining units through the same Day 3-4 pipeline, or a cheaper
  graceful-degradation fallback if schedule is tight).
- Do this before Day 8's full regression pass, so Day 8 tests a complete
  unit roster instead of surfacing this as a new "regression."

### Day 8 — Full regression + buffer

- Full Playwright/Vitest suite, full manual playtest, fix whatever broke
  during Days 5-7.5. Treat this day as a buffer even if nothing is
  broken — 10-day plans without a buffer day always slip into the
  deadline.
- Also resolve `wc2-systems-gap-review.md` sections 2/4 (tech-tier stretch
  goal, unit acknowledgment SFX) only if there is genuine slack after
  regression passes clean — they are optional, not required.

### Day 9 — Contest material prep starts

- Now that the look is final, start pulling play footage / screenshots for
  the contest's other submission items (play video, game intro doc) —
  those depend on the final visual state and shouldn't be produced earlier.
- Any remaining polish only if Day 8 finished clean.

### Day 10 — Final buffer / submission

- Reserved. If everything above landed on schedule, this day is slack, not
  new work.

## Non-negotiables carried over from earlier decisions (do not re-litigate)

- Projection: full top-down (`retro-rts-visual-methodology.md` 4.5.1, 안 A).
- Facing count default: 2 directions + attack micro-rotation (7.4), unless
  Day 5 playtest shows it's genuinely not enough.
- Legal stance: the user has explicitly accepted the risk of reusing/
  closely imitating decades-old RTS conventions for a non-commercial
  contest entry and does not want this re-raised each session. The CC0
  tileset and Stratagus/Wargus documentation remain the recommended
  reference regardless, since they're the actually convenient path anyway.
