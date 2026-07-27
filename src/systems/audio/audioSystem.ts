import { WebAudioBackend, type AudioBackend } from "./backend";
import { BgmManager } from "./bgmManager";
import { SfxManager, type SfxPlayResult } from "./sfxManager";
import { AudioDirector } from "./audioDirector";
import { AudioSettings } from "./audioSettings";
import { listMissingAssets } from "./assetManifest";
import type {
  AudioEventTrace,
  AudioSystemState,
  BgmStateId,
  CombatSfxMode,
  SfxPlaybackOptions,
} from "./types";

export type AudioPlayResult = SfxPlayResult | "duplicate" | "sampled" | "inaudible" | "locked";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Single entry point for everything audio-related. This is the only class
 * scenes and UI should talk to. Runtime integration and its validation are
 * documented in docs/dev-wiki/audio-integration-validation.md.
 */
export class AudioSystem {
  private readonly backend: AudioBackend;
  private readonly bgm: BgmManager;
  private readonly sfx: SfxManager;
  private readonly director: AudioDirector;
  private readonly settings: AudioSettings;
  private lastError: string | null = null;
  private initialized = false;
  private unlockPromise: Promise<void> | null = null;
  private unlockAttemptCount = 0;
  private pendingDirectorState: BgmStateId | null = null;
  private pendingBgmId: string | null = null;
  private recentEvents: AudioEventTrace[] = [];
  private skippedEventCount = 0;
  private lastEventKeys = new Map<string, number>();
  private highFrequencyCounters = new Map<string, number>();
  private focusMuted = false;
  private focusHandlerBound = false;
  private unlockHandlerBound = false;
  private readonly unsubscribeSettings: () => void;

  constructor(backend: AudioBackend = new WebAudioBackend(), settings: AudioSettings = new AudioSettings()) {
    this.backend = backend;
    this.bgm = new BgmManager(backend);
    this.sfx = new SfxManager(backend);
    this.director = new AudioDirector(this.bgm);
    this.settings = settings;
    this.applySettingsToManagers();
    this.unsubscribeSettings = this.settings.onChange(() => this.applySettingsToManagers());
  }

  get audioDirector(): AudioDirector {
    return this.director;
  }

  get audioSettings(): AudioSettings {
    return this.settings;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.bindFocusHandling();
    this.bindUnlockHandling();
    this.installDebugControl();
  }

  async unlock(): Promise<void> {
    if (this.backend.isUnlocked()) return;
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockAttemptCount += 1;
    this.unlockPromise = this.backend.unlock()
      .then(() => {
        this.removeUnlockHandling();
        if (this.pendingBgmId) {
          const assetId = this.pendingBgmId;
          this.pendingBgmId = null;
          this.bgm.play(assetId);
        }
        if (this.pendingDirectorState) {
          const state = this.pendingDirectorState;
          this.pendingDirectorState = null;
          this.director.setState(state);
        }
      })
      .catch((err: unknown) => {
        this.lastError = err instanceof Error ? err.message : String(err);
      })
      .finally(() => {
        this.unlockPromise = null;
      });
    return this.unlockPromise;
  }

  playBgm(assetId: string): void {
    if (!this.backend.isUnlocked()) {
      this.pendingBgmId = assetId;
      return;
    }
    this.bgm.play(assetId);
  }

  transitionBgm(assetId: string, durationMs?: number): void {
    if (!this.backend.isUnlocked()) {
      this.pendingBgmId = assetId;
      return;
    }
    this.bgm.crossfadeTo(assetId, durationMs ?? this.settings.get().crossfadeDurationMs);
  }

  stopBgm(fadeMs?: number): void {
    this.bgm.stop(fadeMs);
  }

  setDirectorState(state: BgmStateId): void {
    if (!this.backend.isUnlocked()) {
      this.pendingDirectorState = state;
      return;
    }
    this.director.setState(state);
  }

  resetDirector(state: BgmStateId = "menu"): void {
    this.pendingBgmId = null;
    if (!this.backend.isUnlocked()) {
      this.pendingDirectorState = state;
      return;
    }
    this.director.reset(state);
  }

  triggerFortressWarning(returnState: Extract<BgmStateId, "preparation" | "battle-low" | "battle-high">): void {
    if (!this.backend.isUnlocked()) return;
    this.director.triggerFortressWarning(returnState);
  }

  playSfx(assetId: string, options: SfxPlaybackOptions = {}): AudioPlayResult {
    if (!this.backend.isUnlocked()) return this.recordEvent(assetId, "locked", true);
    const nowMs = this.backend.nowMs;
    if (options.eventKey) {
      const lastAt = this.lastEventKeys.get(options.eventKey) ?? -Infinity;
      if (nowMs - lastAt < 80) return this.recordEvent(assetId, "duplicate", true);
      this.lastEventKeys.set(options.eventKey, nowMs);
      if (this.lastEventKeys.size > 500) {
        [...this.lastEventKeys.entries()]
          .filter(([, at]) => nowMs - at > 5000)
          .forEach(([key]) => this.lastEventKeys.delete(key));
      }
    }

    if (options.highFrequency && this.settings.get().combatSfxMode === "reduced") {
      const count = this.highFrequencyCounters.get(assetId) ?? 0;
      this.highFrequencyCounters.set(assetId, count + 1);
      if (count % 3 !== 0) return this.recordEvent(assetId, "sampled", true);
    }
    if ((options.volumeMultiplier ?? 1) <= 0.001) {
      return this.recordEvent(assetId, "inaudible", true);
    }

    const result = this.sfx.play(assetId, options);
    return this.recordEvent(assetId, result, result !== "played");
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
    this.setCombatSfxMode(value ? "reduced" : "full");
  }

  setCombatSfxMode(value: CombatSfxMode): void {
    this.settings.update({ combatSfxMode: value });
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
    const missing = listMissingAssets();
    return {
      initialized: this.initialized,
      unlocked: this.backend.isUnlocked(),
      contextState: this.backend.contextState,
      currentBgmId: this.bgm.currentAssetId,
      bgmState: this.director.state ?? this.pendingDirectorState,
      activeBgmVoices: this.bgm.activeVoiceCount,
      activeSfxVoices: this.sfx.activeVoiceCount,
      settings: this.settings.get(),
      recentEvents: [...this.recentEvents],
      skippedEventCount: this.skippedEventCount,
      unlockAttemptCount: this.unlockAttemptCount,
      missingAssetFallback: missing.bgm.length > 0 || missing.sfx.length > 0,
      focusMuted: this.focusMuted,
      lastError: this.lastError,
    };
  }

  destroy(): void {
    this.director.destroy();
    this.bgm.destroy();
    this.sfx.stopAll();
    this.backend.destroy();
    this.unsubscribeSettings();
    if (this.focusHandlerBound && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      window.removeEventListener("blur", this.handleWindowBlur);
      window.removeEventListener("focus", this.handleWindowFocus);
      this.focusHandlerBound = false;
    }
    this.removeUnlockHandling();
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.applyFocusMute(true);
    else this.applyFocusMute(false);
  };

  private handleWindowBlur = (): void => this.applyFocusMute(true);
  private handleWindowFocus = (): void => this.applyFocusMute(false);

  private bindFocusHandling(): void {
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("blur", this.handleWindowBlur);
    window.addEventListener("focus", this.handleWindowFocus);
    this.focusHandlerBound = true;
  }

  private applyFocusMute(unfocused: boolean): void {
    this.focusMuted = unfocused && this.settings.get().muteWhenUnfocused;
    if (this.focusMuted) this.sfx.stopAll();
    this.applySettingsToManagers();
  }

  private applySettingsToManagers(): void {
    const s = this.settings.get();
    const muted = s.mute || this.focusMuted;
    this.bgm.setVolumes(s.masterVolume, s.bgmVolume, muted);
    this.sfx.setVolumes(s.masterVolume, s.sfxVolume, muted, s.combatSfxMode);
    this.director.setCrossfadeDuration(s.crossfadeDurationMs);
  }

  private recordEvent(assetId: string, result: string, skipped: boolean): AudioPlayResult {
    if (skipped) this.skippedEventCount += 1;
    this.recentEvents.push({ id: assetId, result, atMs: Math.round(this.backend.nowMs) });
    if (this.recentEvents.length > 12) this.recentEvents.shift();
    return result as AudioPlayResult;
  }

  private bindUnlockHandling(): void {
    if (this.unlockHandlerBound || typeof document === "undefined") return;
    document.addEventListener("pointerdown", this.handleFirstUserInput, true);
    document.addEventListener("touchstart", this.handleFirstUserInput, true);
    document.addEventListener("keydown", this.handleFirstUserInput, true);
    this.unlockHandlerBound = true;
  }

  private removeUnlockHandling(): void {
    if (!this.unlockHandlerBound || typeof document === "undefined") return;
    document.removeEventListener("pointerdown", this.handleFirstUserInput, true);
    document.removeEventListener("touchstart", this.handleFirstUserInput, true);
    document.removeEventListener("keydown", this.handleFirstUserInput, true);
    this.unlockHandlerBound = false;
  }

  private handleFirstUserInput = (): void => {
    void this.unlock();
  };

  private installDebugControl(): void {
    if (typeof window === "undefined") return;
    const debugWindow = window as unknown as { __audioDebugControl?: unknown };
    debugWindow.__audioDebugControl = {
      getState: () => this.getState(),
      unlock: () => this.unlock(),
      setState: (state: BgmStateId) => this.setDirectorState(state),
      reset: (state: BgmStateId = "menu") => this.resetDirector(state),
      playSfx: (id: string) => this.playSfx(id),
      setMuted: (muted: boolean) => this.setMuted(muted),
      setVolumes: (master: number, bgm: number, sfx: number) => {
        this.setMasterVolume(master);
        this.setBgmVolume(bgm);
        this.setSfxVolume(sfx);
      },
      setCombatSfxMode: (mode: CombatSfxMode) => this.setCombatSfxMode(mode),
    };
  }
}

let sharedAudioSystem: AudioSystem | null = null;

/** The one AudioSystem used by every scene for the lifetime of the page. */
export function getAudioSystem(): AudioSystem {
  if (!sharedAudioSystem) sharedAudioSystem = new AudioSystem();
  return sharedAudioSystem;
}

export function getAudioDirector(): AudioDirector {
  return getAudioSystem().audioDirector;
}
