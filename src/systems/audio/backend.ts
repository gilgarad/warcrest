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
    try {
      const ctx = this.requireCtx();
      if (volume <= 0.0001) {
        console.warn(`[audio] skipped inaudible SFX ${asset.id}: effective volume ${volume.toFixed(4)}`);
        return this.createSilentVoiceHandle();
      }
      if (asset.synth.durationMs <= 0) {
        console.warn(`[audio] skipped invalid SFX ${asset.id}: durationMs=${asset.synth.durationMs}`);
        return this.createSilentVoiceHandle();
      }
      if (!asset.missingAsset) {
        return this.playFileOneShot(asset.filePath, volume, pan);
      }
      return this.playSynthOneShot(ctx, asset, volume, pitchMultiplier, pan);
    } catch (error) {
      console.warn(`[audio] failed to schedule SFX ${asset.id}`, error);
      return this.createSilentVoiceHandle();
    }
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
    ) => this.scheduleTone(
      ctx,
      destination,
      sources,
      time,
      frequency,
      duration,
      gainValue * orchestrationGain,
      type,
      attack,
      endFrequency,
    );
    const scheduleNoise = (duration: number, gainValue: number, cutoff: number) => {
      this.scheduleNoise(
        ctx,
        destination,
        sources,
        time,
        step,
        duration,
        gainValue * Math.min(1.4, orchestrationGain * 0.92),
        cutoff,
      );
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
    const seed = Math.round(time * 1000) + Math.round(frequency * 10) + Math.round(gainValue * 1000);
    const layerGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const stopAt = time + duration;
    const peakGain = Math.max(0.001, gainValue);
    const sustainGain = Math.max(0.0001, peakGain * (type === "sawtooth" ? 0.38 : 0.46));
    const attackTime = Math.max(0.003, attack * (1 + this.seededSigned(seed + 1, 0.18)));
    const decayTime = Math.min(duration * 0.35, Math.max(0.03, duration * 0.22));
    const filterBase = Math.max(120, frequency * (type === "sine" ? 4.8 : 6.4));
    const filterPeak = filterBase * (type === "sawtooth" ? 1.6 : 1.35);
    filter.type = "lowpass";
    filter.Q.value = 0.7 + Math.abs(this.seededSigned(seed + 2, 0.18));
    filter.frequency.setValueAtTime(Math.max(60, filterBase * 0.72), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(90, filterPeak), time + attackTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterBase * 0.84), Math.min(stopAt, time + attackTime + decayTime));
    filter.frequency.exponentialRampToValueAtTime(Math.max(50, filterBase * 0.64), stopAt);
    layerGain.gain.setValueAtTime(0.0001, time);
    layerGain.gain.exponentialRampToValueAtTime(peakGain, time + attackTime);
    layerGain.gain.exponentialRampToValueAtTime(sustainGain, Math.min(stopAt, time + attackTime + decayTime));
    layerGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    filter.connect(layerGain);
    layerGain.connect(destination);

    const startOscillator = (oscType: OscillatorType, cents: number, gainScale: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = oscType;
      oscillator.detune.setValueAtTime(cents, time);
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), time);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), stopAt);
      }
      gain.gain.value = gainScale;
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.onended = () => sources.delete(oscillator);
      oscillator.start(time);
      oscillator.stop(stopAt + 0.02);
      sources.add(oscillator);
    };

    startOscillator(type, this.seededSigned(seed + 3, 7), 1);
    startOscillator(type === "sine" ? "triangle" : type, this.seededSigned(seed + 4, 11), 0.32);
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
    const seed = (step + 1) * 2654435761;
    const buffer = this.createNoiseBuffer(ctx, duration, seed, 0.78);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.Q.value = 0.7 + Math.abs(this.seededSigned(seed + 1, 0.3));
    const startCutoff = Math.max(120, cutoff * (1 + this.seededSigned(seed + 2, 0.1)));
    const peakCutoff = Math.max(160, cutoff * (1.22 + this.seededSigned(seed + 3, 0.08)));
    const endCutoff = Math.max(80, cutoff * (0.78 + this.seededSigned(seed + 4, 0.06)));
    filter.frequency.setValueAtTime(startCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(peakCutoff, time + Math.min(0.012, duration * 0.22));
    filter.frequency.exponentialRampToValueAtTime(endCutoff, time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), time + Math.min(0.006, duration * 0.18));
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue * 0.28), time + Math.min(duration, 0.02 + duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.onended = () => sources.delete(source);
    source.start(time);
    source.stop(time + duration + 0.01);
    sources.add(source);
  }

  private seededUnit(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private seededSigned(seed: number, amount: number): number {
    return (this.seededUnit(seed) * 2 - 1) * amount;
  }

  private createNoiseBuffer(
    ctx: BaseAudioContext,
    duration: number,
    seed: number,
    decayAmount: number,
  ): AudioBuffer {
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let state = seed >>> 0;
    for (let index = 0; index < samples.length; index += 1) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const progress = index / samples.length;
      const contour = Math.max(0, 1 - progress * decayAmount);
      samples[index] = ((state / 0xffffffff) * 2 - 1) * contour;
    }
    return buffer;
  }

  private createDriveCurve(size: number, amount: number): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(new ArrayBuffer(size * Float32Array.BYTES_PER_ELEMENT));
    const k = Math.max(0.01, amount * 24);
    for (let index = 0; index < size; index += 1) {
      const x = index * 2 / (size - 1) - 1;
      curve[index] = (1 + k) * x / (1 + k * Math.abs(x));
    }
    return curve;
  }

  private createSilentVoiceHandle(): VoiceHandle {
    return {
      get isPlaying() {
        return false;
      },
      setVolume() {
        // no-op
      },
      stop() {
        // no-op
      },
    };
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
    asset: SfxAssetDef,
    volume: number,
    pitchMultiplier: number,
    pan: number,
  ): VoiceHandle {
    const profile = asset.synth;
    const durationS = Math.max(0.05, profile.durationMs / 1000);
    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    master.gain.value = Math.max(0, volume * (profile.gain ?? 1));
    compressor.threshold.value = -26;
    compressor.knee.value = 18;
    compressor.ratio.value = 2.4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.11;
    master.connect(compressor);
    compressor.connect(panner);
    panner.connect(this.getOutputDestination(ctx));
    const baseFreq = profile.frequency * pitchMultiplier;
    const t0 = ctx.currentTime;
    const sources = new Set<AudioScheduledSourceNode>();
    let endAt = t0 + durationS;
    const driveCurve = this.createDriveCurve(256, 0.62);
    const randomSigned = (amount: number) => (Math.random() * 2 - 1) * amount;

    const connectLayer = (
      source: AudioScheduledSourceNode,
      gainValue: number,
      startAt: number,
      stopAt: number,
      attackS: number,
      filter?: {
        type: BiquadFilterType;
        frequency: number;
        q?: number;
        peakMultiplier?: number;
        endMultiplier?: number;
      },
      distortionAmount = 0,
    ): void => {
      const duration = Math.max(0.01, stopAt - startAt);
      const layerGain = ctx.createGain();
      const peakGain = Math.max(0.001, gainValue);
      const sustainGain = Math.max(0.0001, peakGain * (0.32 + Math.random() * 0.16));
      const decayAt = Math.min(stopAt, startAt + Math.max(0.01, duration * (0.18 + Math.random() * 0.12)));
      layerGain.gain.setValueAtTime(0.0001, startAt);
      layerGain.gain.exponentialRampToValueAtTime(peakGain, startAt + Math.min(attackS, duration * 0.4));
      layerGain.gain.exponentialRampToValueAtTime(sustainGain, decayAt);
      layerGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      let chainInput: AudioNode = source;
      if (distortionAmount > 0) {
        const shaper = ctx.createWaveShaper();
        const wetGain = ctx.createGain();
        shaper.curve = this.createDriveCurve(256, distortionAmount);
        shaper.oversample = "2x";
        wetGain.gain.value = 0.68;
        chainInput.connect(shaper);
        shaper.connect(wetGain);
        chainInput = wetGain;
      }
      if (filter) {
        const node = ctx.createBiquadFilter();
        node.type = filter.type;
        node.Q.value = filter.q ?? 0.7;
        const peakMultiplier = filter.peakMultiplier ?? 1.45;
        const endMultiplier = filter.endMultiplier ?? 0.72;
        const startFreq = Math.max(40, filter.frequency * (0.72 + randomSigned(0.08)));
        const peakFreq = Math.max(50, filter.frequency * (peakMultiplier + randomSigned(0.12)));
        const endFreq = Math.max(35, filter.frequency * (endMultiplier + randomSigned(0.08)));
        node.frequency.setValueAtTime(startFreq, startAt);
        node.frequency.exponentialRampToValueAtTime(peakFreq, startAt + Math.min(duration * 0.16, 0.018));
        node.frequency.exponentialRampToValueAtTime(endFreq, stopAt);
        chainInput.connect(node);
        node.connect(layerGain);
      } else {
        chainInput.connect(layerGain);
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
      filter?: {
        type: BiquadFilterType;
        frequency: number;
        q?: number;
        peakMultiplier?: number;
        endMultiplier?: number;
      },
      distortionAmount = 0,
    ): void => {
      const detunes = [0, randomSigned(9), randomSigned(15)];
      const gains = [1, 0.38, 0.22];
      detunes.forEach((detune, index) => {
        const osc = ctx.createOscillator();
        const startAt = t0 + startOffsetS + index * 0.0015;
        const stopAt = startAt + layerDurationS;
        osc.type = index === 0 ? type : type === "sine" ? "triangle" : type;
        osc.detune.setValueAtTime(detune, startAt);
        osc.frequency.setValueAtTime(Math.max(20, frequency * (1 + randomSigned(0.012))), startAt);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency * (1 + randomSigned(0.01))), stopAt);
        connectLayer(
          osc,
          gainValue * gains[index],
          startAt,
          stopAt,
          Math.min(attackS, layerDurationS * 0.4),
          filter,
          distortionAmount,
        );
      });
    };

    const scheduleSingleOsc = (
      type: OscillatorType,
      frequency: number,
      endFrequency: number,
      gainValue: number,
      startOffsetS = 0,
      layerDurationS = durationS,
      attackS = 0.008,
      filter?: {
        type: BiquadFilterType;
        frequency: number;
        q?: number;
        peakMultiplier?: number;
        endMultiplier?: number;
      },
      distortionAmount = 0,
    ): void => {
      const osc = ctx.createOscillator();
      const startAt = t0 + startOffsetS;
      const stopAt = startAt + layerDurationS;
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, frequency), startAt);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), stopAt);
      connectLayer(
        osc,
        gainValue,
        startAt,
        stopAt,
        Math.min(attackS, layerDurationS * 0.4),
        filter,
        distortionAmount,
      );
    };

    const scheduleNoise = (
      gainValue: number,
      startOffsetS = 0,
      layerDurationS = durationS,
      filter: { type: BiquadFilterType; frequency: number; q?: number } = {
        type: "bandpass",
        frequency: baseFreq,
      },
    ): void => {
      const buffer = this.createNoiseBuffer(
        ctx,
        layerDurationS,
        Math.floor((t0 + startOffsetS) * 1000000) ^ Math.floor(baseFreq * 32),
        0.72 + Math.random() * 0.18,
      );
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const startAt = t0 + startOffsetS;
      connectLayer(
        noise,
        gainValue,
        startAt,
        startAt + layerDurationS,
        0.003,
        {
          ...filter,
          peakMultiplier: filter.type === "highpass" ? 1.18 : 1.52,
          endMultiplier: filter.type === "lowpass" ? 0.58 : 0.72,
        },
      );
    };

    const scheduleSweptNoise = (
      gainValue: number,
      startFrequency: number,
      endFrequency: number,
      startOffsetS = 0,
      layerDurationS = durationS,
      q = 1.4,
    ): void => {
      const buffer = this.createNoiseBuffer(
        ctx,
        layerDurationS,
        Math.floor((t0 + startOffsetS) * 1000000) ^ Math.floor(startFrequency * 16),
        0.76 + Math.random() * 0.12,
      );
      const noise = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const startAt = t0 + startOffsetS;
      const stopAt = startAt + layerDurationS;
      noise.buffer = buffer;
      filter.type = "bandpass";
      filter.Q.value = q;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), startAt + Math.min(0.008, layerDurationS * 0.18));
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue * 0.34), startAt + Math.min(layerDurationS * 0.48, 0.05));
      gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      filter.frequency.setValueAtTime(Math.max(120, startFrequency), startAt);
      filter.frequency.exponentialRampToValueAtTime(Math.max(90, startFrequency * 1.08), startAt + Math.min(0.01, layerDurationS * 0.2));
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, endFrequency), stopAt);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      noise.onended = () => sources.delete(noise);
      noise.start(startAt);
      noise.stop(stopAt + 0.02);
      sources.add(noise);
      endAt = Math.max(endAt, stopAt + 0.02);
    };

    const scheduleFormantVoice = (
      frequency: number,
      endFrequency: number,
      gainValue: number,
      startOffsetS = 0,
      layerDurationS = durationS,
      noiseGain = 0,
      raspAmount = 0.52,
    ): void => {
      const isShortVoice = layerDurationS <= 0.22;
      const osc = ctx.createOscillator();
      const inputGain = ctx.createGain();
      const shaper = ctx.createWaveShaper();
      const startAt = t0 + startOffsetS;
      const stopAt = startAt + layerDurationS;
      const formants = isShortVoice
        ? [
            { frequency: 340 * pitchMultiplier, gain: 0.92, q: 2.4, drift: 0.08 },
            { frequency: 720 * pitchMultiplier, gain: 0.58, q: 3.1, drift: 0.07 },
            { frequency: 1320 * pitchMultiplier, gain: 0.24, q: 2.8, drift: 0.06 },
          ]
        : [
            { frequency: 520 * pitchMultiplier, gain: 0.48, q: 4.8, drift: 0.12 },
            { frequency: 980 * pitchMultiplier, gain: 0.32, q: 5.3, drift: 0.09 },
            { frequency: 1780 * pitchMultiplier, gain: 0.18, q: 4.1, drift: 0.07 },
          ];
      osc.type = "sawtooth";
      osc.detune.setValueAtTime(randomSigned(18), startAt);
      osc.frequency.setValueAtTime(Math.max(50, frequency), startAt);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), stopAt);
      inputGain.gain.setValueAtTime(0.0001, startAt);
      inputGain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, gainValue * (isShortVoice ? 1.35 : 1)),
        startAt + Math.min(isShortVoice ? 0.008 : 0.02, layerDurationS * 0.24),
      );
      inputGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, gainValue * (isShortVoice ? 0.62 : 0.42)),
        startAt + Math.min(layerDurationS * (isShortVoice ? 0.24 : 0.38), isShortVoice ? 0.032 : 0.07),
      );
      inputGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      shaper.curve = driveCurve;
      shaper.oversample = "2x";
      osc.connect(shaper);
      shaper.connect(inputGain);
      formants.forEach((formant, index) => {
        const band = ctx.createBiquadFilter();
        const bandGain = ctx.createGain();
        band.type = "bandpass";
        band.Q.value = formant.q;
        const startFreq = formant.frequency * (0.92 + randomSigned(formant.drift));
        const midFreq = formant.frequency * (1.08 + randomSigned(formant.drift));
        const endFreq = formant.frequency * (0.96 + randomSigned(formant.drift));
        band.frequency.setValueAtTime(Math.max(120, startFreq), startAt);
        band.frequency.linearRampToValueAtTime(
          Math.max(140, midFreq),
          startAt + layerDurationS * (isShortVoice ? 0.16 + index * 0.05 : 0.35 + index * 0.08),
        );
        band.frequency.linearRampToValueAtTime(Math.max(120, endFreq), stopAt);
        bandGain.gain.value = formant.gain;
        inputGain.connect(band);
        band.connect(bandGain);
        bandGain.connect(master);
      });
      const bodyFilter = ctx.createBiquadFilter();
      const bodyGain = ctx.createGain();
      bodyFilter.type = "lowpass";
      bodyFilter.Q.value = 0.9;
      bodyFilter.frequency.setValueAtTime(isShortVoice ? 900 : 1500, startAt);
      bodyFilter.frequency.exponentialRampToValueAtTime(isShortVoice ? 620 : 900, stopAt);
      bodyGain.gain.value = isShortVoice ? 0.34 : 0.16;
      inputGain.connect(bodyFilter);
      bodyFilter.connect(bodyGain);
      bodyGain.connect(master);
      osc.onended = () => sources.delete(osc);
      osc.start(startAt);
      osc.stop(stopAt + 0.02);
      sources.add(osc);
      endAt = Math.max(endAt, stopAt + 0.02);
      if (noiseGain > 0) {
        scheduleNoise(noiseGain * (isShortVoice ? 1.25 : 1), startOffsetS + (isShortVoice ? 0.002 : 0.01), layerDurationS * (isShortVoice ? 0.42 : 0.55), {
          type: "bandpass",
          frequency: (isShortVoice ? 860 : 1200) * (1 + randomSigned(0.08)),
          q: isShortVoice ? 1.2 : 1.6,
        });
      }
      if (isShortVoice) {
        scheduleSingleOsc("triangle", frequency * 0.92, endFrequency * 0.82, gainValue * 0.22, startOffsetS, layerDurationS * 0.78, 0.004, {
          type: "lowpass",
          frequency: 520 * (1 + randomSigned(0.06)),
          q: 0.8,
          peakMultiplier: 1.06,
          endMultiplier: 0.72,
        }, 0.22);
      }
      if (raspAmount > 0) {
        scheduleSingleOsc("triangle", frequency * 0.5, endFrequency * 0.48, gainValue * 0.12, startOffsetS, layerDurationS * 0.82, 0.012, {
          type: "bandpass",
          frequency: 360 * (1 + randomSigned(0.1)),
          q: 2.1,
          peakMultiplier: 1.18,
          endMultiplier: 0.92,
        }, raspAmount);
      }
    };

    switch (profile.kind) {
      case "blade":
        scheduleNoise(0.72, 0, durationS * 0.18, { type: "highpass", frequency: baseFreq * 4.2, q: 0.9 });
        scheduleNoise(0.3, 0.016, durationS * 0.55, { type: "bandpass", frequency: baseFreq * 5.1, q: 2.9 });
        scheduleOsc("triangle", baseFreq * 2.2, baseFreq * 0.66, 0.22, 0, durationS * 0.68, 0.002, {
          type: "highpass",
          frequency: baseFreq * 1.8,
          q: 0.8,
          peakMultiplier: 1.24,
          endMultiplier: 0.94,
        });
        scheduleSingleOsc("sine", baseFreq * 3.4, baseFreq * 0.84, 0.08, 0.005, durationS * 0.3, 0.002, {
          type: "bandpass",
          frequency: baseFreq * 3.1,
          q: 2.2,
        });
        break;
      case "impact":
        scheduleNoise(0.54, 0, durationS * 0.16, { type: "lowpass", frequency: baseFreq * 7.2, q: 0.7 });
        scheduleNoise(0.2, 0.012, durationS * 0.45, { type: "bandpass", frequency: baseFreq * 2.1, q: 1.4 });
        scheduleOsc("sine", baseFreq * 1.45, baseFreq * 0.46, 0.58, 0, durationS, 0.002, {
          type: "lowpass",
          frequency: baseFreq * 4.8,
          q: 0.8,
          peakMultiplier: 1.18,
          endMultiplier: 0.54,
        });
        scheduleOsc("triangle", baseFreq * 2.3, baseFreq * 0.64, 0.16, 0.006, durationS * 0.62, 0.002, {
          type: "bandpass",
          frequency: baseFreq * 1.7,
          q: 1.6,
        });
        break;
      case "heavyImpact": {
        const bloomDuration = Math.max(durationS * 1.45, 0.18);
        scheduleNoise(0.62, 0, durationS * 0.14, { type: "lowpass", frequency: baseFreq * 7.6, q: 0.75 });
        scheduleNoise(0.18, 0.01, durationS * 0.3, { type: "bandpass", frequency: baseFreq * 1.8, q: 1.3 });
        scheduleOsc("sine", baseFreq * 1.32, baseFreq * 0.56, 0.34, 0, durationS * 0.62, 0.002, {
          type: "lowpass",
          frequency: baseFreq * 3.2,
          q: 0.7,
          peakMultiplier: 1.08,
          endMultiplier: 0.46,
        });
        scheduleSingleOsc("sine", baseFreq * 0.42, baseFreq * 0.26, 0.48, 0.024, bloomDuration, 0.01, {
          type: "lowpass",
          frequency: baseFreq * 1.18,
          q: 0.6,
          peakMultiplier: 0.96,
          endMultiplier: 0.38,
        });
        scheduleSingleOsc("triangle", baseFreq * 0.84, baseFreq * 0.4, 0.12, 0.028, bloomDuration * 0.82, 0.012, {
          type: "lowpass",
          frequency: baseFreq * 1.34,
          q: 0.7,
          peakMultiplier: 0.94,
          endMultiplier: 0.34,
        });
        break;
      }
      case "grunt":
        if (durationS <= 0.22) {
          scheduleSingleOsc("triangle", baseFreq * 1.42, baseFreq * 0.94, 0.42, 0, durationS * 0.92, 0.001, {
            type: "lowpass",
            frequency: 1400,
            q: 0.65,
            peakMultiplier: 1.08,
            endMultiplier: 0.52,
          }, 0.28);
          scheduleSingleOsc("sawtooth", baseFreq * 2.06, baseFreq * 1.26, 0.14, 0.003, durationS * 0.52, 0.001, {
            type: "lowpass",
            frequency: 2200,
            q: 0.72,
            peakMultiplier: 1.04,
            endMultiplier: 0.68,
          }, 0.18);
          scheduleNoise(0.14, 0, durationS * 0.28, {
            type: "bandpass",
            frequency: 1100 * (1 + randomSigned(0.08)),
            q: 1.1,
          });
          break;
        }
        scheduleFormantVoice(baseFreq * 1.08, baseFreq * 0.62, 0.34, 0, durationS, 0.09, 0.6);
        scheduleFormantVoice(baseFreq * 0.82, baseFreq * 0.52, 0.16, 0.01, durationS * 0.85, 0.04, 0.44);
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
          scheduleOsc("sine", baseFreq * ratio, baseFreq * ratio * (0.998 + randomSigned(0.003)), 0.42 / (index + 1), index * 0.026, durationS * 1.2, 0.006, {
            type: "lowpass",
            frequency: baseFreq * ratio * 6.4,
            q: 0.7,
            peakMultiplier: 1.22,
            endMultiplier: 0.82,
          });
        });
        break;
      case "pluck":
        scheduleNoise(0.08, 0, durationS * 0.08, { type: "highpass", frequency: baseFreq * 7.2, q: 0.6 });
        scheduleOsc("triangle", baseFreq, baseFreq * 0.96, 0.58, 0, durationS, 0.004, {
          type: "lowpass",
          frequency: baseFreq * 4.8,
          q: 0.9,
          peakMultiplier: 1.16,
          endMultiplier: 0.7,
        });
        scheduleSingleOsc("sine", baseFreq * 2, baseFreq * 1.92, 0.12, 0, durationS * 0.62, 0.003, {
          type: "bandpass",
          frequency: baseFreq * 2.1,
          q: 1.7,
        });
        break;
      case "bowTwang":
        scheduleSingleOsc("sawtooth", baseFreq * 1.04, baseFreq * 0.98, 0.18, 0, Math.max(0.045, durationS * 0.48), 0.002, {
          type: "bandpass",
          frequency: baseFreq * 1.02,
          q: 7.2,
          peakMultiplier: 1.02,
          endMultiplier: 0.9,
        }, 0.18);
        scheduleSingleOsc("triangle", baseFreq * 2.04, baseFreq * 1.88, 0.08, 0.004, Math.max(0.038, durationS * 0.42), 0.002, {
          type: "bandpass",
          frequency: baseFreq * 2.1,
          q: 6.1,
          peakMultiplier: 1.04,
          endMultiplier: 0.92,
        });
        scheduleSweptNoise(0.16, 4200 * (1 + randomSigned(0.06)), 980 * (1 + randomSigned(0.08)), 0.006, Math.max(0.11, durationS * 1.22), 1.8);
        scheduleSweptNoise(0.06, 2600 * (1 + randomSigned(0.05)), 720 * (1 + randomSigned(0.06)), 0.014, Math.max(0.09, durationS), 1.3);
        break;
      case "sweepUp":
        scheduleNoise(0.09, 0, durationS * 0.18, { type: "highpass", frequency: baseFreq * 4.6, q: 0.5 });
        scheduleOsc("sawtooth", baseFreq, baseFreq * 2.2, 0.48, 0, durationS, 0.012, {
          type: "lowpass",
          frequency: baseFreq * 5,
          q: 0.7,
          peakMultiplier: 1.4,
          endMultiplier: 1.08,
        });
        break;
      case "sweepDown":
        scheduleNoise(0.08, 0, durationS * 0.16, { type: "bandpass", frequency: baseFreq * 3.2, q: 1.1 });
        scheduleOsc("sawtooth", baseFreq, baseFreq * 0.5, 0.5, 0, durationS, 0.012, {
          type: "lowpass",
          frequency: baseFreq * 5,
          q: 0.7,
          peakMultiplier: 1.26,
          endMultiplier: 0.54,
        });
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

    if (sources.size === 0) {
      console.warn(`[audio] no sources scheduled for SFX ${asset.id} (${profile.kind})`);
      return this.createSilentVoiceHandle();
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
      },
    };
  }
}
