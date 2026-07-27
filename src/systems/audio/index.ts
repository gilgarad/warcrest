export { AudioSystem, getAudioSystem, getAudioDirector, type AudioPlayResult } from "./audioSystem";
export { AudioDirector } from "./audioDirector";
export { BgmManager } from "./bgmManager";
export { SfxManager, type SfxPlayResult } from "./sfxManager";
export { AudioSettings, DEFAULT_AUDIO_SETTINGS } from "./audioSettings";
export { WebAudioBackend, type AudioBackend, type VoiceHandle } from "./backend";
export { BattleAudioStateMachine, type BattleAudioSnapshot, type BattleAudioDecision } from "./battleAudioStateMachine";
export { calculateSpatialAudio, type AudioCameraView, type AudioWorldPoint, type SpatialAudioMix } from "./spatialAudio";
export { BGM_ASSETS, SFX_ASSETS, getBgmAsset, getSfxAsset, listMissingAssets } from "./assetManifest";
export type {
  AudioSettingsData,
  AudioSystemState,
  AudioEventTrace,
  BgmStateId,
  CombatSfxMode,
  BgmAssetDef,
  SfxAssetDef,
  SfxCategory,
  SynthProfile,
  SfxPlaybackOptions,
} from "./types";
