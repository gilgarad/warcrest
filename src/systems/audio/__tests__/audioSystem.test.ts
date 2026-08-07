import { describe, expect, it } from "vitest";
import { AudioSettings } from "../audioSettings";
import { AudioSystem } from "../audioSystem";
import { MockAudioBackend } from "./mockBackend";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
  } as unknown as Storage;
}

function setup() {
  const backend = new MockAudioBackend();
  const audio = new AudioSystem(backend, new AudioSettings(fakeStorage()));
  return { audio, backend };
}

describe("AudioSystem integration facade", () => {
  it("deduplicates concurrent unlock requests and creates one backend context", async () => {
    const { audio, backend } = setup();
    await Promise.all([audio.unlock(), audio.unlock(), audio.unlock()]);
    expect(backend.unlockCallCount).toBe(1);
    expect(audio.getState().unlockAttemptCount).toBe(1);
    audio.destroy();
  });

  it("queues director state until unlock without creating a BGM voice", async () => {
    const { audio, backend } = setup();
    audio.setDirectorState("preparation");
    expect(backend.bgmVoices).toHaveLength(0);
    expect(audio.getState().bgmState).toBe("preparation");
    await audio.unlock();
    expect(backend.bgmVoices).toHaveLength(1);
    expect(audio.getState().currentBgmId).toBe("bgm.age.stone");
    audio.destroy();
  });

  it("swaps the active gameplay BGM when the gameplay theme changes", async () => {
    const { audio } = setup();
    await audio.unlock();
    audio.setDirectorState("battle-low");
    expect(audio.getState().currentBgmId).toBe("bgm.age.stone");
    (["bronze", "medieval", "renaissance", "industrial", "modern"] as const).forEach((theme) => {
      audio.setGameplayMusicTheme(theme);
      expect(audio.getState().currentBgmId).toBe(`bgm.age.${theme}`);
    });
    audio.destroy();
  });

  it("rejects duplicate paths for one gameplay event", async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    expect(audio.playSfx("sfx.ui.confirm", { eventKey: "same-event" })).toBe("played");
    expect(audio.playSfx("sfx.ui.confirm", { eventKey: "same-event" })).toBe("duplicate");
    expect(backend.sfxVoices).toHaveLength(1);
    audio.destroy();
  });

  it("samples high-frequency events in reduced mode", async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    audio.setCombatSfxMode("reduced");
    const results = [];
    for (let index = 0; index < 6; index += 1) {
      backend.time += 100;
      results.push(audio.playSfx("sfx.combat.unitHit", {
        eventKey: `hit-${index}`,
        highFrequency: true,
      }));
    }
    expect(results.filter((result) => result === "played")).toHaveLength(2);
    expect(results.filter((result) => result === "sampled")).toHaveLength(4);
    audio.destroy();
  });

  it("blocks combat voices in off mode but leaves UI SFX enabled", async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    audio.setCombatSfxMode("off");
    expect(audio.playSfx("sfx.combat.unitHit", { highFrequency: true })).toBe("mode-off");
    backend.time += 1000;
    expect(audio.playSfx("sfx.ui.confirm")).toBe("played");
    expect(backend.sfxVoices).toHaveLength(1);
    audio.destroy();
  });

  it("keeps terminal state locked until reset", async () => {
    const { audio } = setup();
    await audio.unlock();
    audio.setDirectorState("victory");
    audio.setDirectorState("battle-low");
    expect(audio.getState().bgmState).toBe("victory");
    audio.resetDirector("menu");
    expect(audio.getState().bgmState).toBe("menu");
    audio.destroy();
  });
});
