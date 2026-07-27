/**
 * Independent audio system prototype — see docs/dev-wiki/audio-system-prototype.md
 * for the full writeup (structure, asset inventory, integration guide).
 *
 * Not wired into any scene. Consume via `getAudioSystem()` /
 * `getAudioDirector()` once a follow-up session decides to connect it.
 */
export { AudioSystem, getAudioSystem, getAudioDirector } from "./audioSystem";
export { AudioDirector } from "./audioDirector";
export { BgmManager } from "./bgmManager";
export { SfxManager, type SfxPlayResult } from "./sfxManager";
export { AudioSettings, DEFAULT_AUDIO_SETTINGS } from "./audioSettings";
export { WebAudioBackend, type AudioBackend, type VoiceHandle } from "./backend";
export { BGM_ASSETS, SFX_ASSETS, getBgmAsset, getSfxAsset, listMissingAssets } from "./assetManifest";
export type {
  AudioSettingsData,
  AudioSystemState,
  BgmStateId,
  BgmAssetDef,
  SfxAssetDef,
  SfxCategory,
  SynthProfile,
} from "./types";
