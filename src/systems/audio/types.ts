/**
 * Shared types for the independent audio system prototype. Nothing in this
 * directory imports from or modifies `src/systems/musicController.ts` — see
 * `docs/dev-wiki/audio-system-prototype.md` for why this is a parallel
 * system rather than a replacement.
 */

export type BgmStateId =
  | "menu"
  | "preparation"
  | "battle-low"
  | "battle-high"
  | "fortress-under-attack"
  | "victory"
  | "defeat";

/** Minimal synthesis recipe used as a fallback voice when no real audio file exists yet. */
export interface SynthProfile {
  kind: "pad" | "pluck" | "pulse" | "noiseHit" | "sweepUp" | "sweepDown" | "chime";
  /** Root frequency in Hz. For BGM pads this is the tonic; for SFX it's the pitch center. */
  frequency: number;
  durationMs: number;
  /** 0..1, relative to the asset's baseVolume. */
  gain?: number;
}

export interface BgmAssetDef {
  id: string; // e.g. "bgm.menu"
  label: string;
  /** Path under /public the real file would live at once one exists. Not required to exist yet. */
  filePath: string;
  loop: boolean;
  baseVolume: number; // 0..1
  /** True until a real file is actually present at filePath. Never lie about this. */
  missingAsset: boolean;
  /** Fallback voice used while missingAsset is true. */
  synth: SynthProfile;
  /** Source/license note, or "확인 필요" if unknown. Required field, never left blank. */
  licenseNote: string;
}

export type SfxCategory = "ui" | "wave" | "combat" | "capture" | "construction" | "state";

export interface SfxAssetDef {
  id: string; // e.g. "sfx.ui.confirm"
  label: string;
  category: SfxCategory;
  filePath: string;
  baseVolume: number;
  /** Minimum ms between two plays of this same id (prevents machine-gun spam). */
  cooldownMs: number;
  /** Max concurrently-playing voices for this id. */
  maxSimultaneous: number;
  /** Higher wins when maxSimultaneous across a concurrency group is exceeded. */
  priority: number;
  /** +-fraction of base pitch, e.g. 0.06 = up to 6% up/down. Kept small on purpose. */
  pitchVariation: number;
  /** +-fraction of base volume. */
  volumeVariation: number;
  spatial: boolean;
  missingAsset: boolean;
  synth: SynthProfile;
  licenseNote: string;
}

export interface AudioSettingsData {
  version: number;
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  mute: boolean;
  muteWhenUnfocused: boolean;
  reducedAudio: boolean;
  crossfadeDurationMs: number;
}

/** What DungeonScene/LaneBattleScene would eventually query via AudioSystem.getState(). */
export interface AudioSystemState {
  unlocked: boolean;
  currentBgmId: string | null;
  bgmState: BgmStateId | null;
  activeBgmVoices: number;
  activeSfxVoices: number;
  settings: AudioSettingsData;
  lastError: string | null;
}
