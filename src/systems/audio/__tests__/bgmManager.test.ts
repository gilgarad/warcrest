import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BgmManager } from "../bgmManager";
import { MockAudioBackend } from "./mockBackend";

describe("BgmManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not create a duplicate voice when the same track is requested again", () => {
    const backend = new MockAudioBackend();
    const bgm = new BgmManager(backend);
    bgm.play("bgm.menu");
    bgm.play("bgm.menu");
    expect(backend.bgmVoices.length).toBe(1);
  });

  it("play() stops the previous voice before starting the next", () => {
    const backend = new MockAudioBackend();
    const bgm = new BgmManager(backend);
    bgm.play("bgm.menu");
    const first = backend.bgmVoices[0];
    bgm.play("bgm.battle.low");
    expect(first.stopped).toBe(true);
    expect(bgm.currentAssetId).toBe("bgm.battle.low");
  });

  it("re-issuing crossfadeTo mid-fade does not leak timers or voices", () => {
    // Fade-in/fade-out is delegated to the backend's own gain ramp (a
    // single stop(fadeMs)/playBgmVoice(..., fadeInMs) call each), not a
    // JS-side setInterval in BgmManager — so "interrupting mid-fade" just
    // means calling crossfadeTo again before the backend's ramp finishes.
    // BgmManager itself holds no timer state, so there's nothing for it to
    // leak; this test pins that down.
    const backend = new MockAudioBackend();
    const bgm = new BgmManager(backend);
    bgm.play("bgm.menu");

    bgm.crossfadeTo("bgm.battle.low", 1000);
    vi.advanceTimersByTime(300); // "interrupt" partway through the backend's fade
    bgm.crossfadeTo("bgm.battle.high", 1000);
    vi.advanceTimersByTime(2000);

    // Exactly 3 bgm voices total ever created (menu, battle.low, battle.high) —
    // no extra voices spawned by the interrupted transition.
    expect(backend.bgmVoices.length).toBe(3);
    expect(bgm.currentAssetId).toBe("bgm.battle.high");
    const [menuVoice, lowVoice, highVoice] = backend.bgmVoices;
    expect(menuVoice.stopped).toBe(true);
    expect(lowVoice.stopped).toBe(true); // superseded before its fade finished — still told to stop
    expect(highVoice.stopped).toBe(false);
  });

  it("stop() clears the active track and stops its voice", () => {
    const backend = new MockAudioBackend();
    const bgm = new BgmManager(backend);
    bgm.play("bgm.menu");
    bgm.stop(0);
    expect(bgm.currentAssetId).toBeNull();
    expect(backend.bgmVoices[0].stopped).toBe(true);
  });

  it("setWarningLayer(true) adds exactly one layer regardless of repeats, and removes it cleanly", () => {
    const backend = new MockAudioBackend();
    const bgm = new BgmManager(backend);
    bgm.play("bgm.battle.low");

    bgm.setWarningLayer(true);
    bgm.setWarningLayer(true); // repeat should be a no-op
    expect(backend.warningVoices.length).toBe(1);
    expect(bgm.activeVoiceCount).toBe(2); // main track + warning layer

    bgm.setWarningLayer(false);
    expect(backend.warningVoices[0].stopped).toBe(true);
    expect(bgm.activeVoiceCount).toBe(1);
  });

  it("mute silences the active track via setVolume(0)", () => {
    const backend = new MockAudioBackend();
    const bgm = new BgmManager(backend);
    bgm.play("bgm.menu");
    bgm.setVolumes(1, 1, true);
    expect(backend.bgmVoices[0].lastVolume).toBe(0);
  });

  it("destroy() stops every active voice", () => {
    const backend = new MockAudioBackend();
    const bgm = new BgmManager(backend);
    bgm.play("bgm.menu");
    bgm.setWarningLayer(true);
    bgm.destroy();
    expect(backend.bgmVoices[0].stopped).toBe(true);
    expect(backend.warningVoices[0].stopped).toBe(true);
  });
});
