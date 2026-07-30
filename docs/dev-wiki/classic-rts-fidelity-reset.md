# Classic RTS Fidelity Reset — Diagnosis, Research, Decision

Date: 2026-07-28/29

Written by the consulting session (`stock_predict_rev` harness, scoped to
`game_project1` only, source-unmodified) in response to the user's
assessment after Day 0-8 of `wc2-rebuild-plan.md` landed: the game is
"많이 개선되었지만 내가 바라는 대대적인 개선은 아닌 수준" — meaningfully
better, but not the transformation they wanted — with character movement
still feeling unnatural/flimsy ("경박하다") and the music feeling the same
way. They asked for status verification, then research into Warcraft I/II
and early StarCraft, framed around the idea of "a custom scenario/usemap
built on that era's engine," and a decision on how to reset toward that bar
with the 10+ days still remaining.

## 0. Status check (verification, not new work)

- Latest commit is still `313fcf2` ("test: complete day8 full regression").
  No commits landed after it — the GitHub Pages deployment / Day 9 prompt
  from the previous turn was never sent to a dev session. **Nothing is lost
  by changing direction now**; there is no in-flight work to interrupt.
- Everything built through Day 8 (terrain grammar, props, structures,
  economy/capture/tower systems, the 10-unit production art roster, UI
  density/composition, full regression) is real, verified, working game
  content. The recommendation in section 4 is built on **keeping** that
  work, not discarding it — the two things the user flagged as still weak
  (movement, music) are specific and narrow enough that a full restart
  would throw away far more than it fixes.

## 1. Why the result still reads as a modest improvement, not a
transformation

Two structural gaps explain almost all of the remaining "부자연스럽고
경박하다" feeling. Both were out of scope for every prompt executed so far
— not because anyone did sloppy work, but because `wc2-rebuild-plan.md`
never targeted them.

### 1.1 Movement: this project has never had more than 2 facings

Every unit produced from the golden reference through Day 7.5 uses exactly
one authored facing (left) plus a horizontal mirror for right. Diagonal
movement along the lane is therefore always a flat left- or right-facing
sprite sliding along a diagonal path — the character never actually turns
to face the direction it's walking. This is the single largest reason
movement reads as pasted-on rather than alive, independent of how good any
individual frame's art or timing is; Day 6's timing polish and Day 7.5's
walk-cycle rework both operated within this 2-facing ceiling and couldn't
fix what the ceiling itself causes.

### 1.2 Music: still 100% synthesized placeholder, structurally thin by
design

`src/systems/audio/assetManifest.ts` has never had a real audio file —
every BGM entry is `missingAsset: true` with a single-oscillator `synth`
fallback (`pad`, `pulse`, `chime`). This was always a known, documented gap
(`docs/dev-wiki/audio-system-prototype.md` states it explicitly), and nine
days of visual/gameplay work never touched it. A single sustained
oscillator pad is structurally "light" no matter how well its envelope or
timing is tuned — it has no layered instrumentation, no percussion, no
motif. This is not a bug to polish; it's an unbuilt content category.

## 2. Research: what the target era actually did (with sources)

### 2.1 Movement fidelity — 8 directions was the baseline, 16 was the
StarCraft-era push

- Warcraft: Orcs & Humans and Warcraft II-era isometric RTS sprite work
  used an 8-direction facing standard (N/NE/E/SE/S/SW/W/NW) as the norm for
  this genre and period —
  [8-direction walk-cycle reference, OpenGameArt](https://opengameart.org/content/8-frame-walk-cycles),
  cross-referenced against
  [Warcraft: Orcs & Humans sprite archive, Spriters Resource](https://www.spriters-resource.com/ms_dos/warcraft1/).
- StarCraft (1998) pushed further: units rotate in 22.5° increments, i.e.
  **16 discrete directional frames** —
  [GameDev.net sprite-rotation discussion citing SC1's 16-direction system](https://gamedev.net/forums/topic/594196-2d-sprites-how-many-directions-for-smooth-rotation/),
  [The Starcraft Editing Bible — sprite/animation routine documentation](https://files.campaigncreations.org/misc/tutorials/starcraft/bible/chap4_anime.shtml).

Takeaway: 8 directions is the actual Warcraft I/II bar the user named, is a
large step up from this project's current 2, and is a bounded, achievable
target (roughly 4x the art volume already produced per unit, using the
exact same pipeline — not a new pipeline). 16 directions (true
StarCraft-era fidelity) should be named honestly as a stretch goal, not the
default target, given the remaining schedule.

### 2.2 Music fidelity — composed, layered MIDI, not synthesized ambience

- Warcraft II's music was composed and arranged by Glenn Stafford (Blizzard's
  founding Audio Director, classically trained) as real MIDI arrangements —
  [Warcraft II MIDI files, Warcraft Wiki](https://warcraft.wiki.gg/wiki/Warcraft_II_MIDI_files).
- StarCraft's original score was written by a team (Derek Duke, Jason Hayes,
  Glenn Stafford), continuing the same composed/orchestrated approach rather
  than procedural synthesis —
  [Glenn Stafford, Wowpedia](https://wowpedia.fandom.com/wiki/Glenn_Stafford).

Takeaway: the target era's music was never "a synth pad with a filter
envelope" — it was multi-instrument arrangement (percussion ostinato, brass/
string-like layered motifs, a real chord progression) even when played back
through period-accurate MIDI synthesis. This project can't hire a composer
in a game jam, but it also doesn't need to — the honest options are (a)
source CC0/CC-BY MIDI-style or chiptune-orchestral tracks with clear
licensing (same pattern as the CC0 terrain tileset already used
successfully), or (b) substantially deepen the existing procedural
generator in `bgmManager.ts`/`audioDirector.ts` to layer multiple
simultaneous voices (bass ostinato + percussion hit pattern + a lead motif)
instead of one sustained pad — still synthesized, but structurally closer
to "arrangement" than "ambience." Both are documented as options in section
4; neither has been attempted yet.

## 3. What "유즈맵/커스텀 게임" framing means for this project

The user's framing — build this as if it were a custom scenario running on
a Warcraft I/II/early-StarCraft-era engine, the way `.scx`/custom-scenario
maps reused a classic RTS engine's visual and audio grammar to deliver a
completely different ruleset — is a useful discipline, not just a mood
board reference. It means:

- The **engine-level grammar** (tile grid, unit facing count, palette
  discipline, music instrumentation style, UI chrome density) should read
  as "this could be a mod of a 1995-1998 RTS," full stop, regardless of
  what the actual game rules are underneath.
- The **game rules** (lane-siege economy, capture points, age-based roster
  unlocks, worker allocation) stay exactly as already designed — that's the
  "custom map" part, and it doesn't need to resemble Warcraft II's actual
  base-building rules any more than a real custom scenario needs to.
- This reframes sections 1.1/1.2 precisely: this project is not behind on
  its own game design, it's behind on **engine-grammar fidelity** — facing
  count and music instrumentation are exactly the two engine-grammar knobs
  it hasn't turned yet.

## 4. Decision (confirmed 2026-07-29, corrected same day): reassembly on
the existing foundation, Option A, original style-inspired music, plus a
new map layout

The user confirmed the direction, then corrected an over-broad reading of
point 1 below: "reuse the existing foundation" means reuse the **rendering
engine** (terrain material/transition system, prop and structure asset
pipeline, marching-squares grammar, canvas/anchor contracts) — it does not
mean the current map's layout is frozen. The user's own analogy: Warcraft
II and StarCraft kept one engine across many different maps, and new maps
were always being authored on top of it. This project's actual map — the
data in `battlefieldMaps.ts` (`LANE_PATH_NODES`, `terrainPatches` cell
content, `structureSockets` placement, `terrainProps` placement) — is
exactly that kind of authored content, not engine code, and the user has
flagged it as currently weak (placement/composition issues). It is
explicitly in scope for this cycle. Four points, each load-bearing for how
the next prompt must be read:

1. **This is a reassembly cycle, not a from-scratch rebuild — but
   "reassembly" means the engine and pipelines, not a frozen map.** "다시
   1일차부터" means a new *cycle* of work targeted at facing count, music,
   and map layout, reusing every rendering/production *system* already
   built: the terrain material/transition engine, the prop and structure
   art pipeline, the golden-reference-to-QA production process, the
   economy/capture/tower *rules*, the UI system, the 10-unit roster's
   idle/walk/attack art content. Nothing about **how content is made or how
   the game is played** gets deleted or rebuilt from scratch. But the
   current map — the actual layout data in `battlefieldMaps.ts`
   (`LANE_PATH_NODES`, `terrainPatches`, `structureSockets`,
   `terrainProps`) — is authored content sitting on top of that engine, the
   same way a StarCraft map like Lost Temple sits on top of the StarCraft
   engine. The user has flagged this specific map's layout/placement as
   weak, and redesigning it (new lane geometry, new terrain-material
   distribution, reconsidered structure/prop placement) is explicitly part
   of this cycle, using the existing engine unchanged. Section 5 already
   reflected the systems-reuse framing; this note corrects an
   over-broad reading of it (an earlier prompt incorrectly told a dev
   session not to touch `battlefieldMaps.ts` at all — that was wrong and is
   superseded by this point).
2. **Facing target: Option A, 8 directions.** This is the concrete bar the
   user named first ("워크래프트1, 2 수준") and matches section 2.1's
   research. 16-direction StarCraft-era fidelity remains a documented
   stretch goal (section 4 below, pre-confirmation text), not the adopted
   target — call this out explicitly if the user later wants to push to 16.
3. **Music target: original composition in the researched style, not
   licensed sourcing.** The user explicitly rejected Option B's
   "license/source existing tracks" path for music: *"음악은 라이센스
   내야하는 건 말고... 아까 준 레퍼런스의 게임들 음악을 참고하여 비슷한
   풍으로 다른 음악을 만들어줬으면 해"* — reference the researched games'
   musical *style* (instrumentation choices, tempo/mode character, layered
   arrangement approach per section 2.2) and compose new, original tracks
   in that vein. This is exactly the same legal posture already used for
   the visual rebuild (original assets inspired by genre convention, never
   copied) — apply it identically to music:
   - **Do**: study what made the reference era's music work structurally —
     layered percussion ostinato + a bass/harmony layer + a lead motif,
     modal/harmonic character typical of the genre and period, tempo and
     dynamic range appropriate to menu/preparation/low-intensity-battle/
     high-intensity-battle states (the existing `BGM_ASSETS` state machine
     already models these four states — keep that structure).
   - **Don't**: transcribe, closely imitate, or produce a recognizable
     variation of any specific identifiable melody/theme from Warcraft II,
     StarCraft, or any other existing game. "Inspired by the style" means
     new melodic and harmonic material, not a reharmonized or lightly
     altered version of an existing one.
   - Implementation path stays original/synthesized (deepen
     `bgmManager.ts`/`audioDirector.ts`'s procedural generator to layer
     multiple simultaneous voices) rather than sourcing external audio
     files — this avoids any licensing question entirely, consistent with
     what the user asked for.
4. **Map layout redesign is in scope, on the existing rendering engine.**
   The current map's lane geometry, terrain-material distribution,
   structure placement, and prop placement are all authored data, not
   engine code — redesign them like authoring a new map for an existing
   RTS engine. Concrete starting points already on record:
   - `docs/dev-wiki/day5-integration-validation.md`'s own closing note
     flagged the runtime lane's "deliberately straight, uniform geometry"
     as a follow-up item, never acted on.
   - The map currently has a small, sparse, hand-placed prop set (6 props
     total in `terrainProps`) and a single straight-ish diagonal lane
     between two bases with 2 capture points and 2 towers — thin compared
     to the varied chokepoints, expansions, and terrain doodad density of
     an actual period RTS melee map.
   - The rendering engine (marching-squares transitions, material
     textures, prop/structure QA pipeline, the minimum structure-spacing
     rule from the earlier tower/capture fix) does not need to change to
     support a richer map — it already takes arbitrary lane paths, terrain
     patches, and prop/socket placements as data.

The rest of this section (below) is the original recommendation written
before confirmation; kept for the reasoning trail.

## 4. Decision: scoped reset, not a full restart (recommendation)

The user floated restarting from "Day 1" of a new plan. Given section 0
(nothing in flight to lose) and the size of what's already verified working
(terrain, structures, economy, capture, UI, full regression), a full
from-scratch restart would discard a large amount of correct, tested work
to fix two specific, well-understood gaps. **Recommendation: keep
everything already built, and run a second, narrower "Day 1-N" cycle
targeted only at sections 1.1 and 1.2.**

Two options, by ambition level — this is the user's call, not a technical
constraint:

- **Option A (recommended): 8-direction unit facing + layered procedural
  music.** Matches the Warcraft I/II bar the user explicitly named. Reuses
  the exact golden-reference-through-QA pipeline already proven three times
  (Day 3-4, Day 6 walk-cycle rework, Day 7.5) — this is volume (8x facings
  instead of 2x per unit) under a known process, not new process risk. Music
  gets a deepened procedural arrangement (no licensing/sourcing risk, fully
  original).
- **Option B (stretch): 16-direction unit facing (true StarCraft-era
  fidelity) + sourced CC-licensed music.** Roughly double the art volume of
  Option A and introduces a new researched-and-vetted external asset
  category (music licensing) the same way the CC0 tileset was vetted in the
  July 28 visual rebuild. Higher payoff, higher risk to the remaining
  schedule.

Both options keep the existing terrain/structure/economy/UI work untouched.
Neither requires redoing Day 0-8.

## 5. What a "Day 1" of this second cycle would actually contain (shape
only — not an execution prompt yet)

This section sketches scope, not step-by-step instructions; the next
prompt will be written once the user confirms Option A vs B.

- **New Day 1**: lock a facing-count decision (8 vs 16) and an updated
  style-guide addendum (multi-direction ground-anchor/canvas rules — a
  384x384 canvas doesn't need to change, but the animation registry's data
  shape does, since it currently assumes exactly 2 facings).
- **New Day 2**: produce one unit's full multi-directional golden reference
  (all facings x all 4 poses) as the hard-stop checkpoint, exactly like the
  original Day 2 — approve before mass production.
- **New Day 3-4**: volume-produce the remaining 9 units' multi-directional
  sets.
- **In parallel**: the music track — either deepen `bgmManager.ts`'s
  synthesis (Option A) or research/vet/integrate licensed tracks (Option
  B), independent of the art stream, so it doesn't block or get blocked by
  facing work.
- **Integration + regression**: same shape as the original Day 5/8, applied
  to the new facing system and music.

## Confirmed direction (2026-07-29, updated same day)

- Reassemble the **engine/pipelines**, not the map — no deletion, no
  from-scratch rebuild of rendering systems or gameplay rules (see section
  4, point 1).
- Facing: Option A, 8 directions (Warcraft I/II bar).
- Music: original composition inspired by the researched era's style, not
  licensed/sourced tracks — see section 4, point 3 for the explicit do/don't
  guardrail.
- **Map layout redesign is in scope** — the current map's lane geometry,
  terrain distribution, and structure/prop placement should be redesigned
  on top of the unchanged rendering engine, the way new maps are authored
  for an existing classic-RTS engine (see section 4, point 4).
- Execution starts with `docs/dev-wiki/codex-prompt-log.md`'s next entry
  (the new-cycle "Day 1" prompt), not with this document — this document is
  the reference the prompt points back to.
