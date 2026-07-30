import { describe, it, expect } from "vitest";
import { AudioSettings, DEFAULT_AUDIO_SETTINGS } from "../audioSettings";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe("AudioSettings", () => {
  it("uses safe defaults when nothing is stored", () => {
    const settings = new AudioSettings(fakeStorage());
    expect(settings.get()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("persists updates and reloads them from the same storage", () => {
    const storage = fakeStorage();
    const first = new AudioSettings(storage);
    first.update({ masterVolume: 0.3, mute: true });

    const second = new AudioSettings(storage);
    expect(second.get().masterVolume).toBe(0.3);
    expect(second.get().mute).toBe(true);
  });

  it("recovers to defaults when stored JSON is corrupt", () => {
    const storage = fakeStorage();
    storage.setItem("warcrest.audioSettings", "{not valid json");
    const settings = new AudioSettings(storage);
    expect(settings.get()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("recovers to defaults when stored data has an out-of-range value", () => {
    const storage = fakeStorage();
    storage.setItem(
      "warcrest.audioSettings",
      JSON.stringify({ ...DEFAULT_AUDIO_SETTINGS, masterVolume: 5 })
    );
    const settings = new AudioSettings(storage);
    expect(settings.get().masterVolume).toBe(DEFAULT_AUDIO_SETTINGS.masterVolume);
  });

  it("reset() restores defaults and notifies listeners", () => {
    const settings = new AudioSettings(fakeStorage());
    settings.update({ masterVolume: 0.1 });

    let notified: number | null = null;
    settings.onChange((data) => {
      notified = data.masterVolume;
    });
    settings.reset();

    expect(settings.get().masterVolume).toBe(DEFAULT_AUDIO_SETTINGS.masterVolume);
    expect(notified).toBe(DEFAULT_AUDIO_SETTINGS.masterVolume);
  });

  it("stamps the current version on every save", () => {
    const settings = new AudioSettings(fakeStorage());
    settings.update({ bgmVolume: 0.2 });
    expect(settings.get().version).toBe(DEFAULT_AUDIO_SETTINGS.version);
  });

  it("migrates v1 reducedAudio settings to the safe combat mode", () => {
    const storage = fakeStorage();
    storage.setItem("warcrest.audioSettings", JSON.stringify({
      version: 1,
      masterVolume: 0.4,
      bgmVolume: 0.5,
      sfxVolume: 0.6,
      mute: false,
      muteWhenUnfocused: true,
      reducedAudio: false,
      crossfadeDurationMs: 800,
    }));
    const settings = new AudioSettings(storage);
    expect(settings.get().version).toBe(3);
    expect(settings.get().masterVolume).toBe(0.4);
    expect(settings.get().combatSfxMode).toBe("reduced");
  });

  it("raises unchanged v2 default volumes to the new louder baseline", () => {
    const storage = fakeStorage();
    storage.setItem("warcrest.audioSettings", JSON.stringify({
      version: 2,
      masterVolume: 0.8,
      bgmVolume: 0.8,
      sfxVolume: 0.9,
      mute: false,
      muteWhenUnfocused: true,
      combatSfxMode: "reduced",
      crossfadeDurationMs: 1200,
    }));
    const settings = new AudioSettings(storage);
    expect(settings.get().version).toBe(3);
    expect(settings.get().masterVolume).toBe(DEFAULT_AUDIO_SETTINGS.masterVolume);
    expect(settings.get().bgmVolume).toBe(DEFAULT_AUDIO_SETTINGS.bgmVolume);
    expect(settings.get().sfxVolume).toBe(DEFAULT_AUDIO_SETTINGS.sfxVolume);
  });

  it("recovers when combatSfxMode contains an unknown value", () => {
    const storage = fakeStorage();
    storage.setItem("warcrest.audioSettings", JSON.stringify({
      ...DEFAULT_AUDIO_SETTINGS,
      combatSfxMode: "maximum",
    }));
    expect(new AudioSettings(storage).get()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
