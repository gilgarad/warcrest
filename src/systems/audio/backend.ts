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
  readonly contextState: string;
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
  playSfxVoice(asset: SfxAssetDef, volume: number, pitchMultiplier: number, pan?: number): VoiceHandle;
  destroy(): void;
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

  get contextState(): string {
    return this.ctx?.state ?? "not-created";
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
    return this.playSynthScore(ctx, asset, volume, fadeInMs);
  }

  playWarningLayer(volume: number): VoiceHandle {
    const ctx = this.requireCtx();
    return this.playSynthPulseLayer(ctx, volume);
  }

  playSfxVoice(asset: SfxAssetDef, volume: number, pitchMultiplier: number, pan = 0): VoiceHandle {
    const ctx = this.requireCtx();
    if (!asset.missingAsset) {
      return this.playFileOneShot(asset.filePath, volume, pan);
    }
    return this.playSynthOneShot(ctx, asset.synth, volume, pitchMultiplier, pan);
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

  private playFileOneShot(path: string, volume: number, pan: number): VoiceHandle {
    const ctx = this.requireCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    gainNode.connect(panner);
    panner.connect(ctx.destination);
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

  private playSynthScore(ctx: AudioContext, asset: BgmAssetDef, volume: number, fadeInMs = 500): VoiceHandle {
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + Math.max(0.05, fadeInMs / 1000));

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = asset.id === "bgm.battle.high" ? 1700 : asset.id === "bgm.victory" ? 2300 : 1100;
    filter.Q.value = 0.55;
    filter.connect(master);

    const profile = this.getScoreProfile(asset.id, asset.synth.frequency);
    const sources = new Set<OscillatorNode>();
    let nextStepAt = ctx.currentTime + 0.05;
    let step = 0;
    let playing = true;

    const scheduleAhead = () => {
      if (!playing) return;
      const horizon = ctx.currentTime + 0.8;
      while (nextStepAt < horizon && (asset.loop || step < profile.phraseSteps)) {
        this.scheduleScoreStep(ctx, filter, sources, profile, nextStepAt, step);
        nextStepAt += profile.beatSec;
        step += 1;
      }
    };

    scheduleAhead();
    const schedulerId = asset.loop ? setInterval(scheduleAhead, 120) : null;
    const completionId = asset.loop
      ? null
      : setTimeout(() => {
          playing = false;
        }, (profile.beatSec * profile.phraseSteps + 1.2) * 1000);

    return {
      get isPlaying() {
        return playing;
      },
      setVolume(v: number) {
        master.gain.setTargetAtTime(v, ctx.currentTime, 0.08);
      },
      stop(fadeMs = 500) {
        playing = false;
        if (schedulerId !== null) clearInterval(schedulerId);
        if (completionId !== null) clearTimeout(completionId);
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
        setTimeout(() => {
          sources.forEach((source) => {
            try {
              source.stop();
            } catch {
              // already stopped
            }
          });
        }, fadeMs + 60);
      },
    };
  }

  private getScoreProfile(assetId: string, root: number): {
    root: number;
    beatSec: number;
    phraseSteps: number;
    bass: number[];
    lead: number[];
    chord: number[][];
    pulseEvery: number;
  } {
    switch (assetId) {
      case "bgm.menu":
        return { root, beatSec: 0.52, phraseSteps: 16, bass: [0, 0, 5, 3], lead: [12, 14, 15, 10, 12, 7, 10, 14], chord: [[0, 3, 7], [0, 5, 8], [0, 3, 7], [0, 2, 7]], pulseEvery: 0 };
      case "bgm.preparation":
        return { root, beatSec: 0.4, phraseSteps: 16, bass: [0, 3, 5, 7], lead: [7, 10, 12, 10, 14, 12, 10, 7], chord: [[0, 3, 7], [0, 5, 8], [0, 4, 7], [0, 5, 10]], pulseEvery: 4 };
      case "bgm.battle.low":
        return { root, beatSec: 0.32, phraseSteps: 16, bass: [0, 0, 3, 5, 0, 7, 5, 3], lead: [12, 10, 12, 15, 17, 15, 12, 10], chord: [[0, 3, 7], [0, 3, 8], [0, 5, 10], [0, 3, 7]], pulseEvery: 4 };
      case "bgm.battle.high":
        return { root, beatSec: 0.24, phraseSteps: 24, bass: [0, 0, 3, 5, 7, 5, 3, 0], lead: [12, 15, 17, 19, 17, 15, 22, 19], chord: [[0, 3, 7], [0, 5, 8], [0, 3, 10], [0, 5, 10]], pulseEvery: 2 };
      case "bgm.victory":
        return { root, beatSec: 0.34, phraseSteps: 12, bass: [0, 5, 7, 12], lead: [0, 4, 7, 12, 16, 19, 24, 19], chord: [[0, 4, 7], [0, 5, 9], [0, 4, 7], [0, 7, 12]], pulseEvery: 0 };
      default:
        return { root, beatSec: 0.46, phraseSteps: 10, bass: [7, 5, 3, 0], lead: [12, 10, 7, 5, 3, 0, -2, -5], chord: [[0, 3, 7], [0, 3, 8], [0, 2, 7], [0, 3, 6]], pulseEvery: 0 };
    }
  }

  private scheduleScoreStep(
    ctx: AudioContext,
    destination: AudioNode,
    sources: Set<OscillatorNode>,
    profile: ReturnType<WebAudioBackend["getScoreProfile"]>,
    time: number,
    step: number,
  ): void {
    const ratio = (semitones: number) => 2 ** (semitones / 12);
    const scheduleTone = (
      frequency: number,
      duration: number,
      gainValue: number,
      type: OscillatorType,
      attack = 0.025,
    ) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), time + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.onended = () => sources.delete(oscillator);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
      sources.add(oscillator);
    };

    const bassInterval = profile.bass[step % profile.bass.length];
    scheduleTone(profile.root / 2 * ratio(bassInterval), profile.beatSec * 0.92, 0.055, "triangle", 0.04);

    if (step % 2 === 0) {
      const chord = profile.chord[Math.floor(step / 4) % profile.chord.length];
      chord.forEach((interval, index) => {
        scheduleTone(profile.root * ratio(interval), profile.beatSec * 2.8, 0.018 / (index + 1), "sine", 0.09);
      });
      const leadInterval = profile.lead[step % profile.lead.length];
      scheduleTone(profile.root * ratio(leadInterval), profile.beatSec * 0.72, 0.028, "triangle", 0.012);
    }

    if (profile.pulseEvery > 0 && step % profile.pulseEvery === profile.pulseEvery - 1) {
      scheduleTone(profile.root * 2, profile.beatSec * 0.24, 0.012, "square", 0.004);
    }
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
    pitchMultiplier: number,
    pan: number,
  ): VoiceHandle {
    const durationS = Math.max(0.05, profile.durationMs / 1000);
    const g = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    g.connect(panner);
    panner.connect(ctx.destination);
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
