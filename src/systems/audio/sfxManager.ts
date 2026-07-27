import type { AudioBackend, VoiceHandle } from "./backend";
import { getSfxAsset } from "./assetManifest";
import type { SfxCategory } from "./types";

export type SfxPlayResult = "played" | "cooldown" | "limit" | "missing";

/**
 * One-shot SFX playback with per-id cooldown (prevents machine-gun spam)
 * and per-id concurrency caps (`maxSimultaneous` from the manifest). Cheap
 * pitch/volume randomization per manifest entry keeps repeated hits from
 * sounding identical, clamped to a small range so it never sounds detuned.
 */
export class SfxManager {
  private lastPlayedAtMs = new Map<string, number>();
  private activeVoicesById = new Map<string, VoiceHandle[]>();
  private categoryVolumes: Record<SfxCategory, number> = {
    ui: 1,
    wave: 1,
    combat: 1,
    capture: 1,
    construction: 1,
    state: 1,
  };
  private masterVolume = 1;
  private sfxVolume = 1;
  private muted = false;
  private reducedAudio = false;

  constructor(private readonly backend: AudioBackend) {}

  get activeVoiceCount(): number {
    let count = 0;
    this.activeVoicesById.forEach((list) => {
      count += list.filter((v) => v.isPlaying).length;
    });
    return count;
  }

  setVolumes(masterVolume: number, sfxVolume: number, muted: boolean, reducedAudio: boolean): void {
    this.masterVolume = masterVolume;
    this.sfxVolume = sfxVolume;
    this.muted = muted;
    this.reducedAudio = reducedAudio;
  }

  setCategoryVolume(category: SfxCategory, volume: number): void {
    this.categoryVolumes[category] = volume;
  }

  play(assetId: string): SfxPlayResult {
    const asset = getSfxAsset(assetId);
    if (!asset) return "missing";

    const now = this.backend.nowMs;
    const lastPlayed = this.lastPlayedAtMs.get(assetId) ?? -Infinity;
    if (now - lastPlayed < asset.cooldownMs) return "cooldown";

    const active = (this.activeVoicesById.get(assetId) ?? []).filter((v) => v.isPlaying);
    if (active.length >= asset.maxSimultaneous) return "limit";

    this.lastPlayedAtMs.set(assetId, now);
    const pitchMultiplier = 1 + (Math.random() * 2 - 1) * asset.pitchVariation;
    const volumeMultiplier = 1 + (Math.random() * 2 - 1) * asset.volumeVariation;
    const volume = this.effectiveVolume(asset.baseVolume, asset.category) * volumeMultiplier;

    const voice = this.backend.playSfxVoice(asset, Math.max(0, volume), Math.max(0.5, pitchMultiplier));
    active.push(voice);
    this.activeVoicesById.set(assetId, active);
    return "played";
  }

  stopAll(): void {
    this.activeVoicesById.forEach((list) => list.forEach((v) => v.stop(0)));
    this.activeVoicesById.clear();
  }

  private effectiveVolume(baseVolume: number, category: SfxCategory): number {
    if (this.muted) return 0;
    const reduceFactor = this.reducedAudio ? 0.6 : 1;
    return baseVolume * this.sfxVolume * this.masterVolume * (this.categoryVolumes[category] ?? 1) * reduceFactor;
  }
}
