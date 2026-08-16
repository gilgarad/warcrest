# Dev-Wiki

The dev-wiki is a persistent markdown knowledge base maintained through normal
repository work.

## Structure

- `contract.md`: operating model
- `backlog.md`: active planning context
- `log.md`: append-only chronology
- `index.md`: routing and authority map
- `game-concept.md`: synthesized game design doc (genre, core loop, combat,
  scope risk) — this project's main wiki content page
- `concept-pivot-lane-siege.md`: research and transition plan for the
  proposed pivot from dungeon squad action to a lane-based siege/economy game
- `art-direction-animation.md`: visual direction for walk/attack animation and
  clustered lane-combat staging
- `retro-rts-visual-methodology.md`: target quality bar, terrain/object
  grounding rules, shared combat-animation skeleton, staged overhaul plan, and
  validated external references for pushing the lane battlefield toward a
  Warcraft II-like RTS presentation
- `wc2-rebuild-plan.md`: the 10-day, multi-agent (Claude Code + Codex)
  execution plan for the top-down rebuild — golden-reference checkpoints,
  per-day agent file ownership, and the coordination rules meant to prevent
  overlapping parallel work
- `wc2-systems-gap-review.md`: post-Day-7 audit of the whole project (not
  just visuals) against Warcraft II's actual systems — flags the critical
  6-of-9-unit token-placeholder gap (closed in Day 7.5) to close before
  Day 8, scopes out the concept doc's 40-item tech tree for this jam, and
  rules out fog of war/multi-unit-selection as genre mismatches
- `classic-rts-fidelity-reset.md`: post-Day-8 diagnosis of why the rebuild
  still reads as a modest improvement rather than the transformation the
  user wanted — pins it on 2-facing (vs. 8/16-direction) unit movement and
  fully-synthesized (vs. composed/layered) music, researches Warcraft I/II/
  early StarCraft's actual specs for both, and recommends a scoped second
  cycle (not a full restart) targeting just those two gaps
- `terrain-rendering-plan.md`: diagnosis and incremental migration plan for
  logical terrain, tile/decal rendering, object footprints, and occlusion
- `terrain-prototype-validation.md`: reproducible central capture-point
  baseline, prototype assets, comparison controls, and visual findings
- `terrain-prototype-v2-validation.md`: central pad replacement, integrated
  visual presets, world-UI sizing, exact-state comparison, and V2 recommendation
- `terrain-prototype-v3-validation.md`: CSS-scale unit/tower presets, facing and
  attack verification, fixed-fortress policy, grounding, and controlled captures
- `five-issue-fixes-validation.md`: roster-scaled support healing, 30-second
  waves, layered procedural audio, QA-only terrain input, and full-lane hybrid
  terrain expansion evidence
- `five-issue-followup-validation.md`: support mana gating, measured audio
  output, terrain-independent facing, opaque world-surface architecture, and
  fixed-fortress distinction evidence
- `unit-animation-tower-v2-validation.md`: normalized pose assets and anchors,
  shared animation registry, bronze spearman art, three-stage axe swing, and
  explicit two-projectile tower pattern evidence
- `audio-system-prototype.md`: independent audio architecture and the historical
  pre-integration baseline from commit `f57303b`
- `audio-integration-validation.md`: live scene integration, dynamic music,
  SFX policy, settings UI, browser evidence, and remaining asset work
- `unit-locomotion-pipeline-v2.md`: root-cause diagnosis of the multi-day
  leg-crossing/walk-cycle problem (fake `synth_walk_b` transform, sandbox/
  game function drift, 3-frame budget too low) and the 10-frame v2 gait
  contract, mirroring policy, and per-frame QA checklist decided from it —
  read before touching unit locomotion art or animation code again
- `audio-synthesis-naturalization-guide.md`: sourced research on why pure
  oscillator SFX reads as robotic and the concrete, named techniques
  (detune/layering, noise transients, multi-stage envelopes, per-instance
  randomization, formant-style filtering for vocalizations) to fix it —
  read before touching `backend.ts`'s synthesis for the "기계음적" feedback
- `ver1-upgrade-plan.md`: the post-ver1 (`5ca9a82`/tag `ver1`) deepening
  pass — terrain seam quality, unit/structure obliqueness vs. the WC2
  reference, camera zoom/scale ratio, and combat SFX/vocalization variety,
  each with confirmed root cause and track assignment
- `session-tracks.md`: the three parallel work streams (그래픽/캐릭터, 맵 및
  게임 전반, 음악/오디오) — scope, owned files per track, current status,
  and the shared-file rule for `LaneBattleScene.ts`. Every handoff prompt
  should be labeled with one of these tracks; read this before writing one
- `pvp-reconnect.md`: how the relay holds a disconnected player's seat, the
  frame log that makes resuming possible, what the provisional `playerId` does
  and does not guarantee, and — read this part — the client-side resume path
  that is deliberately **not** wired yet
- `refactoring-review.md`: dated refactoring inspections; append, never edit
- `../knowledge/`: durable project knowledge
- `../patterns/`: reusable implementation patterns
- `../wiki/`: human-facing documentation and wiki policy
- `../harness/`: local harness provenance and adaptation notes

## Operations

- ingest: read source material and synthesize durable knowledge
- query: answer from the wiki first, then file useful synthesis back
- lint: detect stale claims, missing links, and orphan pages
