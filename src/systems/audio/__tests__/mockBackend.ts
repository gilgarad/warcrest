import type { AudioBackend, VoiceHandle } from "../backend";
import type { BgmAssetDef, SfxAssetDef } from "../types";

export class MockVoice implements VoiceHandle {
  stopped = false;
  stopCallCount = 0;
  lastVolume = 0;

  get isPlaying(): boolean {
    return !this.stopped;
  }

  setVolume(volume: number): void {
    this.lastVolume = volume;
  }

  stop(): void {
    this.stopped = true;
    this.stopCallCount += 1;
  }
}

/** Test double for AudioBackend — no real AudioContext, fully synchronous, inspectable. */
export class MockAudioBackend implements AudioBackend {
  time = 0;
  unlockedFlag = false;
  bgmVoices: MockVoice[] = [];
  warningVoices: MockVoice[] = [];
  sfxVoices: MockVoice[] = [];
  unlockCallCount = 0;

  get contextState(): string {
    return this.unlockedFlag ? "running" : "not-created";
  }

  get nowMs(): number {
    return this.time;
  }

  isUnlocked(): boolean {
    return this.unlockedFlag;
  }

  async unlock(): Promise<void> {
    this.unlockCallCount += 1;
    this.unlockedFlag = true;
  }

  playBgmVoice(_asset: BgmAssetDef, _volume: number, _fadeInMs?: number): VoiceHandle {
    const v = new MockVoice();
    this.bgmVoices.push(v);
    return v;
  }

  playWarningLayer(_volume: number): VoiceHandle {
    const v = new MockVoice();
    this.warningVoices.push(v);
    return v;
  }

  playSfxVoice(_asset: SfxAssetDef, volume: number, _pitchMultiplier: number, _pan?: number): VoiceHandle {
    const v = new MockVoice();
    v.lastVolume = volume;
    this.sfxVoices.push(v);
    return v;
  }

  destroy(): void {
    // nothing to clean up
  }
}
