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
- `audio-system-prototype.md`: independent audio architecture and the historical
  pre-integration baseline from commit `f57303b`
- `audio-integration-validation.md`: live scene integration, dynamic music,
  SFX policy, settings UI, browser evidence, and remaining asset work
- `../knowledge/`: durable project knowledge
- `../patterns/`: reusable implementation patterns
- `../wiki/`: human-facing documentation and wiki policy
- `../harness/`: local harness provenance and adaptation notes

## Operations

- ingest: read source material and synthesize durable knowledge
- query: answer from the wiki first, then file useful synthesis back
- lint: detect stale claims, missing links, and orphan pages
