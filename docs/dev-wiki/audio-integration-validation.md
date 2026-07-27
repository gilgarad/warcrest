# Dynamic Audio Integration and Validation

Date: 2026-07-27

Branch: `terrain-prototype-central`

Audio prototype baseline: `f57303b`

Visual baseline commit: `91fb6c0`

Stable validation URL:

```text
/?terrain=prototype-v2&preset=balanced&scale=recommended&camera=central&scenario=visual-validation&seed=warcrest-central-v1&audioDebug=1
```

This page is the current authority for the in-game audio integration. The older
`audio-system-prototype.md` remains the historical record of the independent,
unwired prototype.

## Visual Work Finalization (1-9)

1. **Default size preset:** `recommended` is the user-approved runtime default.
   `scale=compact|recommended|large` remain available for controlled comparison.
2. **Unit silhouette heights:** stone slinger 96 CSS px, stone axeman 104 CSS
   px, supply unit 116 CSS px. These are opaque silhouette heights, not source
   image frame heights.
3. **Tower heights:** ordinary tower 144 CSS px and fixed fortress 162 CSS px.
4. **Facing:** movement vector controls left/right facing, idle preserves the
   last facing, and attack target direction temporarily locks facing.
5. **Attack presentation:** the three Stone Age units use real idle/walk-A/
   walk-B/attack frames. Later-age tokens retain the documented lunge/recoil
   fallback until matching art exists. Walk updates do not overwrite the active
   attack pose.
6. **Fixed-fortress UI:** full HP shows no action, damage shows repair only,
   destruction shows rebuild only. Dismantle and alternate construction are
   forbidden.
7. **Buildable-point UI:** owned ordinary points retain the permitted fortress,
   logistics, and procurement choices plus dismantle where applicable.
8. **Visual evidence:** see `artifacts/terrain-prototype-scale-v3/`, especially
   `scale-comparison.png`, `fixed-fortress-max-hp-ui.png`,
   `fixed-fortress-damaged-repair-ui.png`, and
   `buildable-point-construction-ui.png`.
9. **Visual commit:** `91fb6c0 feat: improve unit readability and fortress point rules`.

## Runtime Architecture (10-15)

10. **Old controller:** no scene imports or calls `musicController`. The file is
    kept as deprecated compatibility/reference code, but it is not instantiated
    by the current game. This prevents old and new music from playing together.
11. **Initialization:** `BootScene` obtains the process-wide singleton from
    `getAudioSystem()`, initializes it idempotently, and queues `menu`. The same
    singleton survives LaneBattle and GameOver scene changes. The first pointer,
    touch, or keyboard input performs one deduplicated unlock.
12. **BGM connections:** Boot=`menu`; accepted start=`preparation`; wave
    spawn=`battle-low`; the lane state machine selects preparation/low/high;
    low fortress health adds a warning layer; GameOver selects victory/defeat.
13. **Battle intensity:** high enters at engaged units >= 6, active projectiles
    >= 3, or >= 7 recent attack events. It remains high for at least 6 seconds
    and exits only after engaged <= 2, projectiles = 0, and attacks <= 1. Low
    has a 2.8-second tail before preparation. This hysteresis reads combat state
    without changing combat calculations.
14. **Fortress warning:** player base or fixed fortress <= 35% triggers once;
    recovery to >= 48% rearms it, with a 12-second cooldown. The warning layer
    lasts 1.8 seconds and then returns to the previously selected preparation/
    low/high state without restarting the main track.
15. **Terminal/reset:** victory and defeat lock out lower-priority states.
    Retry resets the director to menu; a new run resets to preparation and clears
    stale warning/terminal timers.

## SFX and Procedural Music (16-21)

16. **Default low-frequency SFX:** hover, confirm, cancel, hire success/failure,
    resource shortage, wave prepare/start, capture complete/lost, construction
    start/complete, repair, fortress warning/destroy/rebuild, victory, and defeat.
17. **High-frequency SFX:** melee attack/hit, ranged fire, projectile impact,
    unit death, tower attack/hit are connected to actual gameplay transitions.
    Per-ID cooldowns and concurrency caps apply; the `reduced` default samples
    one of every three high-frequency requests and applies 0.46 category gain.
    `off` blocks combat only and `full` plays every allowed request. The manifest
    also reserves catapult fire/impact and unit-hit IDs. There is no catapult
    entity in the current roster, so catapult IDs intentionally have no fabricated
    runtime trigger; Stone Age slingers use ranged-fire/projectile-impact.
18. **Spatial mix:** `spatialAudio.ts` computes one camera-relative volume and
    restrained stereo pan (maximum +/-0.45). Center events are full strength,
    edge events attenuate, and events farther than 2.25 normalized viewport radii
    are skipped. UI/state sounds bypass world attenuation.
19. **Procedural score:** each BGM state now schedules a related bass, chord,
    lead, and pulse phrase rather than sustaining a static tone. Low/high share a
    musical family while high increases rhythmic density. Menu/preparation use
    lower density; victory/defeat are finite phrases. Web Audio gain ramps own
    crossfades so JavaScript fade timers do not accumulate.
20. **Missing-file fallback:** all 6 BGM and 32 SFX entries truthfully remain
    `missingAsset: true`; the backend selects state-specific synthesis and never
    requests the absent file. Debug state exposes `missingAssetFallback: true`.
21. **Adding real audio:** place the licensed file at the manifest `filePath`,
    record its source/license in `licenseNote`, then set only that entry's
    `missingAsset` to `false`. Managers, scene events, settings, and IDs do not
    change.

## In-Game Settings (22-30)

22. **Entry:** click the HUD `소리` button or press Esc. Close with the panel
    button or Esc. Press M at any time to toggle mute.
23. **Volumes:** master, music, and SFX sliders apply immediately. Mouse/touch
    can click or drag; keyboard arrows adjust the selected slider.
24. **Mute:** the panel and M shortcut update the same persisted setting.
25. **Unfocused mute:** blur/visibility temporarily mutes managers and stops
    active one-shots without overwriting user volume or mute values; focus restores
    the effective mix without starting another BGM.
26. **Combat SFX:** off/reduced/full are independent choices; reduced is default.
27. **Persistence:** version-2 data is stored under `warcrest.audioSettings`.
    Version-1 `reducedAudio` data migrates to reduced mode; malformed or out-of-
    range data restores safe defaults.
28. **UI evidence:** `artifacts/audio-integration/audio-settings-1024x576.png`,
    `audio-settings-1365x768.png`, and `audio-settings-1600x900.png`.
29. **Image assets:** none were needed. The panel uses Phaser Graphics/Text and
    the existing HUD palette, so it remains functional without external art.
30. **Asset-request document:** not created because there is no required audio-UI
    image dependency.

## Verification (31-38)

31. `npm run build`: pass. TypeScript, Audio Lab, Playwright validation code,
    and the production Vite bundle compile. Vite reports the existing large
    Phaser bundle warning only.
32. `npm test`: 7 files, 42 tests, all pass. This includes settings migration,
    concurrent unlock, event deduplication, combat modes, spatial attenuation,
    state hysteresis, warning cooldown, and terminal locks.
33. `npm run test:e2e`: 3 Playwright tests pass in Chromium. The complete test
    covers pre-input lock, unlock, high combat, warning, settings, focus, victory,
    retry, defeat, and retry; two more tests cover 1024x576 and 1600x900 panels.
34. `git diff --check`: required before the integration commit and recorded in
    the dev-wiki log.
35. **Browser errors:** 0 console errors, 0 page errors, and 0 failed HTTP
    responses. The missing favicon warning found during validation was fixed by
    referencing an existing project-owned unit image.
36. **Gameplay snapshot:** while paused, changing all audio volumes, changing
    combat mode, and playing a test SFX leaves the serialized gameplay snapshot
    byte-for-byte identical, including equal serialized lengths. The prior visual
    commit separately proved unchanged rules/unit stats and canonical battle state.
37. **Context/voices:** before input the context is `not-created` and voices are
    zero. After repeated scene transitions `unlockAttemptCount` remains 1 and
    active BGM voices remain 1. The warning temporarily permits at most one extra
    layer, then returns to one.
38. **Transitions/restarts:** the controlled browser flow completed victory and
    defeat, restarted after each, returned to battle-high, retained one context/
    BGM, and produced no stale terminal lock.

## Files, Commit, and Remaining Work (39-42)

39. **Changed systems:** `src/systems/audio/**`, Boot/LaneBattle/GameOver scenes,
    `src/ui/AudioSettingsPanel.ts`, Audio Lab, Playwright config/spec, package
    scripts/dependencies, `index.html`, this documentation, and durable validation
    artifacts. No gameplay-data or balance file changed in the audio commit.
40. **Audio commit:** `feat: integrate dynamic audio system and game settings`;
    the final response records the resulting commit ID.
41. **Remaining issues:** synthesized audio is a functional prototype rather than
    production music; the current roster has no catapult entity; SFX category
    loudness still needs a human listening pass on speakers and headphones; and
    `npm audit` reports one moderate and one high development-dependency advisory.
42. **Asset priority:** first produce one coherent battle-low/high musical family,
    then melee/ranged/impact/fortress-warning SFX, then menu/preparation, UI,
    construction/capture, and finally victory/defeat stings. Every file needs
    explicit source and license metadata before `missingAsset` is disabled.

## Reproduction

```bash
cd /data/projects/game_project1
npm run build
npm test
npm run test:e2e
```

Durable browser evidence is in `artifacts/audio-integration/`. Playwright's
ephemeral `test-results/` directory is not part of the commit.
