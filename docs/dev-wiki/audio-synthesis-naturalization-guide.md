# Audio Synthesis Naturalization Guide

Written 2026-07-30 by the consulting session (`stock_predict_rev` harness,
`game_project1`-only scope, source unmodified) after the user reported that
both BGM and SFX read as "기계음적" (mechanical/robotic) even after the
combat SFX weapon-variety pass landed. This document grounds the fix in
actual sound-design research rather than guesswork, so the audio track can
apply named, sourced techniques instead of vague "make it warmer" direction.

## Why pure oscillator synthesis reads as robotic

Sounds built from a single (or few) clean oscillator(s) with a hard on/off
envelope are exactly what a synthesizer produces by default — and that
default is what listeners recognize as "artificial." Real-world impacts,
weapon hits, and vocalizations are never a single clean tone: they carry
broadband noise at the transient, multiple overlapping harmonics that are
never perfectly in tune with each other, and irregular decay. Procedural
audio research is explicit that **"randomization in any way the synth can
do it" is what prevents mechanical, repetitive results** — the artificiality
comes from a sound being too clean and too identical every time it plays,
not from the fact that it's synthesized at all (many well-regarded modern
games — see the "100% synthesized SFX" case below — sound completely
organic despite using zero recorded samples).

## Concrete techniques, grounded in sourced research

### 1. Detune and layer oscillators instead of using one clean tone

A repeatedly cited synthesis pattern: take a small set of oscillators with
chosen waveforms, and **detune them slightly against each other** (a few
Hz to a few percent) so they beat/interfere naturally instead of producing
one sterile pitch. Asymmetric waveforms (sine mixed with saw, for example)
add tonal variation on top of this.

### 2. Give impacts a noise transient, not just a pitched body

Real hits (blade, blunt, impact) have a burst of broadband noise exactly at
the moment of contact, which a pure oscillator tone cannot reproduce.
Vertical-impulse / transient synthesis specifically targets "the rapid
onset and decay times that contribute to the immediacy and impact of
natural sounds." Concretely: layer a short, filtered noise burst under/over
the existing oscillator tone at the attack, then let the oscillator carry
the tonal body through the decay.

### 3. Use multi-stage envelopes, not flat ADSR

A simple attack/decay/sustain/release with straight-line segments still
reads as synthetic. Multi-stage envelope generators — routing an envelope
into filter cutoff as well as amplitude, so the *timbre* evolves during the
sound, not just the loudness — is called out specifically as one of the
differentiators between amateur and convincing synthesized SFX.

### 4. Randomize every repeat instance

Sample-and-glide random modulation (quick random value generation applied
per playback) is named as the direct fix for "mechanical, repetitive"
results. This project's `assetManifest.ts` already has
`pitchVariation`/`volumeVariation` parameters on some SFX defs — the guidance
is to use these more aggressively and consistently across all combat SFX,
not just the newest ones, and to consider adding a similar per-instance
randomization to filter cutoff/noise-burst character too, not just pitch and
volume.

### 5. Glue layered components together with light compression/crosstalk

When a sound is built from multiple layers (oscillator + noise + filter),
running the combined signal through a compressor "mashes together" the
components so they read as one cohesive sound rather than audibly separate
parts. This is directly applicable to this project's existing
`connectLayer`/noise-buffer plumbing in `backend.ts`.

### 6. Vocalizations (grunt / attack shout): use formant-style filtering, not a flat tone

This is the most specific, directly relevant finding: **modern well-regarded
games (Bastion, Celeste) synthesize character vocalizations using parametric
EQ on oscillators to shape formants** — the resonant frequency bands that
make a sound read as "a mouth/vocal tract" rather than "a beep." A vocal
sound is fundamentally a pitched source (vocal cords) filtered by a small
number of moving resonant peaks (the mouth/throat shape). For
`sfx.combat.unitHit` / `unitDeath` / `attackShout`, replacing (or layering
onto) the current single-tone `grunt` kind with 2-3 band-pass filter peaks
whose center frequencies shift slightly during the sound will read far more
like an actual voice than a pure pitch envelope. A rasp/distortion layer on
the source tone can additionally suggest strain/effort, which is the
documented technique for signaling damage or exertion in character voices.

### 7. Same layering discipline this project already proved out for BGM

`docs/dev-wiki/music-style-brief.md` already documents a working multi-layer
structure for BGM (ostinato / bass / harmony / low-color / lead /
counterline layers, state-driven layer add/remove). That the BGM already
reads better than the SFX is consistent with the research above — layering
is precisely the mechanism that avoids the "one clean oscillator" problem.
The fix for SFX is to bring the same *number and kind* of layers (tone +
noise + filter movement + per-instance randomization) into the much shorter
one-shot SFX case, not to invent a new synthesis approach.

## What NOT to do

- Do not attempt to record or source real audio samples — this project has
  no audio generation/recording tool confirmed available, and the existing
  synth-fallback architecture is deliberate (see `docs/dev-wiki/
  audio-system-prototype.md`). All of the above techniques are achievable
  with Web Audio API oscillators, `BiquadFilterNode`, `createBufferSource`
  (noise), and `DynamicsCompressorNode` — no new dependencies needed.
- Do not rewrite `backend.ts`'s synthesis architecture from scratch. Extend
  the existing `kind` system (`blade`, `impact`, `pluck`, `grunt`, `chime`,
  `noiseHit`, `sweepUp`, `sweepDown`) with the techniques above.
- Do not re-compose the BGM's melodies/harmony — only its *texture* (adding
  the same kind of per-note/per-layer randomization and analog-emulation
  imperfection) is in scope, per the user's own framing ("질감만 다듬어라").

## Applied status (2026-07-30)

The audio track applied the guide directly in `src/systems/audio/backend.ts`.
The diagnosis below reflects the **pre-fix** state of each synth `kind`,
followed by the concrete changes that landed in the naturalization pass.

| Kind | Already present before fix | Missing before fix | Applied in this pass |
| --- | --- | --- | --- |
| `blade` | 2 noise layering, 4 per-instance randomness | 1 detuned stack, 3 filter-envelope motion, 5 compressor glue, 6 n/a | Added short filtered attack burst + secondary noise tail, 3-osc detuned stack, moving filter envelope, master compressor glue |
| `impact` | 2 noise layering, 4 per-instance randomness | 1 detuned stack, 3 filter-envelope motion, 5 compressor glue, 6 n/a | Added attack transient + body transient separation, detuned oscillator stack, stronger cutoff sweep, master compressor glue |
| `pluck` | 1 light layer pair, 4 asset pitch/volume variation | 2 explicit transient burst, 3 filter-envelope motion, 5 compressor glue, 6 n/a | Added short highpassed noise click, filter-envelope motion, detuned harmonic support, master compressor glue |
| `grunt` | 1 limited layer pair, 2 light noise breath, 4 some variation | 3 richer envelope motion, 5 compressor glue, 6 formant filtering with moving peaks | Replaced flat-tone body with moving 3-formant bandpass stack, rasp/distortion support, breath noise, compressor glue |
| `chime` | 1 multi-note layering, 4 incidental variation | 2 transient sparkle, 3 filter-envelope motion, 5 compressor glue, 6 n/a | Added subtle detune/filter motion and routed through the same glued one-shot chain |
| `noiseHit` | 2 pure noise body, 4 random noise sample content | 1 tonal layering, 3 filter-envelope motion, 5 compressor glue, 6 n/a | Kept as noise-first but gave it cutoff motion and glued output path |
| `sweepUp` | 1 single oscillator body | 2 transient layer, 3 filter-envelope motion, 4 stronger variation, 5 compressor glue, 6 n/a | Added transient noise hiss, moving filter envelope, detuned stack, compressor glue |
| `sweepDown` | 1 single oscillator body | 2 transient layer, 3 filter-envelope motion, 4 stronger variation, 5 compressor glue, 6 n/a | Added transient throw noise, moving filter envelope, detuned stack, compressor glue |

### Concrete code locations

- `scheduleTone()`:
  subtle BGM note naturalization through detuned dual-osc scheduling and
  evolving low-pass filter envelopes.
- `scheduleNoise()`:
  deterministic per-instance noise generation with moving cutoff and
  multi-stage gain decay.
- `playSynthOneShot()`:
  one-shot compressor glue, richer layer envelopes, filter-envelope motion,
  detuned oscillator stacks, and new `scheduleFormantVoice()` for vocal SFX.

### Result summary

- Combat SFX no longer rely on a single sterile oscillator body per hit; each
  family now has an explicit transient/body/glue structure.
- `grunt`-based reaction and attack-vocal sounds now read more like voiced
  exertion than a flat synth beep because the resonance peaks move during the
  sound instead of staying fixed.
- BGM was not re-composed, but its note events now carry slight detune and
  timbral motion so sustained layers feel less static over time.

## Round 2 (2026-07-30): specific per-SFX corrections from user listening feedback

The user listened to the applied pass via `tools/audio-browser/` and reported
three concrete problems. This section adds sourced, targeted fixes for each —
do not just re-apply round 1's generic techniques again, the gaps are
specific.

### `sfx.combat.attackShout` — plays no sound at all

This is a **bug, not a design gap**. `scheduleFormantVoice()` should produce
audible output the same as `sfx.combat.unitHit`/`unitDeath` (same `grunt`
kind). Investigate: cooldown/`maxSimultaneous` gating in `playSynthOneShot()`
possibly suppressing playback when triggered from the standalone
`tools/audio-browser/` page (no game-loop context ticking cooldown state
forward), a zero/negative gain or duration edge case specific to
`attackShout`'s parameters (`frequency: 235, durationMs: 125`), or an
exception being silently swallowed. Add a console warning/error path if the
scheduler bails out silently, so this class of bug is visible next time
instead of just "no sound."

### `sfx.combat.bluntAttack` — needs to read as a heavier "퍽!" thud, not a thin hit

Real punch/blunt-impact sound design is described as combining **a sharp
attack transient with a separate, deeper low-frequency "bloom"** — the two
are not the same layer. The current `impact` kind's body oscillator
(`baseFreq * 1.45 -> baseFreq * 0.46`) decays across the *entire* duration
window, which reads as one thin sweep rather than "crack + separately-timed
thud." Concretely: keep the existing sharp noise transient for the crack,
but add a **second, lower-pitched sine/triangle layer that starts up to
~20-30ms after the transient, sits an octave or more below the current body
oscillator, and decays more slowly** — this is the "low body thud" that
research specifically calls out as separate from the initial crack. Increase
low-pass cutoff darkness on this layer (less high-frequency content = more
"weight," per the punch-sound source's force/pitch relationship: harder
hits are sharper at the transient, but the *sustained* part should stay
low and dull, not bright).

### `sfx.combat.bowFire` — sounds like a UI click ("통통통"), not an arrow shot

Root cause found in code: `bowFire` uses the generic `pluck` kind, **the same
synthesis as `sfx.ui.hover`/`sfx.ui.confirm`** (`backend.ts` `case "pluck"`).
A UI button blip and a bowstring release are not the same sound and should
not share a kind. Bow/arrow sound design is consistently described as two
distinct layered elements: **a sharp taut-string "twang"** (a short,
high-Q, fast-decaying resonant pitch — a real string does this, not a soft
triangle-wave pluck) **plus a rushing "whoosh" of the arrow through air**
(a band-pass-swept noise layer moving from high to lower frequency across
the sound's duration, distinct from the twang's transient). Give
`bowFire` its own `kind` (or a distinct code path) with: (1) a high-Q
bandpass "string" resonance around the current base frequency that decays
fast (not a full-duration tone like the current pluck body), and (2) a
noise layer swept through a bandpass filter to simulate the arrow's air
whoosh, timed to start at or just after the twang and last longer than it.
Do not reuse the UI `pluck` kind for this — that's exactly why it currently
sounds like a menu click.

## Sources

- [Procedural Audio On the Web: Part One — Medium/Nemisindo](https://medium.com/@nemisindo/procedural-audio-on-the-web-part-one-77c6d464378e)
- [Developing game audio with the Web Audio API — web.dev](https://web.dev/articles/webaudio-games)
- [100% Synthesized SFX for Stylized Realism in Games — designingsound.org](https://designingsound.org/2014/10/02/100-synthesized-sfx-for-stylized-realism-in-games/)
- [How To Design Supreme Sci-Fi Weapon Sound Effects — A Sound Effect](https://www.asoundeffect.com/supreme-scifi-weapon-sound-effects/)
- [How to Recreate Gaming Audio's Top 5 Vocal Effects — Voquent](https://www.voquent.com/blog/how-to-recreate-gaming-audios-top-5-vocal-effects/)
- [How procedural audio brings sounds to life in video games — Splice blog](https://splice.com/blog/procedural-audio-video-games/)
- [The Ultimate Guide to the Impact Sound Effect — SFX Engine](https://sfxengine.com/blog/impact-sound-effect)
- [Unveiling The Science Behind Creating Realistic Punch Sound Effects — SoundCy](https://soundcy.com/article/how-punch-sounds-are-made)
- [Twang — Wikipedia](https://en.wikipedia.org/wiki/Twang)
- [Bow-and-arrow Sound Effects — SFX Engine](https://sfxengine.com/sound-effects/bow-and-arrow)
