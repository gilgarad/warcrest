import type { BgmAssetDef, SfxAssetDef } from "./types";

/**
 * Small interface BgmManager/SfxManager depend on instead of touching Web
 * Audio directly — lets unit tests inject a mock backend instead of a real
 * AudioContext. `WebAudioBackend` (this file) is the real implementation;
 * see `__tests__/*.test.ts` for the mock.
 */
export interface VoiceHandle {
  stop(fadeMs?: number): void;
  setVolume(volume: number): void;
  readonly isPlaying: boolean;
}

export interface AudioBackend {
  readonly nowMs: number;
  isUnlocked(): boolean;
  unlock(): Promise<void>;
  /**
   * Loops until stopped. Uses the real file if `asset.missingAsset` is
   * false, else a synthesized fallback. `fadeInMs` (default 0) ramps gain
   * from 0 internally — callers never need their own fade-in timer.
   */
  playBgmVoice(asset: BgmAssetDef, volume: number, fadeInMs?: number): VoiceHandle;
  /** A supplementary loop layered on top of the current BGM (e.g. a fortress warning sting), independent of the main track. */
  playWarningLayer(volume: number): VoiceHandle;
  /** One-shot. */
  playSfxVoice(asset: SfxAssetDef, volume: number, pitchMultiplier: number): VoiceHandle;
  destroy(): void;
}

function padDetunesCents(profile: { kind: string }): number[] {
  return profile.kind === "chime" ? [0, 400, 700] : [0, 5, -6];
}

/**
 * Real backend: Web Audio API. Independent of `musicController.ts` — no
 * shared state, no import from it — so it can't regress the music that
 * scenes are currently calling directly.
 */
export class WebAudioBackend implements AudioBackend {
  private ctx: AudioContext | null = null;
  private unlocked = false;

  get nowMs(): number {
    return this.ctx ? this.ctx.currentTime * 1000 : performance.now();
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.unlocked = this.ctx.state === "running";
  }

  private requireCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  playBgmVoice(asset: BgmAssetDef, volume: number, fadeInMs = 0): VoiceHandle {
    const ctx = this.requireCtx();
    // Real-file playback path (kept ready for when public/assets/audio/*
    // actually exist — see docs/dev-wiki/audio-system-prototype.md).
    if (!asset.missingAsset) {
      return this.playFileLoop(asset.filePath, volume, asset.loop, fadeInMs);
    }
    return this.playSynthPadLoop(ctx, asset.synth, volume, fadeInMs);
  }

  playWarningLayer(volume: number): VoiceHandle {
    const ctx = this.requireCtx();
    return this.playSynthPulseLayer(ctx, volume);
  }

  playSfxVoice(asset: SfxAssetDef, volume: number, pitchMultiplier: number): VoiceHandle {
    const ctx = this.requireCtx();
    if (!asset.missingAsset) {
      return this.playFileOneShot(asset.filePath, volume);
    }
    return this.playSynthOneShot(ctx, asset.synth, volume, pitchMultiplier);
  }

  destroy(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.unlocked = false;
  }

  // ---- real-file playback (dormant until real assets exist) ---------------

  private fileBufferCache = new Map<string, Promise<AudioBuffer | null>>();

  private async loadBuffer(ctx: AudioContext, path: string): Promise<AudioBuffer | null> {
    let cached = this.fileBufferCache.get(path);
    if (!cached) {
      cached = fetch(path)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((buf) => ctx.decodeAudioData(buf))
        .catch(() => null);
      this.fileBufferCache.set(path, cached);
    }
    return cached;
  }

  private playFileLoop(path: string, volume: number, loop: boolean, fadeInMs = 0): VoiceHandle {
    const ctx = this.requireCtx();
    const gainNode = ctx.createGain();
    if (fadeInMs > 0) {
      gainNode.gain.value = 0;
      gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeInMs / 1000);
    } else {
      gainNode.gain.value = volume;
    }
    gainNode.connect(ctx.destination);
    let source: AudioBufferSourceNode | null = null;
    let playing = true;

    void this.loadBuffer(ctx, path).then((buffer) => {
      if (!playing || !buffer) return;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.connect(gainNode);
      source.start();
    });

    return {
      get isPlaying() {
        return playing;
      },
      setVolume(v: number) {
        gainNode.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
      },
      stop(fadeMs = 300) {
        playing = false;
        const t = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(t);
        gainNode.gain.setValueAtTime(gainNode.gain.value, t);
        gainNode.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
        setTimeout(() => {
          try {
            source?.stop();
          } catch {
            // already stopped
          }
        }, fadeMs + 30);
      },
    };
  }

  private playFileOneShot(path: string, volume: number): VoiceHandle {
    const ctx = this.requireCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(ctx.destination);
    let playing = true;
    void this.loadBuffer(ctx, path).then((buffer) => {
      if (!buffer) {
        playing = false;
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.onended = () => {
        playing = false;
      };
      source.start();
    });
    return {
      get isPlaying() {
        return playing;
      },
      setVolume(v: number) {
        gainNode.gain.value = v;
      },
      stop() {
        playing = false;
      },
    };
  }

  // ---- synthesized fallback voices ----------------------------------------

  private playSynthPadLoop(ctx: AudioContext, profile: BgmAssetDef["synth"], volume: number, fadeInMs = 500): VoiceHandle {
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + Math.max(0.05, fadeInMs / 1000));

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = profile.kind === "chime" ? 2200 : 850;
    filter.connect(master);

    const oscs: OscillatorNode[] = [];
    padDetunesCents(profile).forEach((cents) => {
      const osc = ctx.createOscillator();
      osc.type = profile.kind === "chime" ? "sine" : "sawtooth";
      osc.frequency.value = profile.frequency;
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start();
      oscs.push(osc);
    });

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    let playing = true;
    return {
      get isPlaying() {
        return playing;
      },
      setVolume(v: number) {
        master.gain.setTargetAtTime(v, ctx.currentTime, 0.08);
      },
      stop(fadeMs = 500) {
        playing = false;
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
        setTimeout(() => {
          oscs.forEach((o) => {
            try {
              o.stop();
            } catch {
              // already stopped
            }
          });
          try {
            lfo.stop();
          } catch {
            // already stopped
          }
        }, fadeMs + 60);
      },
    };
  }

  private playSynthPulseLayer(ctx: AudioContext, volume: number): VoiceHandle {
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    let playing = true;

    const fireStinger = () => {
      if (!playing) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    };

    fireStinger();
    const intervalId = setInterval(fireStinger, 1400);

    return {
      get isPlaying() {
        return playing;
      },
      setVolume(v: number) {
        master.gain.value = v;
      },
      stop() {
        playing = false;
        clearInterval(intervalId);
      },
    };
  }

  private playSynthOneShot(
    ctx: AudioContext,
    profile: SfxAssetDef["synth"],
    volume: number,
    pitchMultiplier: number
  ): VoiceHandle {
    const durationS = Math.max(0.05, profile.durationMs / 1000);
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const baseFreq = profile.frequency * pitchMultiplier;
    const t0 = ctx.currentTime;
    let node: AudioScheduledSourceNode;

    if (profile.kind === "noiseHit") {
      const bufferSize = Math.floor(ctx.sampleRate * durationS);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = baseFreq;
      noise.connect(filter);
      filter.connect(g);
      node = noise;
    } else {
      const osc = ctx.createOscillator();
      osc.type = profile.kind === "chime" ? "sine" : profile.kind === "pluck" ? "triangle" : "square";
      osc.frequency.setValueAtTime(baseFreq, t0);
      if (profile.kind === "sweepUp") osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, t0 + durationS);
      if (profile.kind === "sweepDown") osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t0 + durationS);
      osc.connect(g);
      node = osc;
    }

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), t0 + Math.min(0.02, durationS * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationS);

    node.start();
    node.stop(t0 + durationS + 0.02);

    let playing = true;
    setTimeout(() => {
      playing = false;
    }, (durationS + 0.02) * 1000);

    return {
      get isPlaying() {
        return playing;
      },
      setVolume(v: number) {
        g.gain.value = v;
      },
      stop() {
        playing = false;
        try {
          node.stop();
        } catch {
          // already stopped
        }
      },
    };
  }
}
