import { describe, it, expect } from "vitest";
import { AudioDirector } from "../audioDirector";
import { BgmManager } from "../bgmManager";
import { MockAudioBackend } from "./mockBackend";

function setup() {
  const backend = new MockAudioBackend();
  const bgm = new BgmManager(backend);
  const director = new AudioDirector(bgm);
  return { backend, bgm, director };
}

describe("AudioDirector", () => {
  it("ignores a repeated request for the same state", () => {
    const { backend, director } = setup();
    director.setState("menu");
    director.setState("menu");
    expect(backend.bgmVoices.length).toBe(1);
  });

  it("crossfades between battle-low and battle-high", () => {
    const { backend, director } = setup();
    director.setState("battle-low");
    director.setState("battle-high");
    expect(backend.bgmVoices.length).toBe(2);
    expect(backend.bgmVoices[0].stopped).toBe(true); // low was faded out
    expect(director.state).toBe("battle-high");
  });

  it("fortress-under-attack layers a warning instead of replacing the current track", () => {
    const { backend, director } = setup();
    director.setState("battle-low");
    director.setState("fortress-under-attack");

    expect(backend.bgmVoices.length).toBe(1); // no new/second BGM track started
    expect(backend.bgmVoices[0].stopped).toBe(false); // battle-low keeps playing underneath
    expect(backend.warningVoices.length).toBe(1); // warning layer added
  });

  it("leaving fortress-under-attack removes the warning layer", () => {
    const { backend, director } = setup();
    director.setState("battle-low");
    director.setState("fortress-under-attack");
    director.setState("battle-high");
    expect(backend.warningVoices[0].stopped).toBe(true);
  });

  it("victory locks out lower-priority states until reset()", () => {
    const { backend, director } = setup();
    director.setState("battle-high");
    director.setState("victory");

    director.setState("battle-low"); // should be blocked
    expect(director.state).toBe("victory");
    expect(backend.bgmVoices.filter((v) => !v.stopped).length).toBe(1); // still the victory track

    director.reset("menu");
    director.setState("battle-low"); // allowed again after reset
    expect(director.state).toBe("battle-low");
  });

  it("defeat also locks, independent of victory", () => {
    const { director } = setup();
    director.setState("battle-low");
    director.setState("defeat");
    director.setState("preparation"); // blocked
    expect(director.state).toBe("defeat");
  });
});
