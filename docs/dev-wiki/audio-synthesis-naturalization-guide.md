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

## Status (2026-08-07 업데이트)

- 적용 완료: `backend.ts`에 마스터 `DynamicsCompressorNode` 글루 스테이지 추가
  (기법 5), `impact`/`blade` 노이즈 레이어에 필터 컷오프 스윕(`endFrequency`)
  적용(기법 3), `grunt`에 3번째 포먼트 밴드패스 피크 추가 + 세 피크 모두
  재생 중 중심 주파수가 이동하도록 변경(기법 6), 병종/시대별 무기 아키타입
  (`src/systems/lane-units/weaponSfx.ts`)에 따라 근접(둔기/도검/폴암/근대
  돌격)·원거리(투석/활/화승총/소총/대포/전차) 타격음을 분화해 매핑.
- `pitchVariation`/`volumeVariation`(기법 4)은 재확인 결과 `assetManifest.ts`
  의 `sfx()` 헬퍼가 기본값 `0.06`/`0.08`을 모든 SFX에 이미 부여하고
  있었음 — 이전 세션 기록의 "heal에만 있음"은 부정확했고, 실제로는 전투
  SFX가 heal(override `0.025`)보다 더 큰 기본 변주를 이미 받고 있었다.
  정정: 추가 조치 불필요.
- 남은 항목: `sfx.combat.towerAttack`/`towerHit`(방어 타워 발사음)과
  `sfx.support.heal`은 이번 라운드에서 손대지 않음 — 타워는 참조 유닛
  아키타입 매핑이 아직 안 걸려 있고, 힐 사운드는 사용자가 이미 만족한
  BGM과 유사한 레이어링 기법을 쓰고 있어 우선순위가 낮다고 판단.

## Sources

- [Procedural Audio On the Web: Part One — Medium/Nemisindo](https://medium.com/@nemisindo/procedural-audio-on-the-web-part-one-77c6d464378e)
- [Developing game audio with the Web Audio API — web.dev](https://web.dev/articles/webaudio-games)
- [100% Synthesized SFX for Stylized Realism in Games — designingsound.org](https://designingsound.org/2014/10/02/100-synthesized-sfx-for-stylized-realism-in-games/)
- [How To Design Supreme Sci-Fi Weapon Sound Effects — A Sound Effect](https://www.asoundeffect.com/supreme-scifi-weapon-sound-effects/)
- [How to Recreate Gaming Audio's Top 5 Vocal Effects — Voquent](https://www.voquent.com/blog/how-to-recreate-gaming-audios-top-5-vocal-effects/)
- [How procedural audio brings sounds to life in video games — Splice blog](https://splice.com/blog/procedural-audio-video-games/)
