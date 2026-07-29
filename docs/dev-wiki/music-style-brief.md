# Warcrest Music Style Brief

Date: 2026-07-29
Status: second-cycle Day 1 brief; no new music produced in this step

## 1. Goal and boundary

Warcrest needs a thicker, more deliberate original score while retaining its
existing procedural audio architecture. The target is solemn, martial, and
progressively more urgent, using the structural language of classic RTS music:
a percussion ostinato, bass and harmonic bed, and a sparse lead motif that
accumulate with game intensity.

This brief does not authorize imitation. No Warcraft, StarCraft, or other
existing melody, recognizable contour, bass line, chord sequence, or
"slightly changed" theme may be used. All pitch and rhythmic material must be
new. Reference material informs orchestration density, phrase pacing, and
state layering only.

## 2. Implementation path

The implementation remains internal and procedural:

- `audioDirector.ts` continues to select game state.
- `bgmManager.ts` continues playback and crossfades.
- `backend.ts` evolves from its current score profile into a multi-voice
  scheduler with simultaneous percussion, bass, harmony, low sustained
  orchestral color, and lead voices.
- No external recording or licensed music is sourced.
- State changes should be quantized to the next beat or bar where practical.
  Existing crossfade safety remains as the fallback.
- The four looping states share a tonal world and motif vocabulary without
  sharing identical phrases. Victory and defeat cues remain unchanged until a
  later, separately approved pass.

## 3. Shared musical grammar

- Meter: primarily `4/4`, with syncopation inside the bar rather than changing
  meter.
- Phrase: `16` bars divided into `4 + 4 + 4 + 4`; statement, variation,
  contrasting answer, and return with altered orchestration.
- Harmony: original modal minor material with open fifths, restrained thirds,
  and occasional suspended tones. Avoid stock heroic fanfare cadences.
- Motif: a newly composed short interval cell, transformed by inversion,
  register, rhythm, and rests. It must remain sparse enough that combat SFX
  read clearly.
- Dynamics: state intensity comes primarily from adding/removing layers,
  register, rhythmic subdivision, and articulation, not merely raising gain.
- Mix: reserve headroom for simultaneous combat SFX. The BGM master should
  peak below `-6 dBFS` in offline validation and avoid sustained limiting.

## 4. State arrangements

| State | Tempo | Percussion ostinato | Bass/harmony | Lead and color | Dynamic target |
| --- | ---: | --- | --- | --- | --- |
| `bgm.menu` | 72 BPM | Low frame drum on sparse half-bar pulses; no continuous snare | Low strings/drone, open fifths changing every 2 bars | Distant low horn and restrained plucked answer; motif appears once per 4 bars | `pp -> mp`, broad and ceremonial |
| `bgm.preparation` | 84 BPM | Muted hand drum and rim pulse in eighth-note cells with rests | Pizzicato low strings under a sustained mid string bed | Horn/woodwind statement in bars 1-4, thinner answer in bars 9-12 | `mp`, purposeful but not yet combative |
| `bgm.battle.low` | 104 BPM | Toms plus dry snare ostinato; alternating strong/weak two-beat cells | Moving bass pulse, low string sustain, restrained brass support | Short horn motif at phrase boundaries; occasional upper-string answer | `mp -> mf`, forward motion with SFX space |
| `bgm.battle.high` | 124 BPM | Full tom/snare layer with sixteenth-note pickup figures, not constant noise | Bass doubled by low brass; denser string harmony and tension pedal | Brass lead plus a separate counterline, entering in alternating 4-bar blocks | `mf -> f`, urgent but with at least `6 dB` headroom |

## 5. Layer behavior

Each state profile schedules independent voices rather than one oscillator
standing in for an ensemble:

1. **Ostinato layer**: shaped noise and pitched drum bodies with separate
   envelopes.
2. **Bass layer**: one low fundamental voice plus a quieter transient or
   harmonic reinforcement.
3. **Harmony layer**: sustained string-like voices with slow attack and
   voice-leading that avoids every chord restarting together.
4. **Low color layer**: filtered brass/string sustain that provides weight
   without masking the bass.
5. **Lead layer**: sparse motif notes with phrase-aware rests.
6. **Counterline layer**: enabled only in `battle-high`, alternating with the
   lead rather than doubling it continuously.

The scheduler must support deterministic phrase seeds for repeatable tests.
Layer gains and filter cutoff are state parameters; the current single global
low-pass choice must not be the sole source of perceived intensity.

## 6. Transition and validation contract

- `menu -> preparation`: preserve low sustain while percussion enters at the
  next bar.
- `preparation -> battle-low`: retain tonal center, replace preparation pulse
  with the battle ostinato, then introduce the lead after one bar.
- `battle-low <-> battle-high`: share phrase position where possible. High
  intensity adds percussion subdivision, bass reinforcement, and counterline;
  returning low removes layers instead of restarting the composition.
- Validate with `OfflineAudioContext`: non-zero RMS per required layer,
  aggregate RMS above the audible threshold, peak below clipping, and energy in
  low/mid bands.
- Validate by listening in Audio Lab at menu, sparse battle, and crowded
  battle SFX loads. A state flag alone is not acceptance evidence.

## 7. Day 2 checkpoint

Day 2 produces one actual arrangement for `bgm.battle.low`. It is the best
checkpoint because it contains the core ostinato, bass/harmony, low color, and
lead layers without hiding problems behind the maximum-density high state.
The deliverable includes a deterministic offline render/capture, RMS and peak
measurements, and an in-game transition from preparation. Other states remain
unchanged until this arrangement is approved.
