import type { AudioBackend, VoiceHandle } from "./backend";
import { getBgmAsset } from "./assetManifest";

interface ActiveTrack {
  assetId: string;
  voice: VoiceHandle;
}

/**
 * Owns "what BGM is playing right now" — one active track at a time, plus an
 * optional supplementary warning layer. Fade-in/fade-out are delegated
 * entirely to the backend's native gain ramps (`VoiceHandle.stop(fadeMs)`,
 * `playBgmVoice(asset, volume, fadeInMs)`) rather than a JS-side
 * `setInterval` loop — an earlier version used manual intervals for the
 * crossfade and it was possible for a fade-out interval to keep ticking in
 * the background after being superseded by a second rapid transition
 * (caught by `__tests__/bgmManager.test.ts`, see
 * docs/dev-wiki/audio-system-prototype.md). Delegating to the backend means
 * there's no timer to leak: `stop()` is a single call that self-cleans.
 */
export class BgmManager {
  private active: ActiveTrack | null = null;
  private warningLayer: VoiceHandle | null = null;
  private muted = false;
  private bgmVolume = 1;
  private masterVolume = 1;

  constructor(private readonly backend: AudioBackend) {}

  get currentAssetId(): string | null {
    return this.active?.assetId ?? null;
  }

  get activeVoiceCount(): number {
    return (this.active ? 1 : 0) + (this.warningLayer ? 1 : 0);
  }

  setVolumes(masterVolume: number, bgmVolume: number, muted: boolean): void {
    this.masterVolume = masterVolume;
    this.bgmVolume = bgmVolume;
    this.muted = muted;
    if (this.active) {
      this.active.voice.setVolume(this.effectiveVolume(this.currentAssetBaseVolume()));
    }
  }

  /** Instant switch, no fade. */
  play(assetId: string): void {
    if (this.active?.assetId === assetId) return; // duplicate-play guard
    this.active?.voice.stop(0);
    this.startTrack(assetId, 0);
  }

  /** Fades the outgoing track out and the incoming track in, both via the backend's own ramp. */
  crossfadeTo(assetId: string, durationMs: number): void {
    if (this.active?.assetId === assetId) return;
    this.active?.voice.stop(durationMs);
    this.startTrack(assetId, durationMs);
  }

  stop(fadeMs = 300): void {
    this.active?.voice.stop(fadeMs);
    this.active = null;
  }

  pause(): void {
    this.active?.voice.setVolume(0);
  }

  resume(): void {
    if (this.active) this.active.voice.setVolume(this.effectiveVolume(this.currentAssetBaseVolume()));
  }

  setWarningLayer(active: boolean): void {
    if (active && !this.warningLayer) {
      this.warningLayer = this.backend.playWarningLayer(this.effectiveVolume(0.5));
    } else if (!active && this.warningLayer) {
      this.warningLayer.stop(200);
      this.warningLayer = null;
    }
  }

  destroy(): void {
    this.active?.voice.stop(0);
    this.warningLayer?.stop(0);
    this.active = null;
    this.warningLayer = null;
  }

  private startTrack(assetId: string, fadeInMs: number): void {
    const asset = getBgmAsset(assetId);
    if (!asset) {
      this.active = null;
      return;
    }
    const targetVolume = this.effectiveVolume(asset.baseVolume);
    const voice = this.backend.playBgmVoice(asset, targetVolume, fadeInMs);
    this.active = { assetId, voice };
  }

  private currentAssetBaseVolume(): number {
    if (!this.active) return 0;
    return getBgmAsset(this.active.assetId)?.baseVolume ?? 0;
  }

  private effectiveVolume(baseVolume: number): number {
    if (this.muted) return 0;
    return baseVolume * this.bgmVolume * this.masterVolume;
  }
}
