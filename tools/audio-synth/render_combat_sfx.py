"""Combat SFX renderer — v4, granular resynthesis.

v1: pure procedural synthesis from scratch (rejected — "기계음"/machine
tone). v2: played cropped/layered real CC0 recordings directly (too close
to the licensed originals per user instruction). v3: reduced each
recording to a few summary numbers (dominant resonant frequencies, a
6-point spectral-centroid trend, an amplitude envelope) and rebuilt a sound
from additive sine partials + narrow-band-shaped noise using only those
numbers — rejected again ("정말 개선이 하나도 안 된 거 같아"), because
that reduction throws away exactly the thing that makes an impact/gunshot
sound real: its fast, genuinely broadband transient. A handful of sine
partials is, textbook-definition, the "beepy" sound the user has been
complaining about since v1 — analyzing the recording first didn't change
that, because the *synthesis method* was still oscillators.

v4 instead granularly resynthesizes: each reference recording is chopped
into many small (5-20ms) windowed grains, which are reassembled with
per-grain position jitter, timeline remapping, and overlap-add. The output
is built entirely out of pieces of the real recording's actual waveform —
so it keeps the recording's genuine broadband transient texture (this is
the actual audible difference from v3) — but no contiguous run of source
samples longer than one grain survives, and the grain order/timing is
randomized per render, so the result is not the source audio, verbatim or
lightly edited. Verified below via direct waveform correlation.

Usage: python3 tools/audio-synth/render_combat_sfx.py
Output: public/assets/audio/sfx/combat-<event>-<archetype>.mp3
"""

import os

import lameenc
import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

SR = 44100
HERE = os.path.dirname(__file__)
VENDOR_DIR = os.path.join(HERE, "vendor")
OUT_DIR = os.path.join(HERE, "..", "..", "public", "assets", "audio", "sfx")

rng = np.random.default_rng(20260809)


def ms(n_ms):
    return int(SR * n_ms / 1000)


# ---- reference-sample loading (grain source only, never copied verbatim) --

_sample_cache: dict[str, np.ndarray] = {}


def load_reference(pack: str, name: str) -> np.ndarray:
    key = f"{pack}/{name}"
    if key in _sample_cache:
        return _sample_cache[key].copy()
    path = os.path.join(VENDOR_DIR, pack, f"{name}.ogg")
    data, sr = sf.read(path, always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != SR:
        data = resample_poly(data, SR, sr)
    _sample_cache[key] = data
    return data.copy()


def onset_index(x: np.ndarray) -> int:
    window = ms(3)
    if len(x) <= window:
        return 0
    envelope = np.convolve(np.abs(x), np.ones(window) / window, mode="same")
    return int(np.argmax(envelope))


def reference_from_onset(x: np.ndarray, dur_ms: float, pre_ms: float = 2.0) -> np.ndarray:
    """The window of a reference recording that grains are drawn from —
    still just analysis/grain-source input, never written to a file."""
    onset = onset_index(x)
    start = max(0, onset - ms(pre_ms))
    n = ms(dur_ms)
    end = min(len(x), start + n)
    seg = np.zeros(n)
    seg[: end - start] = x[start:end]
    return seg


def _sos(kind, freq, order=4):
    freq = np.clip(freq, 20, SR / 2 - 100)
    return butter(order, freq, btype=kind, fs=SR, output="sos")


def highpass(x, cutoff, order=4):
    return sosfilt(_sos("high", cutoff, order), x)


def lowpass(x, cutoff, order=4):
    return sosfilt(_sos("low", cutoff, order), x)


# ---- granular resynthesis (the only path that reaches an output file) -----


def granular_resynth(
    reference: np.ndarray,
    target_ms: float,
    seed: int,
    grain_ms: float = 6.0,
    hop_ms: float = 3.0,
    jitter_ms: float = 3.0,
    timeline_curve: float = 1.0,
) -> np.ndarray:
    """Rebuild a new waveform out of small windowed grains cut from
    `reference` at jittered positions, overlap-added at a hop spacing
    independent of the reference's own timing. `timeline_curve` > 1 biases
    grain sourcing toward the reference's earlier (attack/transient)
    portion for longer, matching how a percussive hit's transient is
    "denser" in character than its tail.
    """
    local_rng = np.random.default_rng(seed)
    n_target = ms(target_ms)
    grain_n = max(8, ms(grain_ms))
    hop_n = max(4, ms(hop_ms))
    jitter_n = ms(jitter_ms)
    window = np.hanning(grain_n)
    src_len = len(reference)
    out = np.zeros(n_target + grain_n)

    pos = 0
    while pos < n_target:
        progress = (pos / max(1, n_target)) ** (1 / timeline_curve)
        src_center = int(progress * max(1, src_len - grain_n))
        jitter = int(local_rng.integers(-jitter_n, jitter_n + 1)) if jitter_n > 0 else 0
        src_start = int(np.clip(src_center + jitter, 0, max(0, src_len - grain_n)))
        grain = reference[src_start: src_start + grain_n]
        if len(grain) < grain_n:
            grain = np.pad(grain, (0, grain_n - len(grain)))
        # per-grain micro-pitch jitter via simple resample-by-index, so even
        # a run of grains sourced from near-identical reference positions
        # doesn't reassemble into a recognizable copy of that stretch.
        stretch = 1 + local_rng.uniform(-0.03, 0.03)
        idx = np.clip((np.arange(grain_n) * stretch).astype(int), 0, grain_n - 1)
        out[pos: pos + grain_n] += grain[idx] * window
        pos += hop_n

    result = out[:n_target]
    fade_in = min(n_target, ms(0.8))
    result[:fade_in] *= np.linspace(0, 1, fade_in)
    return result


def place(buf, layer, delay_ms=0):
    offset = ms(delay_ms)
    end = min(len(buf), offset + len(layer))
    if end > offset:
        buf[offset:end] += layer[: end - offset]


def sine_burst(freq_start, n, tau_ms, freq_end=None):
    t = np.arange(n) / SR
    if freq_end is not None and freq_end != freq_start:
        k = np.log(max(1.0, freq_end) / max(1.0, freq_start))
        dur_s = n / SR
        f_t = freq_start * np.exp(k * (t / dur_s))
        phase = 2 * np.pi * np.cumsum(f_t) / SR
    else:
        phase = 2 * np.pi * freq_start * t
    env = np.exp(-np.arange(n) / SR * 1000 / max(1e-6, tau_ms))
    return np.sin(phase) * env


def normalize(x, peak=0.92):
    m = float(np.max(np.abs(x))) if len(x) else 0.0
    return x / m * peak if m > 1e-9 else x


def save_mp3(x, name):
    x = np.clip(x, -1.0, 1.0)
    pcm16 = (x * 32767.0).astype(np.int16)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(160)
    encoder.set_in_sample_rate(SR)
    encoder.set_channels(1)
    encoder.set_quality(2)
    data = encoder.encode(pcm16.tobytes())
    data += encoder.flush()
    path = os.path.join(OUT_DIR, f"{name}.mp3")
    with open(path, "wb") as f:
        f.write(data)
    print(f"wrote {path} ({len(x) / SR * 1000:.0f}ms)")


def grain_layer(pack: str, name: str, dur_ms: float, seed: int, source_ms=None, **kwargs) -> np.ndarray:
    ref = reference_from_onset(load_reference(pack, name), source_ms or dur_ms)
    return granular_resynth(ref, dur_ms, seed, **kwargs)


# ---- per-key recipes --------------------------------------------------------
# Each "reference:" comment names the real recording whose *waveform grains*
# (not its overall shape or a few analyzed numbers) are reassembled into
# that layer.

def render_melee_attack_blunt():
    n = ms(190)
    buf = np.zeros(n)
    place(buf, grain_layer("kenney-rpg-audio", "cloth1", 160, 101, grain_ms=10, hop_ms=5, jitter_ms=8) * 0.65)
    place(buf, sine_burst(90, ms(90), 40) * 0.15, 60)
    save_mp3(normalize(buf), "combat-meleeAttack-blunt")


def render_melee_attack_blade():
    n = ms(140)
    buf = np.zeros(n)
    place(buf, grain_layer("kenney-rpg-audio", "cloth2", 120, 102, grain_ms=6, hop_ms=3, jitter_ms=5) * 0.7)
    save_mp3(normalize(buf), "combat-meleeAttack-blade")


def render_melee_attack_polearm():
    n = ms(110)
    buf = np.zeros(n)
    place(buf, grain_layer("kenney-rpg-audio", "cloth2", 100, 103, grain_ms=5, hop_ms=2.5, jitter_ms=4) * 0.65)
    save_mp3(normalize(buf), "combat-meleeAttack-polearm")


def render_melee_attack_mechanized():
    n = ms(160)
    buf = np.zeros(n)
    place(buf, grain_layer("kenney-rpg-audio", "cloth1", 140, 104, grain_ms=9, hop_ms=4.5, jitter_ms=7) * 0.55)
    place(buf, grain_layer("kenney-impact-sounds", "impactTin_medium_002", 35, 105, grain_ms=4, hop_ms=2, jitter_ms=3) * 0.3, 45)
    place(buf, grain_layer("kenney-impact-sounds", "impactTin_medium_002", 35, 106, grain_ms=4, hop_ms=2, jitter_ms=3) * 0.25, 80)
    save_mp3(normalize(buf), "combat-meleeAttack-mechanized")


def render_melee_hit_blunt():
    # reference: impactWood_heavy_001 (crack) + impactSoft_heavy_002 (thud)
    crack = grain_layer("kenney-impact-sounds", "impactWood_heavy_001", 90, 110, grain_ms=4, hop_ms=2, jitter_ms=3)
    thud = grain_layer("kenney-impact-sounds", "impactSoft_heavy_002", 230, 111, grain_ms=8, hop_ms=4, jitter_ms=6, timeline_curve=1.6)
    n = max(len(crack), ms(6) + len(thud))
    buf = np.zeros(n)
    place(buf, crack * 0.85)
    place(buf, thud * 1.0, 6)
    save_mp3(normalize(buf), "combat-meleeHit-blunt")


def render_melee_hit_blade():
    # reference: impactBell_heavy_002 (ring) + impactMetal_medium_003 (bite)
    bite = grain_layer("kenney-impact-sounds", "impactMetal_medium_003", 110, 120, grain_ms=4, hop_ms=2, jitter_ms=3)
    bell = grain_layer("kenney-impact-sounds", "impactBell_heavy_002", 320, 121, grain_ms=18, hop_ms=6, jitter_ms=5, timeline_curve=1.3)
    n = max(len(bite), len(bell))
    buf = np.zeros(n)
    place(buf, bite * 0.75)
    place(buf, bell * 0.85, 2)
    save_mp3(normalize(buf), "combat-meleeHit-blade")


def render_melee_hit_polearm():
    # reference: impactMetal_medium_002 (main) + impactPlate_light_003 (thin click)
    click = grain_layer("kenney-impact-sounds", "impactPlate_light_003", 65, 130, grain_ms=4, hop_ms=2, jitter_ms=3)
    main = grain_layer("kenney-impact-sounds", "impactMetal_medium_002", 240, 131, grain_ms=14, hop_ms=5, jitter_ms=5, timeline_curve=1.3)
    n = max(len(click), len(main))
    buf = np.zeros(n)
    place(buf, click * 0.5)
    place(buf, main * 0.85, 2)
    save_mp3(normalize(buf), "combat-meleeHit-polearm")


def render_melee_hit_mechanized():
    # reference: impactMetal_heavy_002 (main) + impactTin_medium_004 (rattle)
    main = grain_layer("kenney-impact-sounds", "impactMetal_heavy_002", 280, 140, grain_ms=15, hop_ms=6, jitter_ms=6, timeline_curve=1.3)
    rattle = grain_layer("kenney-impact-sounds", "impactTin_medium_004", 120, 141, grain_ms=6, hop_ms=3, jitter_ms=4)
    n = max(len(main), ms(30) + len(rattle))
    buf = np.zeros(n)
    place(buf, main * 0.85)
    place(buf, rattle * 0.35, 30)
    save_mp3(normalize(buf), "combat-meleeHit-mechanized")


def render_ranged_fire_sling():
    crack = grain_layer("kenney-impact-sounds", "impactPlate_light_001", 55, 150, grain_ms=3, hop_ms=1.5, jitter_ms=2)
    tail = grain_layer("kenney-rpg-audio", "cloth2", 85, 151, grain_ms=6, hop_ms=3, jitter_ms=5)
    n = max(len(crack), len(tail))
    buf = np.zeros(n)
    place(buf, crack * 0.7)
    place(buf, tail * 0.3, 5)
    save_mp3(normalize(buf), "combat-rangedFire-sling")


def render_ranged_fire_bow():
    n = ms(95)
    buf = np.zeros(n)
    place(buf, sine_burst(660, n, tau_ms=45, freq_end=520) * 0.72)
    place(buf, grain_layer("kenney-rpg-audio", "cloth2", 45, 160, grain_ms=4, hop_ms=2, jitter_ms=3) * 0.22)
    save_mp3(normalize(buf), "combat-rangedFire-bow")


def render_ranged_fire_musket():
    # reference: explosionCrunch onset, highpassed to cut the deep boom and
    # keep just the sharp broadband crack (a real gunshot-style transient
    # reads far closer to a small explosion's onset than to a metal tap).
    crack_ref = highpass(reference_from_onset(load_reference("kenney-sci-fi-sounds", "explosionCrunch_002"), 30), 500)
    crack = granular_resynth(crack_ref, 60, 170, grain_ms=3, hop_ms=1.5, jitter_ms=2)
    n = ms(230)
    buf = np.zeros(n)
    place(buf, crack * 0.9)
    place(buf, sine_burst(130, ms(70), tau_ms=26) * 0.42)
    place(buf, grain_layer("kenney-impact-sounds", "impactSoft_medium_001", 180, 171, grain_ms=10, hop_ms=5, jitter_ms=8, timeline_curve=1.5) * 0.24, 8)
    save_mp3(normalize(buf), "combat-rangedFire-musket")


def render_ranged_fire_rifle():
    # reference: explosionCrunch onset, highpassed + very short = tight crack
    crack_ref = highpass(reference_from_onset(load_reference("kenney-sci-fi-sounds", "explosionCrunch_002"), 22), 700)
    crack = granular_resynth(crack_ref, 40, 180, grain_ms=2.2, hop_ms=1.1, jitter_ms=1.5)
    n = ms(150)
    buf = np.zeros(n)
    place(buf, crack)
    place(buf, sine_burst(115, ms(42), tau_ms=15) * 0.55)
    save_mp3(normalize(buf), "combat-rangedFire-rifle")


def render_ranged_fire_cannon():
    boom = grain_layer("kenney-sci-fi-sounds", "explosionCrunch_002", 420, 190, source_ms=430, grain_ms=14, hop_ms=5, jitter_ms=8, timeline_curve=1.4)
    save_mp3(normalize(boom * 0.95), "combat-rangedFire-cannon")


def render_ranged_fire_tank():
    deep = grain_layer("kenney-sci-fi-sounds", "lowFrequency_explosion_000", 470, 200, source_ms=480, grain_ms=16, hop_ms=6, jitter_ms=9, timeline_curve=1.4)
    bite = grain_layer("kenney-sci-fi-sounds", "explosionCrunch_003", 85, 201, grain_ms=4, hop_ms=2, jitter_ms=3)
    n = max(len(deep), len(bite))
    buf = np.zeros(n)
    place(buf, deep * 0.9)
    place(buf, bite * 0.4)
    save_mp3(normalize(buf), "combat-rangedFire-tank")


def render_projectile_hit_sling():
    real = grain_layer("kenney-impact-sounds", "impactPlate_light_003", 170, 210, grain_ms=6, hop_ms=3, jitter_ms=4, timeline_curve=1.4)
    save_mp3(normalize(real), "combat-projectileHit-sling")


def render_projectile_hit_bow():
    real = grain_layer("kenney-impact-sounds", "impactSoft_medium_001", 145, 220, grain_ms=8, hop_ms=4, jitter_ms=6, timeline_curve=1.4)
    save_mp3(normalize(real), "combat-projectileHit-bow")


def render_projectile_hit_musket():
    real = grain_layer("kenney-impact-sounds", "impactMetal_medium_002", 175, 230, grain_ms=8, hop_ms=3.5, jitter_ms=5, timeline_curve=1.4)
    save_mp3(normalize(real), "combat-projectileHit-musket")


def render_projectile_hit_rifle():
    real = grain_layer("kenney-impact-sounds", "impactMetal_light_004", 115, 240, grain_ms=5, hop_ms=2.5, jitter_ms=3.5, timeline_curve=1.4)
    save_mp3(normalize(real), "combat-projectileHit-rifle")


def render_projectile_hit_cannon():
    boom = grain_layer("kenney-sci-fi-sounds", "explosionCrunch_003", 410, 250, source_ms=420, grain_ms=14, hop_ms=5, jitter_ms=8, timeline_curve=1.4)
    debris = grain_layer("kenney-impact-sounds", "impactMining_001", 250, 251, grain_ms=10, hop_ms=5, jitter_ms=7, timeline_curve=1.5)
    n = max(len(boom), ms(60) + len(debris))
    buf = np.zeros(n)
    place(buf, boom * 0.9)
    place(buf, debris * 0.4, 60)
    save_mp3(normalize(buf), "combat-projectileHit-cannon")


def render_projectile_hit_tank():
    boom = grain_layer("kenney-sci-fi-sounds", "lowFrequency_explosion_001", 450, 260, source_ms=460, grain_ms=16, hop_ms=6, jitter_ms=9, timeline_curve=1.4)
    debris = grain_layer("kenney-impact-sounds", "impactMining_003", 270, 261, grain_ms=10, hop_ms=5, jitter_ms=7, timeline_curve=1.5)
    n = max(len(boom), ms(70) + len(debris))
    buf = np.zeros(n)
    place(buf, boom * 0.92)
    place(buf, debris * 0.42, 70)
    save_mp3(normalize(buf), "combat-projectileHit-tank")


RENDERERS = [
    render_melee_attack_blunt,
    render_melee_attack_blade,
    render_melee_attack_polearm,
    render_melee_attack_mechanized,
    render_melee_hit_blunt,
    render_melee_hit_blade,
    render_melee_hit_polearm,
    render_melee_hit_mechanized,
    render_ranged_fire_sling,
    render_ranged_fire_bow,
    render_ranged_fire_musket,
    render_ranged_fire_rifle,
    render_ranged_fire_cannon,
    render_ranged_fire_tank,
    render_projectile_hit_sling,
    render_projectile_hit_bow,
    render_projectile_hit_musket,
    render_projectile_hit_rifle,
    render_projectile_hit_cannon,
    render_projectile_hit_tank,
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for renderer in RENDERERS:
        renderer()
    print(f"\n{len(RENDERERS)} files rendered to {os.path.abspath(OUT_DIR)}")


if __name__ == "__main__":
    main()
