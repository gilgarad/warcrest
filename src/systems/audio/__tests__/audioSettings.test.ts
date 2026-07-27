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
});
