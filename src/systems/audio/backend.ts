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

export interface AudioSignalMeasurement {
  rms: number;
  peak: number;
  frameRms: number[];
  waveform: number[];
  contextState: string;
}

export interface OfflineArrangementMeasurement {
  durationMs: number;
  mix: Pick<AudioSignalMeasurement, "rms" | "peak">;
  layers: Record<string, Pick<AudioSignalMeasurement, "rms" | "peak">>;
}

type ArrangementLayer = "percussion" | "bass" | "harmony" | "lowColor" | "lead" | "counterline";

/** Biquad filter spec for a synth layer; `endFrequency` ramps cutoff across the layer's duration for a natural, non-static timbre. */
type LayerFilter = { type: BiquadFilterType; frequency: number; endFrequency?: number; q?: number };

interface ArrangementProfile {
  assetId: "bgm.menu" | "bgm.preparation" | "bgm.battle.low" | "bgm.battle.high";
  root: number;
  beatSec: number;
  phraseSteps: number;
  filterCutoff: number;
  bassLine: readonly number[];
  chordPlan: ReadonlyArray<readonly number[]>;
  leadPlan: Readonly<Record<number, readonly number[]>>;
  counterPlan?: Readonly<Record<number, readonly number[]>>;
  sectionGains: readonly number[];
  harmonyEveryBars: number;
  lowColorEveryBars: number;
  percussionStyle: "menu" | "preparation" | "battle-low" | "battle-high";
  bassStyle: "sparse" | "march" | "pulse" | "driving";
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
  measureOutputSignal(durationMs?: number): Promise<AudioSignalMeasurement>;
  measureOfflineArrangement?(assetId: string, durationMs?: number): Promise<OfflineArrangementMeasurement | null>;
  destroy(): void;
}

/**
 * Real backend: Web Audio API. Independent of `musicController.ts` — no
 * shared state, no import from it — so it can't regress the music that
 * scenes are currently calling directly.
 */
export class WebAudioBackend implements AudioBackend {
  private ctx: AudioContext | null = null;
  private outputBus: GainNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
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

  private getOutputDestination(ctx: AudioContext): AudioNode {
    if (!this.outputBus || !this.outputAnalyser) {
      this.outputBus = ctx.createGain();
      this.outputBus.gain.value = 1;
      this.outputAnalyser = ctx.createAnalyser();
      this.outputAnalyser.fftSize = 2048;
      this.outputAnalyser.smoothingTimeConstant = 0;
      this.outputBus.connect(this.outputAnalyser);
      this.outputAnalyser.connect(ctx.destination);
    }
    return this.outputBus;
  }

  async measureOutputSignal(durationMs = 1000): Promise<AudioSignalMeasurement> {
    const ctx = this.requireCtx();
    this.getOutputDestination(ctx);
    const analyser = this.outputAnalyser;
    if (!analyser) throw new Error("Audio output analyser is unavailable");
    const samples = new Float32Array(analyser.fftSize);
    const frameRms: number[] = [];
    const waveform: number[] = [];
    let sumSquares = 0;
    let sampleCount = 0;
    let peak = 0;
    const deadline = performance.now() + Math.max(100, durationMs);
    while (performance.now() < deadline) {
      analyser.getFloatTimeDomainData(samples);
      let frameSquares = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const value = samples[index];
        frameSquares += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      sumSquares += frameSquares;
      sampleCount += samples.length;
      frameRms.push(Math.sqrt(frameSquares / samples.length));
      if (waveform.length === 0) {
        const stride = Math.max(1, Math.floor(samples.length / 128));
        for (let index = 0; index < samples.length; index += stride) waveform.push(samples[index]);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 32));
    }
    return {
      rms: sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0,
      peak,
      frameRms,
      waveform,
      contextState: ctx.state,
    };
  }

  async measureOfflineArrangement(assetId: string, durationMs = 8000): Promise<OfflineArrangementMeasurement | null> {
    const profile = this.getArrangementProfile(assetId);
    if (!profile) return null;
    const layerIds: ArrangementLayer[] = profile.counterPlan
      ? ["percussion", "bass", "harmony", "lowColor", "lead", "counterline"]
      : ["percussion", "bass", "harmony", "lowColor", "lead"];
    const measureLayer = async (
      layer: ArrangementLayer | "mix",
    ): Promise<Pick<AudioSignalMeasurement, "rms" | "peak">> => {
      const context = new OfflineAudioContext(1, Math.ceil(48_000 * (durationMs / 1000)), 48_000);
      const destination = context.createGain();
      destination.gain.value = 1;
      destination.connect(context.destination);
      const sources = new Set<AudioScheduledSourceNode>();
      let step = 0;
      let nextAt = 0.05;
      while (nextAt < durationMs / 1000) {
        this.scheduleArrangementStep(
          context,
          destination,
          sources,
          profile,
          nextAt,
          step,
          layer,
        );
        nextAt += profile.beatSec;
        step = (step + 1) % profile.phraseSteps;
      }
      const rendered = await context.startRendering();
      const samples = rendered.getChannelData(0);
      let sumSquares = 0;
      let peak = 0;
      for (const value of samples) {
        sumSquares += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      return {
        rms: Math.sqrt(sumSquares / Math.max(1, samples.length)),
        peak,
      };
    };
    return {
      durationMs,
      mix: await measureLayer("mix"),
      layers: Object.fromEntries(
        await Promise.all(layerIds.map(async (layerId) => [layerId, await measureLayer(layerId)])),
      ),
    };
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
    this.outputBus = null;
    this.outputAnalyser = null;
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
    gainNode.connect(this.getOutputDestination(ctx));
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
    panner.connect(this.getOutputDestination(ctx));
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
    master.connect(this.getOutputDestination(ctx));
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + Math.max(0.05, fadeInMs / 1000));

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const arrangementProfile = this.getArrangementProfile(asset.id);
    filter.frequency.value = arrangementProfile
      ? arrangementProfile.filterCutoff
      : asset.id === "bgm.victory"
        ? 3200
        : 1800;
    filter.Q.value = 0.55;
    filter.connect(master);

    const scoreProfile = arrangementProfile ? null : this.getScoreProfile(asset.id, asset.synth.frequency);
    const sources = new Set<AudioScheduledSourceNode>();
    let nextStepAt = ctx.currentTime + 0.05;
    let step = 0;
    let playing = true;

    const scheduleAhead = () => {
      if (!playing) return;
      const horizon = ctx.currentTime + 0.8;
      while (nextStepAt < horizon && (asset.loop || step < (arrangementProfile?.phraseSteps ?? scoreProfile?.phraseSteps ?? 0))) {
        if (arrangementProfile) {
          this.scheduleArrangementStep(ctx, filter, sources, arrangementProfile, nextStepAt, step, "mix");
        } else {
          this.scheduleScoreStep(ctx, filter, sources, scoreProfile!, nextStepAt, step);
        }
        nextStepAt += arrangementProfile?.beatSec ?? scoreProfile!.beatSec;
        step += 1;
      }
    };

    scheduleAhead();
    const schedulerId = asset.loop ? setInterval(scheduleAhead, 120) : null;
    const completionId = asset.loop
      ? null
      : setTimeout(() => {
          playing = false;
        }, (((arrangementProfile?.beatSec ?? scoreProfile!.beatSec) * (arrangementProfile?.phraseSteps ?? scoreProfile!.phraseSteps)) + 1.2) * 1000);

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

  private getArrangementProfile(assetId: string): ArrangementProfile | null {
    switch (assetId) {
      case "bgm.menu":
        return {
          assetId,
          root: 196,
          beatSec: 60 / 72,
          phraseSteps: 64,
          filterCutoff: 1900,
          bassLine: [0, 0, -2, -2, -5, -5, -3, -3, 0, 0, 2, 2, -2, -2, -5, -3],
          chordPlan: [[0, 7, 10], [-2, 5, 8], [-5, 2, 7], [-3, 4, 7], [0, 7, 12], [2, 7, 10], [-2, 3, 8], [-5, 2, 7]],
          leadPlan: {
            0: [12, 0, 10, 0],
            4: [7, 0, 5, 0],
            8: [12, 0, 14, 0],
            12: [10, 0, 7, 0],
          },
          sectionGains: [0.72, 0.82, 0.94, 1.02],
          harmonyEveryBars: 2,
          lowColorEveryBars: 4,
          percussionStyle: "menu",
          bassStyle: "sparse",
        };
      case "bgm.preparation":
        return {
          assetId,
          root: 174.6,
          beatSec: 60 / 84,
          phraseSteps: 64,
          filterCutoff: 2400,
          bassLine: [0, 0, 3, 3, 5, 5, 7, 7, 0, 3, 5, 7, 8, 7, 5, 3],
          chordPlan: [[0, 3, 7], [3, 7, 10], [5, 8, 12], [7, 10, 14], [0, 3, 8], [3, 7, 12], [5, 10, 14], [7, 12, 15]],
          leadPlan: {
            0: [7, 10, 12, 10],
            4: [14, 12, 15, 14],
            8: [17, 15, 14, 12],
            12: [10, 12, 14, 15],
          },
          sectionGains: [0.84, 0.92, 1.02, 1.12],
          harmonyEveryBars: 2,
          lowColorEveryBars: 4,
          percussionStyle: "preparation",
          bassStyle: "march",
        };
      case "bgm.battle.low":
        return {
          assetId,
          root: 146.8,
          beatSec: 60 / 104,
          phraseSteps: 64,
          filterCutoff: 3200,
          bassLine: [0, 0, -2, 0, 3, 1, -4, -2, 0, 2, 5, 3, -2, 0, 1, -5],
          chordPlan: [[0, 7, 10], [-2, 5, 8], [3, 7, 10], [1, 5, 8], [0, 7, 12], [-4, 3, 8], [2, 5, 10], [-2, 5, 8]],
          leadPlan: {
            0: [12, 15, 14],
            4: [10, 12, 8],
            8: [14, 17, 15],
            12: [12, 10, 7],
          },
          sectionGains: [0.78, 0.92, 1.02, 1.16],
          harmonyEveryBars: 1,
          lowColorEveryBars: 2,
          percussionStyle: "battle-low",
          bassStyle: "pulse",
        };
      case "bgm.battle.high":
        return {
          assetId,
          root: 146.8,
          beatSec: 60 / 124,
          phraseSteps: 64,
          filterCutoff: 4200,
          bassLine: [0, -2, 0, 3, -5, -2, -7, -5, 0, 3, 5, 3, -2, -5, -7, -2],
          chordPlan: [[0, 3, 7], [-2, 2, 7], [-5, 0, 3], [-7, -4, 0], [3, 7, 10], [5, 8, 12], [-2, 3, 7], [0, 3, 8]],
          leadPlan: {
            0: [12, 15, 17, 15],
            4: [14, 17, 19, 17],
            8: [15, 19, 22, 19],
            12: [17, 20, 19, 15],
          },
          counterPlan: {
            2: [7, 10, 12, 10],
            6: [8, 12, 14, 12],
            10: [10, 14, 15, 14],
            14: [12, 15, 17, 15],
          },
          sectionGains: [0.92, 1.04, 1.18, 1.32],
          harmonyEveryBars: 1,
          lowColorEveryBars: 2,
          percussionStyle: "battle-high",
          bassStyle: "driving",
        };
      default:
        return null;
    }
  }

  private getScoreProfile(assetId: string, root: number): {
    assetId: string;
    root: number;
    beatSec: number;
    phraseSteps: number;
    bass: number[];
    lead: number[];
    chord: number[][];
    pulseEvery: number;
    stringsEvery: number;
    brassEvery: number;
    percussionEvery: number;
    tension: number;
  } {
    switch (assetId) {
      case "bgm.menu":
        return {
          assetId,
          root, beatSec: 0.62, phraseSteps: 32,
          bass: [0, 0, -2, -2, -5, -5, -7, -7, 0, 0, 3, -2, -5, -7, -2, 0],
          lead: [12, 10, 7, 5, 3, 5, 7, 10, 12, 15, 14, 10, 7, 5, 3, 2],
          chord: [[0, 3, 7], [-2, 3, 7], [-5, 0, 3], [-7, -2, 2], [0, 3, 8], [3, 7, 10], [-2, 2, 7], [-5, 0, 5]],
          pulseEvery: 0, stringsEvery: 4, brassEvery: 16, percussionEvery: 0, tension: 0.25,
        };
      case "bgm.preparation":
        return {
          assetId,
          root, beatSec: 0.46, phraseSteps: 32,
          bass: [0, 0, 3, 3, 5, 5, 7, 7, 0, 3, 5, 7, 8, 7, 5, 3],
          lead: [7, 10, 12, 10, 14, 12, 15, 14, 17, 15, 14, 12, 10, 12, 14, 15],
          chord: [[0, 3, 7], [3, 7, 10], [5, 8, 12], [7, 10, 14], [0, 3, 8], [3, 7, 12], [5, 10, 14], [7, 12, 15]],
          pulseEvery: 4, stringsEvery: 4, brassEvery: 8, percussionEvery: 8, tension: 0.46,
        };
      case "bgm.battle.low":
        return {
          assetId,
          root, beatSec: 60 / 104, phraseSteps: 64,
          bass: [0, 0, -2, 0, -5, -5, -7, -5, 0, -2, -5, -7, -8, -7, -5, -2],
          lead: [12, 10, 7, 10, 12, 15, 14, 10, 12, 10, 8, 7, 5, 7, 10, 12],
          chord: [[0, 3, 7], [-2, 2, 7], [-5, -2, 3], [-7, -4, 0], [0, 3, 8], [-2, 3, 7], [-5, 0, 3], [-7, -2, 2]],
          pulseEvery: 4, stringsEvery: 4, brassEvery: 8, percussionEvery: 4, tension: 0.68,
        };
      case "bgm.battle.high":
        return {
          assetId,
          root, beatSec: 0.3, phraseSteps: 48,
          bass: [0, -2, 0, 3, -5, -2, -7, -5, 0, 3, 5, 3, -2, -5, -7, -2],
          lead: [12, 15, 14, 19, 17, 15, 22, 19, 15, 17, 19, 22, 20, 19, 17, 14],
          chord: [[0, 3, 7], [-2, 2, 7], [-5, 0, 3], [-7, -4, 0], [3, 7, 10], [5, 8, 12], [-2, 3, 7], [0, 3, 8]],
          pulseEvery: 2, stringsEvery: 2, brassEvery: 4, percussionEvery: 2, tension: 1,
        };
      case "bgm.victory":
        return {
          assetId,
          root, beatSec: 0.38, phraseSteps: 16,
          bass: [0, 5, 7, 12, 5, 7, 12, 12],
          lead: [0, 4, 7, 12, 16, 19, 24, 19, 16, 19, 24, 28, 24, 19, 16, 12],
          chord: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]],
          pulseEvery: 0, stringsEvery: 2, brassEvery: 4, percussionEvery: 4, tension: 0.72,
        };
      default:
        return {
          assetId,
          root, beatSec: 0.5, phraseSteps: 16,
          bass: [7, 5, 3, 0, -2, -5, -7, -12],
          lead: [12, 10, 7, 5, 3, 0, -2, -5, -7, -5, -9, -12],
          chord: [[0, 3, 7], [-2, 3, 7], [-5, 0, 3], [-7, -2, 2]],
          pulseEvery: 0, stringsEvery: 4, brassEvery: 8, percussionEvery: 0, tension: 0.34,
        };
    }
  }

  private scheduleScoreStep(
    ctx: AudioContext,
    destination: AudioNode,
    sources: Set<AudioScheduledSourceNode>,
    profile: ReturnType<WebAudioBackend["getScoreProfile"]>,
    time: number,
    step: number,
  ): void {
    const ratio = (semitones: number) => 2 ** (semitones / 12);
    const orchestrationGain = profile.tension >= 0.95
      ? 2.05
      : profile.tension >= 0.6
        ? 1.7
        : profile.tension >= 0.4
          ? 1.5
          : 1.35;
    const scheduleTone = (
      frequency: number,
      duration: number,
      gainValue: number,
      type: OscillatorType,
      attack = 0.025,
      endFrequency?: number,
    ) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, time);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
      }
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue * orchestrationGain), time + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.onended = () => sources.delete(oscillator);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
      sources.add(oscillator);
    };
    const scheduleNoise = (duration: number, gainValue: number, cutoff: number) => {
      const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      let seed = (step + 1) * 2654435761;
      for (let index = 0; index < samples.length; index += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        samples[index] = ((seed / 0xffffffff) * 2 - 1) * (1 - index / samples.length);
      }
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = cutoff;
      filter.Q.value = 0.7;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), time + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      source.onended = () => sources.delete(source);
      source.start(time);
      source.stop(time + duration + 0.01);
      sources.add(source);
    };

    const phraseStep = step % profile.phraseSteps;
    const section = Math.floor(phraseStep / Math.max(1, profile.phraseSteps / 4));
    const phraseArc = [0.82, 0.96, 1.1, 1.24][section] ?? 1;
    const rise = phraseArc * (1 + section * profile.tension * 0.08);
    const bassInterval = profile.bass[phraseStep % profile.bass.length];
    scheduleTone(profile.root / 4 * ratio(bassInterval), profile.beatSec * 0.96, 0.07 * rise, "triangle", 0.035);
    if (phraseStep % 8 === 0) {
      scheduleTone(profile.root / 8, profile.beatSec * 9.5, 0.032 * rise, "sine", 0.35);
      scheduleTone(profile.root / 4, profile.beatSec * 8.5, 0.014 * rise, "triangle", 0.28);
    }

    if (phraseStep % profile.stringsEvery === 0) {
      const chord = profile.chord[Math.floor(phraseStep / profile.stringsEvery) % profile.chord.length];
      chord.forEach((interval, index) => {
        const chordFrequency = profile.root / 2 * ratio(interval);
        scheduleTone(chordFrequency, profile.beatSec * profile.stringsEvery * 1.35, 0.026 / (index + 1), "sine", 0.18);
        scheduleTone(chordFrequency * 1.002, profile.beatSec * profile.stringsEvery * 1.2, 0.009 / (index + 1), "triangle", 0.22);
      });
    }

    if (phraseStep % 2 === 0 && (section > 0 || profile.tension >= 0.95)) {
      const leadInterval = profile.lead[Math.floor(phraseStep / 2) % profile.lead.length];
      scheduleTone(profile.root * ratio(leadInterval), profile.beatSec * 1.45, 0.022 * rise, "triangle", 0.045);
    }

    if (profile.brassEvery > 0 && section >= 1 && phraseStep % profile.brassEvery === 0) {
      const brassInterval = profile.bass[Math.floor(phraseStep / profile.brassEvery) % profile.bass.length];
      const brassRoot = profile.root / 2 * ratio(brassInterval);
      scheduleTone(brassRoot, profile.beatSec * profile.brassEvery * 0.82, 0.024 * rise, "sawtooth", 0.14);
      scheduleTone(brassRoot * 1.5, profile.beatSec * profile.brassEvery * 0.68, 0.011 * rise, "triangle", 0.12);
    }

    if (profile.percussionEvery > 0 && (section >= 2 || profile.tension >= 0.95) && phraseStep % profile.percussionEvery === 0) {
      const thump = profile.root * (profile.tension >= 0.8 ? 0.72 : 0.58);
      scheduleTone(thump, profile.beatSec * 0.42, 0.038 * profile.tension, "sine", 0.004, thump * 0.44);
      scheduleNoise(profile.beatSec * 0.32, 0.015 * rise, section >= 3 ? 1200 : 760);
    }

    if (profile.pulseEvery > 0 && phraseStep % profile.pulseEvery === profile.pulseEvery - 1) {
      scheduleTone(profile.root * 2, profile.beatSec * 0.22, 0.01 * rise, "square", 0.004);
    }
  }

  private scheduleTone(
    ctx: BaseAudioContext,
    destination: AudioNode,
    sources: Set<AudioScheduledSourceNode>,
    time: number,
    frequency: number,
    duration: number,
    gainValue: number,
    type: OscillatorType,
    attack = 0.025,
    endFrequency?: number,
  ): void {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    }
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.onended = () => sources.delete(oscillator);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    sources.add(oscillator);
  }

  private scheduleNoise(
    ctx: BaseAudioContext,
    destination: AudioNode,
    sources: Set<AudioScheduledSourceNode>,
    time: number,
    step: number,
    duration: number,
    gainValue: number,
    cutoff: number,
  ): void {
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = (step + 1) * 2654435761;
    for (let index = 0; index < samples.length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      samples[index] = ((seed / 0xffffffff) * 2 - 1) * (1 - index / samples.length);
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.onended = () => sources.delete(source);
    source.start(time);
    source.stop(time + duration + 0.01);
    sources.add(source);
  }

  private scheduleArrangementStep(
    ctx: BaseAudioContext,
    destination: AudioNode,
    sources: Set<AudioScheduledSourceNode>,
    profile: ArrangementProfile,
    time: number,
    step: number,
    soloLayer: ArrangementLayer | "mix",
  ): void {
    const ratio = (semitones: number) => 2 ** (semitones / 12);
    const phraseStep = step % profile.phraseSteps;
    const beatInBar = phraseStep % 4;
    const bar = Math.floor(phraseStep / 4);
    const phraseSection = Math.min(
      profile.sectionGains.length - 1,
      Math.floor(bar / Math.max(1, profile.phraseSteps / (profile.sectionGains.length * 4))),
    );
    const sectionGain = profile.sectionGains[phraseSection] ?? 1;
    const allow = (layer: ArrangementLayer): boolean => soloLayer === "mix" || soloLayer === layer;
    const root = profile.root;
    const beatSec = profile.beatSec;

    if (allow("bass")) {
      const bassInterval = profile.bassLine[phraseStep % profile.bassLine.length];
      const bassRoot = root / 4 * ratio(bassInterval);
      switch (profile.bassStyle) {
        case "sparse":
          if (beatInBar === 0 || beatInBar === 2) {
            this.scheduleTone(ctx, destination, sources, time, bassRoot, beatSec * 1.75, 0.055 * sectionGain, "triangle", 0.02, bassRoot * 0.84);
            this.scheduleTone(ctx, destination, sources, time, bassRoot * 2, beatSec * 0.3, 0.016 * sectionGain, "sine", 0.01);
          }
          break;
        case "march":
          this.scheduleTone(ctx, destination, sources, time, bassRoot, beatSec * 0.88, 0.072 * sectionGain, "triangle", 0.012, bassRoot * 0.74);
          if (beatInBar === 1 || beatInBar === 3) {
            this.scheduleTone(ctx, destination, sources, time, bassRoot * 2, beatSec * 0.16, 0.014 * sectionGain, "sine", 0.004);
          }
          break;
        case "driving":
          this.scheduleTone(ctx, destination, sources, time, bassRoot, beatSec * 0.76, 0.1 * sectionGain, "triangle", 0.006, bassRoot * 0.68);
          this.scheduleTone(ctx, destination, sources, time, bassRoot * 2, beatSec * 0.2, 0.036 * sectionGain, "sine", 0.003, bassRoot * 1.55);
          if (beatInBar === 3) {
            this.scheduleTone(ctx, destination, sources, time + beatSec * 0.5, bassRoot * 2.24, beatSec * 0.12, 0.018 * sectionGain, "triangle", 0.003);
          }
          break;
        case "pulse":
        default:
          this.scheduleTone(ctx, destination, sources, time, bassRoot, beatSec * 0.9, 0.088 * sectionGain, "triangle", 0.01, bassRoot * 0.72);
          this.scheduleTone(ctx, destination, sources, time, bassRoot * 2, beatSec * 0.24, 0.032 * sectionGain, "sine", 0.004, bassRoot * 1.6);
          break;
      }
    }

    if (allow("percussion")) {
      switch (profile.percussionStyle) {
        case "menu":
          if (beatInBar === 0 || beatInBar === 2) {
            const drum = beatInBar === 0 ? 84 : 72;
            this.scheduleTone(ctx, destination, sources, time, drum, beatSec * 0.42, 0.03 * sectionGain, "sine", 0.006, drum * 0.52);
            this.scheduleNoise(ctx, destination, sources, time, step, beatSec * 0.1, 0.006 * sectionGain, 380);
          }
          break;
        case "preparation":
          if (beatInBar === 0 || beatInBar === 2) {
            const drum = beatInBar === 0 ? 96 : 78;
            this.scheduleTone(ctx, destination, sources, time, drum, beatSec * 0.3, 0.04 * sectionGain, "sine", 0.005, drum * 0.52);
            this.scheduleNoise(ctx, destination, sources, time, step, beatSec * 0.11, 0.01 * sectionGain, 560);
          }
          if (beatInBar === 1 || beatInBar === 3) {
            this.scheduleNoise(ctx, destination, sources, time + beatSec * 0.08, step + 43, beatSec * 0.08, 0.012 * sectionGain, 2600);
          }
          break;
        case "battle-high":
          this.scheduleTone(ctx, destination, sources, time, beatInBar === 0 || beatInBar === 2 ? 118 : 88, beatSec * 0.24, 0.058 * sectionGain, "sine", 0.003, 56);
          this.scheduleNoise(ctx, destination, sources, time, step, beatSec * 0.12, 0.02 * sectionGain, beatInBar % 2 === 0 ? 520 : 2100);
          this.scheduleNoise(ctx, destination, sources, time + beatSec * 0.055, step + 91, beatSec * 0.12, 0.026 * sectionGain, 2800);
          if (beatInBar === 3) {
            this.scheduleNoise(ctx, destination, sources, time + beatSec * 0.5, step + 137, beatSec * 0.08, 0.015 * sectionGain, 3400);
            this.scheduleTone(ctx, destination, sources, time + beatSec * 0.5, 132, beatSec * 0.14, 0.02 * sectionGain, "triangle", 0.003, 74);
          }
          break;
        case "battle-low":
        default: {
          const tomRoot = beatInBar === 0 || beatInBar === 2 ? 108 : 82;
          this.scheduleTone(ctx, destination, sources, time, tomRoot, beatSec * 0.28, 0.048 * sectionGain, "sine", 0.004, tomRoot * 0.46);
          this.scheduleNoise(ctx, destination, sources, time, step, beatSec * 0.14, 0.014 * sectionGain, beatInBar % 2 === 0 ? 420 : 1800);
          if (beatInBar === 1 || beatInBar === 3) {
            this.scheduleNoise(ctx, destination, sources, time + beatSec * 0.06, step + 91, beatSec * 0.16, 0.024 * sectionGain, 2400);
          }
          if (phraseSection >= 2 && beatInBar === 3) {
            this.scheduleNoise(ctx, destination, sources, time + beatSec * 0.5, step + 137, beatSec * 0.08, 0.012 * sectionGain, 3000);
          }
          break;
        }
      }
    }

    if (allow("harmony") && beatInBar === 0 && bar % profile.harmonyEveryBars === 0) {
      const chord = profile.chordPlan[bar % profile.chordPlan.length];
      chord.forEach((interval, index) => {
        const frequency = root / 2 * ratio(interval);
        const sustain = beatSec * (profile.harmonyEveryBars * 4 - 0.3);
        this.scheduleTone(ctx, destination, sources, time, frequency, sustain, (0.03 - index * 0.006) * sectionGain, "triangle", 0.18);
        this.scheduleTone(ctx, destination, sources, time, frequency * 1.004, sustain * 0.86, (0.012 - index * 0.002) * sectionGain, "sine", 0.24);
      });
    }

    if (allow("lowColor") && beatInBar === 0 && bar % profile.lowColorEveryBars === 0) {
      const chord = profile.chordPlan[bar % profile.chordPlan.length];
      const brassRoot = root / 2 * ratio(chord[0]);
      const sustain = beatSec * (profile.lowColorEveryBars * 4 * 1.8);
      this.scheduleTone(ctx, destination, sources, time, brassRoot, sustain, 0.024 * sectionGain, "sawtooth", 0.32);
      this.scheduleTone(ctx, destination, sources, time, brassRoot * 1.5, sustain * 0.8, 0.011 * sectionGain, "triangle", 0.28);
    }

    if (allow("lead")) {
      const motif = profile.leadPlan[bar];
      if (motif && beatInBar < motif.length) {
        const interval = motif[beatInBar];
        if (interval !== 0) {
          const frequency = root * ratio(interval);
          this.scheduleTone(ctx, destination, sources, time, frequency, beatSec * 0.95, 0.032 * sectionGain, "triangle", 0.04);
          this.scheduleTone(ctx, destination, sources, time, frequency * 0.5, beatSec * 0.78, 0.011 * sectionGain, "sine", 0.03);
        }
      } else if (bar % 4 === 3 && beatInBar === 2) {
        const horn = root * ratio(17);
        this.scheduleTone(ctx, destination, sources, time, horn, beatSec * 1.2, 0.018 * sectionGain, "triangle", 0.05);
      }
    }

    if (allow("counterline") && profile.counterPlan) {
      const motif = profile.counterPlan[bar];
      if (motif && beatInBar < motif.length) {
        const interval = motif[beatInBar];
        if (interval !== 0) {
          const frequency = root * ratio(interval);
          this.scheduleTone(ctx, destination, sources, time, frequency, beatSec * 0.78, 0.018 * sectionGain, "sine", 0.03);
          this.scheduleTone(ctx, destination, sources, time, frequency * 1.5, beatSec * 0.55, 0.008 * sectionGain, "triangle", 0.02);
        }
      }
    }
  }

  private playSynthPulseLayer(ctx: AudioContext, volume: number): VoiceHandle {
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(this.getOutputDestination(ctx));
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
    const master = ctx.createGain();
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20;
    glue.knee.value = 14;
    glue.ratio.value = 4;
    glue.attack.value = 0.003;
    glue.release.value = 0.16;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    master.gain.value = Math.max(0, volume * (profile.gain ?? 1));
    master.connect(glue);
    glue.connect(panner);
    panner.connect(this.getOutputDestination(ctx));

    // Short algorithmic slapback for metal/stone impacts: a couple of
    // decaying, lowpassed delay taps read as "hit landed in an open
    // battlefield/room" instead of a dry, boxed-in synth blip — the same
    // reason real combat foley in RTS games is rarely recorded fully dry.
    let echoTapNodes: AudioNode[] | null = null;
    if (profile.kind === "metalClang" || profile.kind === "stoneImpact") {
      const send = ctx.createGain();
      send.gain.value = 0.3;
      const tapFilter = ctx.createBiquadFilter();
      tapFilter.type = "lowpass";
      tapFilter.frequency.value = profile.kind === "metalClang" ? 3200 : 1400;
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = profile.kind === "metalClang" ? 0.055 : 0.075;
      const feedback = ctx.createGain();
      feedback.gain.value = profile.kind === "metalClang" ? 0.34 : 0.26;
      master.connect(send);
      send.connect(delay);
      delay.connect(tapFilter);
      tapFilter.connect(feedback);
      feedback.connect(delay);
      tapFilter.connect(glue);
      echoTapNodes = [send, tapFilter, delay, feedback];
      // The delay->feedback loop keeps "running" (at a fast-decaying level)
      // indefinitely unless explicitly torn down — disconnect once the tail
      // is well below audibility instead of leaking nodes on every hit.
      setTimeout(() => echoTapNodes?.forEach((node) => node.disconnect()), 1500);
    }
    const baseFreq = profile.frequency * pitchMultiplier;
    const t0 = ctx.currentTime;
    const sources = new Set<AudioScheduledSourceNode>();
    let endAt = t0 + durationS;

    const connectLayer = (
      source: AudioScheduledSourceNode,
      gainValue: number,
      startAt: number,
      stopAt: number,
      attackS: number,
      filter?: LayerFilter,
    ): void => {
      const layerGain = ctx.createGain();
      layerGain.gain.setValueAtTime(0.0001, startAt);
      layerGain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), startAt + attackS);
      layerGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      if (filter) {
        const node = ctx.createBiquadFilter();
        node.type = filter.type;
        node.frequency.setValueAtTime(Math.max(20, filter.frequency), startAt);
        if (filter.endFrequency !== undefined) {
          node.frequency.exponentialRampToValueAtTime(Math.max(20, filter.endFrequency), stopAt);
        }
        node.Q.value = filter.q ?? 0.7;
        source.connect(node);
        node.connect(layerGain);
      } else {
        source.connect(layerGain);
      }
      layerGain.connect(master);
      source.onended = () => sources.delete(source);
      source.start(startAt);
      source.stop(stopAt + 0.02);
      sources.add(source);
      endAt = Math.max(endAt, stopAt + 0.02);
    };

    const scheduleOsc = (
      type: OscillatorType,
      frequency: number,
      endFrequency: number,
      gainValue: number,
      startOffsetS = 0,
      layerDurationS = durationS,
      attackS = 0.008,
      filter?: LayerFilter,
    ): void => {
      const osc = ctx.createOscillator();
      const startAt = t0 + startOffsetS;
      const stopAt = startAt + layerDurationS;
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, frequency), startAt);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), stopAt);
      connectLayer(osc, gainValue, startAt, stopAt, Math.min(attackS, layerDurationS * 0.4), filter);
    };

    const scheduleNoise = (
      gainValue: number,
      startOffsetS = 0,
      layerDurationS = durationS,
      filter: LayerFilter = {
        type: "bandpass",
        frequency: baseFreq,
      },
    ): void => {
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * layerDurationS));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        const progress = i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * (1 - progress * 0.72);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const startAt = t0 + startOffsetS;
      connectLayer(noise, gainValue, startAt, startAt + layerDurationS, 0.003, filter);
    };

    switch (profile.kind) {
      case "blade":
        scheduleNoise(0.62, 0, durationS * 0.72, { type: "highpass", frequency: baseFreq * 3.2, endFrequency: baseFreq * 1.8, q: 0.5 });
        scheduleNoise(0.34, 0.018, durationS * 0.9, { type: "bandpass", frequency: baseFreq * 4.6, endFrequency: baseFreq * 3.4, q: 2.4 });
        scheduleOsc("triangle", baseFreq * 2.1, baseFreq * 0.62, 0.26, 0, durationS * 0.64, 0.003);
        break;
      case "impact":
        scheduleNoise(0.46, 0, durationS * 0.7, { type: "lowpass", frequency: baseFreq * 7, endFrequency: baseFreq * 2.1, q: 0.8 });
        scheduleOsc("sine", baseFreq * 1.5, baseFreq * 0.42, 0.78, 0, durationS, 0.002);
        scheduleOsc("triangle", baseFreq * 2.6, baseFreq * 0.7, 0.2, 0.008, durationS * 0.52, 0.002);
        break;
      case "stoneImpact":
        // Modal-resonator approach for rock-on-rock/wall hits: a sharp
        // broadband crack at the transient, a few detuned/inharmonic damped
        // partials for the dull "body" (not a clean harmonic stack — real
        // stone doesn't ring true), and a longer lowpassed noise tail standing
        // in for scattering gravel/debris.
        scheduleNoise(0.58, 0, durationS * 0.16, { type: "highpass", frequency: baseFreq * 4, endFrequency: baseFreq * 2, q: 0.6 });
        scheduleOsc("sine", baseFreq, baseFreq * 0.88, 0.5, 0, durationS * 0.85, 0.002, {
          type: "lowpass", frequency: baseFreq * 2.2, q: 1.2,
        });
        scheduleOsc("triangle", baseFreq * 1.83, baseFreq * 1.55, 0.26, 0.004, durationS * 0.65, 0.003, {
          type: "lowpass", frequency: baseFreq * 3, q: 1.4,
        });
        scheduleOsc("sine", baseFreq * 2.61, baseFreq * 2.2, 0.14, 0.006, durationS * 0.5, 0.004, {
          type: "lowpass", frequency: baseFreq * 4, q: 1.6,
        });
        scheduleNoise(0.22, 0.02, durationS * 0.85, { type: "lowpass", frequency: baseFreq * 1.6, endFrequency: baseFreq * 0.7, q: 0.7 });
        break;
      case "grunt":
        scheduleOsc("sawtooth", baseFreq * 1.16, baseFreq * 0.64, 0.42, 0, durationS, 0.018, {
          type: "bandpass", frequency: 520 * pitchMultiplier, endFrequency: 640 * pitchMultiplier, q: 3.2,
        });
        scheduleOsc("triangle", baseFreq * 0.92, baseFreq * 0.52, 0.46, 0.012, durationS * 0.92, 0.012, {
          type: "bandpass", frequency: 920 * pitchMultiplier, endFrequency: 760 * pitchMultiplier, q: 4.1,
        });
        scheduleOsc("sawtooth", baseFreq * 1.02, baseFreq * 0.58, 0.15, 0.006, durationS * 0.8, 0.014, {
          type: "bandpass", frequency: 1450 * pitchMultiplier, endFrequency: 1180 * pitchMultiplier, q: 5,
        });
        scheduleNoise(0.1, 0.03, durationS * 0.6, { type: "bandpass", frequency: 680, q: 1.8 });
        break;
      case "metalClang":
        // Doubled, slightly-offset transient bursts (fight-choreography "double
        // clang" trick) instead of one clean hit, plus a low fundamental thunk,
        // a mid body ring, and two high inharmonic partials for a long
        // metal-on-metal tail rather than a short synth beep.
        scheduleNoise(0.5, 0, durationS * 0.22, { type: "highpass", frequency: baseFreq * 3, endFrequency: baseFreq * 1.6, q: 0.6 });
        scheduleNoise(0.24, 0.022, durationS * 0.16, { type: "highpass", frequency: baseFreq * 2.5, endFrequency: baseFreq * 1.3, q: 0.6 });
        scheduleOsc("sine", baseFreq, baseFreq * 0.9, 0.42, 0, durationS * 1.3, 0.004);
        scheduleOsc("sine", baseFreq * 1.98, baseFreq * 1.88, 0.2, 0.006, durationS * 1.1, 0.003, {
          type: "bandpass", frequency: baseFreq * 2, q: 5,
        });
        scheduleOsc("triangle", baseFreq * 3.02, baseFreq * 2.9, 0.32, 0, durationS * 1.2, 0.002, {
          type: "bandpass", frequency: baseFreq * 3, q: 6.5,
        });
        scheduleOsc("sine", baseFreq * 4.51, baseFreq * 4.32, 0.2, 0.004, durationS, 0.003, {
          type: "bandpass", frequency: baseFreq * 4.5, q: 7.5,
        });
        break;
      case "healChime": {
        const notes = [1, 1.25, 1.5, 2];
        notes.forEach((ratio, index) => {
          const delay = index * 0.045;
          const noteDuration = durationS * (1.35 - index * 0.08);
          scheduleOsc("sine", baseFreq * ratio, baseFreq * ratio * 0.998, 0.34 / (1 + index * 0.18), delay, noteDuration, 0.008);
          scheduleOsc("triangle", baseFreq * ratio * 2.01, baseFreq * ratio * 2, 0.08, delay, noteDuration * 0.72, 0.006);
        });
        scheduleNoise(0.075, 0.025, durationS * 0.5, { type: "highpass", frequency: 4200, q: 0.5 });
        break;
      }
      case "noiseHit":
        scheduleNoise(0.9, 0, durationS, { type: "bandpass", frequency: baseFreq, q: 0.9 });
        break;
      case "chime":
        [1, 1.5, 2].forEach((ratio, index) => {
          scheduleOsc("sine", baseFreq * ratio, baseFreq * ratio, 0.52 / (index + 1), index * 0.026, durationS * 1.2, 0.006);
        });
        break;
      case "pluck":
        scheduleOsc("triangle", baseFreq, baseFreq * 0.96, 0.82, 0, durationS, 0.004);
        scheduleOsc("sine", baseFreq * 2, baseFreq * 1.92, 0.18, 0, durationS * 0.62, 0.003);
        break;
      case "sweepUp":
        scheduleOsc("sawtooth", baseFreq, baseFreq * 2.2, 0.62, 0, durationS, 0.012, { type: "lowpass", frequency: baseFreq * 5 });
        break;
      case "sweepDown":
        scheduleOsc("sawtooth", baseFreq, baseFreq * 0.5, 0.62, 0, durationS, 0.012, { type: "lowpass", frequency: baseFreq * 5 });
        break;
      case "pulse":
        scheduleOsc("square", baseFreq, baseFreq * 0.82, 0.5, 0, durationS, 0.004, { type: "lowpass", frequency: baseFreq * 4 });
        scheduleOsc("sine", baseFreq / 2, baseFreq / 3, 0.42, 0, durationS, 0.003);
        break;
      case "pad":
      default:
        scheduleOsc("sine", baseFreq, baseFreq, 0.48, 0, durationS, 0.04);
        scheduleOsc("triangle", baseFreq * 1.5, baseFreq * 1.5, 0.22, 0, durationS, 0.05);
        break;
    }

    let playing = true;
    const completionId = setTimeout(() => {
      playing = false;
    }, Math.max(0, endAt - t0) * 1000);

    return {
      get isPlaying() {
        return playing;
      },
      setVolume(v: number) {
        master.gain.setTargetAtTime(v * (profile.gain ?? 1), ctx.currentTime, 0.015);
      },
      stop() {
        playing = false;
        clearTimeout(completionId);
        sources.forEach((source) => {
          try {
            source.stop();
          } catch {
            // already stopped
          }
        });
        echoTapNodes?.forEach((node) => node.disconnect());
        echoTapNodes = null;
      },
    };
  }
}
