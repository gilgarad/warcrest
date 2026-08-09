"""Offline procedural synthesis for weapon-archetype combat SFX.

Renders real .mp3 files for the 20 weapon-archetype "attack/hit/fire/
projectileHit" sfx ids used by `src/systems/lane-units/weaponSfx.ts`, to
replace the live Web Audio synth fallback in
`src/systems/audio/assetManifest.ts` (see NO_ASSET_YET / missingAsset).

Same DSP building blocks as the live synth (noise bursts + filtered
oscillators + envelopes), but rendered offline with numpy/scipy so each
sound can layer more detail (multi-partial metallic rings, crack+body+tail
gunshot structure, algorithmic room-tail) than a real-time Web Audio graph
comfortably affords, without any runtime cost.

Usage: python3 tools/audio-synth/render_combat_sfx.py
Output: public/assets/audio/sfx/combat-<event>-<archetype>.mp3
"""

import os

import lameenc
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
OUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "public", "assets", "audio", "sfx"
)

rng = np.random.default_rng(20260808)


def ms(n_ms):
    return int(SR * n_ms / 1000)


def white_noise(n):
    return rng.uniform(-1.0, 1.0, n)


def _sos(kind, freq, order=4):
    freq = np.clip(freq, 20, SR / 2 - 100)
    return butter(order, freq, btype=kind, fs=SR, output="sos")


def lowpass(x, cutoff, order=4):
    return sosfilt(_sos("low", cutoff, order), x)


def highpass(x, cutoff, order=4):
    return sosfilt(_sos("high", cutoff, order), x)


def bandpass(x, low, high, order=4):
    low = np.clip(low, 20, SR / 2 - 200)
    high = np.clip(high, low + 50, SR / 2 - 50)
    sos = butter(order, [low, high], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x)


def exp_decay(n, tau_ms, delay_ms=0):
    t = np.arange(n) / SR * 1000.0
    env = np.exp(-np.clip(t - delay_ms, 0, None) / max(1e-6, tau_ms))
    env[t < delay_ms] = 0.0
    return env


def sine_burst(freq_start, n, tau_ms, freq_end=None, delay_ms=0):
    t = np.arange(n) / SR
    if freq_end is not None and freq_end != freq_start:
        k = np.log(max(1.0, freq_end) / max(1.0, freq_start))
        dur_s = n / SR
        f_t = freq_start * np.exp(k * (t / dur_s))
        phase = 2 * np.pi * np.cumsum(f_t) / SR
    else:
        phase = 2 * np.pi * freq_start * t
    return np.sin(phase) * exp_decay(n, tau_ms, delay_ms)


def place(buf, layer, delay_ms=0):
    offset = ms(delay_ms)
    end = min(len(buf), offset + len(layer))
    if end > offset:
        buf[offset:end] += layer[: end - offset]


def reverb_tail(x, predelay_ms=6, taps=5, spacing_ms=16, decay=0.52, lp_hz=3200, wet=0.22):
    """Cheap algorithmic "open field" tail: a handful of decaying, lowpassed
    echoes standing in for battlefield reflections (same idea as backend.ts's
    live delay+feedback slapback, just rendered as discrete taps offline)."""
    tail_extra = ms(predelay_ms + taps * spacing_ms + 220)
    out = np.zeros(len(x) + tail_extra)
    out[: len(x)] = x
    tap_bed = np.zeros_like(out)
    for i in range(taps):
        gain = decay ** (i + 1)
        place(tap_bed, x * gain, predelay_ms + i * spacing_ms)
    tap_bed = lowpass(tap_bed, lp_hz)
    return out + tap_bed * wet


def crack_transient(n_ms, hp_hz=1800, tau_ms=14, gain=1.0):
    n = ms(n_ms)
    layer = highpass(white_noise(n), hp_hz) * exp_decay(n, tau_ms)
    return layer * gain


def noise_body(n_ms, low_hz, high_hz, tau_ms, gain=1.0, delay_ms=0):
    n = ms(n_ms)
    layer = bandpass(white_noise(n), low_hz, high_hz) * exp_decay(n, tau_ms)
    return layer * gain


def low_thump(freq, n_ms, tau_ms, gain=1.0, freq_end=None, delay_ms=0):
    n = ms(n_ms)
    return sine_burst(freq, n, tau_ms, freq_end) * gain


def whoosh_sweep(n_ms, low_hz, high_hz, tau_ms, gain=0.6, reverse=False):
    n = ms(n_ms)
    noise = white_noise(n)
    # Sweep the bandpass center across the duration by chunking (cheap
    # time-varying filter): good enough for a short SFX, no chunk seams
    # audible under the exponential envelope taper.
    chunks = 8
    out = np.zeros(n)
    for c in range(chunks):
        a, b = int(n * c / chunks), int(n * (c + 1) / chunks)
        prog = c / max(1, chunks - 1)
        if reverse:
            prog = 1 - prog
        center = low_hz + (high_hz - low_hz) * prog
        seg = bandpass(noise[a:b], max(20, center - center * 0.35), center + center * 0.35)
        out[a:b] = seg
    return out * exp_decay(n, tau_ms) * gain


def metallic_clang(n_ms, base_freq, tau_ms, partials=(1.0, 1.98, 3.02, 4.51, 5.9), gain=1.0):
    n = ms(n_ms)
    out = np.zeros(n)
    for i, ratio in enumerate(partials):
        detune = 1 + rng.uniform(-0.01, 0.01)
        amp = gain * (0.55 ** i)
        out += sine_burst(base_freq * ratio * detune, n, tau_ms * (1.1 - i * 0.08), delay_ms=i * 0.6) * amp
    return out


def normalize(x, peak=0.92):
    m = float(np.max(np.abs(x))) if len(x) else 0.0
    if m < 1e-9:
        return x
    return x / m * peak


def save_mp3(x, name):
    x = np.clip(x, -1.0, 1.0)
    pcm16 = (x * 32767.0).astype(np.int16)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(128)
    encoder.set_in_sample_rate(SR)
    encoder.set_channels(1)
    encoder.set_quality(2)
    data = encoder.encode(pcm16.tobytes())
    data += encoder.flush()
    path = os.path.join(OUT_DIR, f"{name}.mp3")
    with open(path, "wb") as f:
        f.write(data)
    print(f"wrote {path} ({len(x) / SR * 1000:.0f}ms)")


# ---- per-archetype recipes ------------------------------------------------

def render_melee_attack_blunt():
    n = ms(170)
    buf = np.zeros(n)
    place(buf, whoosh_sweep(150, 500, 150, tau_ms=90, gain=0.55))
    place(buf, low_thump(90, 90, 40, gain=0.18), 60)
    save_mp3(normalize(buf), "combat-meleeAttack-blunt")


def render_melee_attack_blade():
    n = ms(130)
    buf = np.zeros(n)
    place(buf, whoosh_sweep(120, 1300, 2600, tau_ms=55, gain=0.62))
    save_mp3(normalize(buf), "combat-meleeAttack-blade")


def render_melee_attack_polearm():
    n = ms(105)
    buf = np.zeros(n)
    place(buf, whoosh_sweep(95, 1700, 3100, tau_ms=42, gain=0.6))
    place(buf, crack_transient(20, hp_hz=3500, tau_ms=8, gain=0.25), 80)
    save_mp3(normalize(buf), "combat-meleeAttack-polearm")


def render_melee_attack_mechanized():
    n = ms(150)
    buf = np.zeros(n)
    place(buf, whoosh_sweep(130, 700, 1900, tau_ms=70, gain=0.5))
    for i in range(3):
        place(buf, crack_transient(10, hp_hz=2500, tau_ms=6, gain=0.14), 40 + i * 22)
    save_mp3(normalize(buf), "combat-meleeAttack-mechanized")


def render_melee_hit_blunt():
    n = ms(260)
    buf = np.zeros(n)
    place(buf, crack_transient(20, hp_hz=1500, tau_ms=10, gain=0.55))
    place(buf, low_thump(140, 180, 90, gain=0.85, freq_end=95), 4)
    place(buf, noise_body(150, 90, 900, tau_ms=70, gain=0.32), 6)
    save_mp3(normalize(buf), "combat-meleeHit-blunt")


def render_melee_hit_blade():
    n = ms(340)
    buf = np.zeros(n)
    place(buf, crack_transient(14, hp_hz=3000, tau_ms=6, gain=0.55))
    place(buf, metallic_clang(320, 340, tau_ms=160, gain=0.62))
    place(buf, metallic_clang(300, 335, tau_ms=140, gain=0.32), 22)
    buf = reverb_tail(buf, taps=5, spacing_ms=18, decay=0.5, wet=0.2)
    save_mp3(normalize(buf), "combat-meleeHit-blade")


def render_melee_hit_polearm():
    n = ms(300)
    buf = np.zeros(n)
    place(buf, crack_transient(12, hp_hz=3800, tau_ms=5, gain=0.5))
    place(buf, metallic_clang(260, 460, tau_ms=110, partials=(1.0, 2.4, 3.6, 5.1), gain=0.5))
    place(buf, low_thump(140, 120, 55, gain=0.28, freq_end=100), 8)
    buf = reverb_tail(buf, taps=4, spacing_ms=15, decay=0.45, wet=0.16)
    save_mp3(normalize(buf), "combat-meleeHit-polearm")


def render_melee_hit_mechanized():
    n = ms(360)
    buf = np.zeros(n)
    place(buf, crack_transient(16, hp_hz=2200, tau_ms=8, gain=0.5))
    place(buf, metallic_clang(280, 300, tau_ms=180, partials=(1.0, 1.9, 2.7, 3.6), gain=0.55))
    for i in range(4):
        place(buf, crack_transient(8, hp_hz=3000, tau_ms=4, gain=0.12), 40 + i * 26)
    buf = reverb_tail(buf, taps=5, spacing_ms=20, decay=0.48, wet=0.18)
    save_mp3(normalize(buf), "combat-meleeHit-mechanized")


def render_ranged_fire_sling():
    n = ms(110)
    buf = np.zeros(n)
    place(buf, crack_transient(22, hp_hz=1200, tau_ms=10, gain=0.6))
    place(buf, whoosh_sweep(90, 900, 250, tau_ms=45, gain=0.35, reverse=True), 6)
    save_mp3(normalize(buf), "combat-rangedFire-sling")


def render_ranged_fire_bow():
    n = ms(95)
    buf = np.zeros(n)
    place(buf, sine_burst(660, n, tau_ms=45, freq_end=520) * 0.7)
    place(buf, crack_transient(12, hp_hz=2000, tau_ms=6, gain=0.3))
    save_mp3(normalize(buf), "combat-rangedFire-bow")


def render_ranged_fire_musket():
    n = ms(220)
    buf = np.zeros(n)
    place(buf, crack_transient(18, hp_hz=1400, tau_ms=9, gain=0.65))
    place(buf, low_thump(140, 60, 25, gain=0.4))
    place(buf, noise_body(200, 300, 2400, tau_ms=130, gain=0.4), 5)
    save_mp3(normalize(buf), "combat-rangedFire-musket")


def render_ranged_fire_rifle():
    n = ms(170)
    buf = np.zeros(n)
    place(buf, crack_transient(10, hp_hz=2200, tau_ms=5, gain=0.85))
    place(buf, low_thump(120, 45, 18, gain=0.5))
    place(buf, noise_body(120, 500, 4200, tau_ms=35, gain=0.4))
    buf = reverb_tail(buf, taps=3, spacing_ms=20, decay=0.35, wet=0.14, lp_hz=2500)
    save_mp3(normalize(buf), "combat-rangedFire-rifle")


def render_ranged_fire_cannon():
    n = ms(420)
    buf = np.zeros(n)
    place(buf, crack_transient(24, hp_hz=900, tau_ms=12, gain=0.7))
    place(buf, low_thump(78, 320, 150, gain=0.9, freq_end=45))
    place(buf, noise_body(380, 40, 900, tau_ms=220, gain=0.55), 8)
    buf = reverb_tail(buf, taps=6, spacing_ms=30, decay=0.55, wet=0.3, lp_hz=1800)
    save_mp3(normalize(buf), "combat-rangedFire-cannon")


def render_ranged_fire_tank():
    n = ms(460)
    buf = np.zeros(n)
    place(buf, crack_transient(26, hp_hz=700, tau_ms=14, gain=0.7))
    place(buf, low_thump(58, 380, 190, gain=1.0, freq_end=32))
    place(buf, noise_body(420, 35, 700, tau_ms=260, gain=0.6), 10)
    place(buf, metallic_clang(150, 220, tau_ms=60, partials=(1.0, 2.1), gain=0.12), 60)
    buf = reverb_tail(buf, taps=6, spacing_ms=32, decay=0.58, wet=0.32, lp_hz=1500)
    save_mp3(normalize(buf), "combat-rangedFire-tank")


def render_projectile_hit_sling():
    n = ms(220)
    buf = np.zeros(n)
    place(buf, crack_transient(16, hp_hz=2000, tau_ms=8, gain=0.55))
    place(buf, low_thump(160, 140, 55, gain=0.4, freq_end=110), 3)
    place(buf, noise_body(120, 80, 600, tau_ms=55, gain=0.28), 5)
    save_mp3(normalize(buf), "combat-projectileHit-sling")


def render_projectile_hit_bow():
    n = ms(140)
    buf = np.zeros(n)
    place(buf, low_thump(190, 90, 35, gain=0.6, freq_end=140))
    place(buf, noise_body(90, 1200, 5200, tau_ms=30, gain=0.35), 3)
    save_mp3(normalize(buf), "combat-projectileHit-bow")


def render_projectile_hit_musket():
    n = ms(180)
    buf = np.zeros(n)
    place(buf, crack_transient(14, hp_hz=1600, tau_ms=7, gain=0.5))
    place(buf, low_thump(130, 130, 60, gain=0.55, freq_end=95), 3)
    save_mp3(normalize(buf), "combat-projectileHit-musket")


def render_projectile_hit_rifle():
    n = ms(140)
    buf = np.zeros(n)
    place(buf, crack_transient(10, hp_hz=2400, tau_ms=6, gain=0.6))
    place(buf, low_thump(150, 95, 40, gain=0.5, freq_end=110), 2)
    save_mp3(normalize(buf), "combat-projectileHit-rifle")


def render_projectile_hit_cannon():
    n = ms(440)
    buf = np.zeros(n)
    place(buf, crack_transient(22, hp_hz=1000, tau_ms=11, gain=0.68))
    place(buf, low_thump(68, 340, 160, gain=0.95, freq_end=38))
    place(buf, noise_body(400, 40, 1100, tau_ms=230, gain=0.6), 8)
    buf = reverb_tail(buf, taps=6, spacing_ms=28, decay=0.55, wet=0.28, lp_hz=1700)
    save_mp3(normalize(buf), "combat-projectileHit-cannon")


def render_projectile_hit_tank():
    n = ms(480)
    buf = np.zeros(n)
    place(buf, crack_transient(24, hp_hz=800, tau_ms=13, gain=0.68))
    place(buf, low_thump(55, 400, 200, gain=1.0, freq_end=30))
    place(buf, noise_body(440, 32, 850, tau_ms=270, gain=0.65), 10)
    buf = reverb_tail(buf, taps=6, spacing_ms=34, decay=0.58, wet=0.32, lp_hz=1400)
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
