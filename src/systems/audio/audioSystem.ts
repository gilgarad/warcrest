import { WebAudioBackend, type AudioBackend } from "./backend";
import { BgmManager } from "./bgmManager";
import { SfxManager, type SfxPlayResult } from "./sfxManager";
import { AudioDirector } from "./audioDirector";
import { AudioSettings } from "./audioSettings";
import { listMissingAssets } from "./assetManifest";
import type { AudioSystemState, BgmStateId } from "./types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Single entry point for everything audio-related. This is the only class
 * a future scene integration should talk to — see
 * docs/dev-wiki/audio-system-prototype.md's integration guide for exact
 * call sites (not applied to any scene file yet, by design).
 */
export class AudioSystem {
  private readonly backend: AudioBackend;
  private readonly bgm: BgmManager;
  private readonly sfx: SfxManager;
  private readonly director: AudioDirector;
  private readonly settings: AudioSettings;
  private lastError: string | null = null;
  private focusHandlerBound = false;

  constructor(backend: AudioBackend = new WebAudioBackend()) {
    this.backend = backend;
    this.bgm = new BgmManager(backend);
    this.sfx = new SfxManager(backend);
    this.director = new AudioDirector(this.bgm);
    this.settings = new AudioSettings();
    this.applySettingsToManagers();
    this.settings.onChange(() => this.applySettingsToManagers());
    this.bindFocusHandling();
  }

  get audioDirector(): AudioDirector {
    return this.director;
  }

  get audioSettings(): AudioSettings {
    return this.settings;
  }

  async initialize(): Promise<void> {
    // Reserved for future async asset preloading once real files exist.
    // Settings are already loaded synchronously in the constructor.
  }

  async unlock(): Promise<void> {
    try {
      await this.backend.unlock();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }

  playBgm(assetId: string): void {
    this.bgm.play(assetId);
  }

  transitionBgm(assetId: string, durationMs?: number): void {
    this.bgm.crossfadeTo(assetId, durationMs ?? this.settings.get().crossfadeDurationMs);
  }

  stopBgm(fadeMs?: number): void {
    this.bgm.stop(fadeMs);
  }

  setDirectorState(state: BgmStateId): void {
    this.director.setState(state);
  }

  resetDirector(state: BgmStateId = "menu"): void {
    this.director.reset(state);
  }

  playSfx(assetId: string): SfxPlayResult {
    return this.sfx.play(assetId);
  }

  stopAllSfx(): void {
    this.sfx.stopAll();
  }

  setMasterVolume(value: number): void {
    this.settings.update({ masterVolume: clamp01(value) });
  }

  setBgmVolume(value: number): void {
    this.settings.update({ bgmVolume: clamp01(value) });
  }

  setSfxVolume(value: number): void {
    this.settings.update({ sfxVolume: clamp01(value) });
  }

  setMuted(muted: boolean): void {
    this.settings.update({ mute: muted });
  }

  setMuteWhenUnfocused(value: boolean): void {
    this.settings.update({ muteWhenUnfocused: value });
  }

  setReducedAudio(value: boolean): void {
    this.settings.update({ reducedAudio: value });
  }

  setCrossfadeDuration(ms: number): void {
    this.settings.update({ crossfadeDurationMs: ms });
  }

  resetSettings(): void {
    this.settings.reset();
  }

  getMissingAssets(): { bgm: string[]; sfx: string[] } {
    return listMissingAssets();
  }

  getState(): AudioSystemState {
    return {
      unlocked: this.backend.isUnlocked(),
      currentBgmId: this.bgm.currentAssetId,
      bgmState: this.director.state,
      activeBgmVoices: this.bgm.activeVoiceCount,
      activeSfxVoices: this.sfx.activeVoiceCount,
      settings: this.settings.get(),
      lastError: this.lastError,
    };
  }

  destroy(): void {
    this.bgm.destroy();
    this.sfx.stopAll();
    this.backend.destroy();
    if (this.focusHandlerBound && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      this.focusHandlerBound = false;
    }
  }

  private handleVisibilityChange = (): void => {
    if (!this.settings.get().muteWhenUnfocused) return;
    if (document.hidden) this.bgm.pause();
    else this.bgm.resume();
  };

  private bindFocusHandling(): void {
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.focusHandlerBound = true;
  }

  private applySettingsToManagers(): void {
    const s = this.settings.get();
    this.bgm.setVolumes(s.masterVolume, s.bgmVolume, s.mute);
    this.sfx.setVolumes(s.masterVolume, s.sfxVolume, s.mute, s.reducedAudio);
    this.director.setCrossfadeDuration(s.crossfadeDurationMs);
  }
}

let sharedAudioSystem: AudioSystem | null = null;

/** Module-level singleton, same pattern as `getMusicController()` — but a fully separate instance/module tree. */
export function getAudioSystem(): AudioSystem {
  if (!sharedAudioSystem) sharedAudioSystem = new AudioSystem();
  return sharedAudioSystem;
}

export function getAudioDirector(): AudioDirector {
  return getAudioSystem().audioDirector;
}
