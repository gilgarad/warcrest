import { describe, it, expect } from "vitest";
import { SfxManager } from "../sfxManager";
import { MockAudioBackend } from "./mockBackend";

describe("SfxManager", () => {
  it("returns 'missing' for an unknown audio id instead of pretending it played", () => {
    const backend = new MockAudioBackend();
    const sfx = new SfxManager(backend);
    expect(sfx.play("sfx.does.not.exist")).toBe("missing");
    expect(backend.sfxVoices.length).toBe(0);
  });

  it("enforces per-id cooldown", () => {
    const backend = new MockAudioBackend();
    const sfx = new SfxManager(backend);
    expect(sfx.play("sfx.ui.confirm")).toBe("played");
    expect(sfx.play("sfx.ui.confirm")).toBe("cooldown"); // same backend.nowMs (0) as before
    expect(backend.sfxVoices.length).toBe(1);
  });

  it("allows play again once cooldown has elapsed", () => {
    const backend = new MockAudioBackend();
    const sfx = new SfxManager(backend);
    sfx.play("sfx.ui.confirm");
    backend.time += 10_000; // well past any cooldown in the manifest
    expect(sfx.play("sfx.ui.confirm")).toBe("played");
    expect(backend.sfxVoices.length).toBe(2);
  });

  it("enforces maxSimultaneous per id", () => {
    const backend = new MockAudioBackend();
    const sfx = new SfxManager(backend);
    // sfx.combat.unitHit: cooldownMs 40, maxSimultaneous 8 in the manifest —
    // advance time past cooldown between each play so only the concurrency
    // cap is being tested, not the cooldown.
    let played = 0;
    for (let i = 0; i < 12; i++) {
      backend.time += 100;
      if (sfx.play("sfx.combat.unitHit") === "played") played += 1;
    }
    expect(played).toBe(8);
    expect(backend.sfxVoices.length).toBe(8);
  });

  it("a finished voice frees up a concurrency slot", () => {
    const backend = new MockAudioBackend();
    const sfx = new SfxManager(backend);
    backend.time = 0;
    sfx.play("sfx.combat.unitHit");
    backend.sfxVoices[0].stop(); // simulate the voice finishing naturally
    backend.time += 1000;
    expect(sfx.play("sfx.combat.unitHit")).toBe("played");
  });

  it("mute silences all future plays via effective volume 0", () => {
    const backend = new MockAudioBackend();
    const sfx = new SfxManager(backend);
    sfx.setVolumes(1, 1, true, "full");
    sfx.play("sfx.ui.confirm");
    expect(backend.sfxVoices[0].lastVolume).toBe(0);
  });

  it("stopAll() stops every currently tracked voice", () => {
    const backend = new MockAudioBackend();
    const sfx = new SfxManager(backend);
    sfx.play("sfx.ui.confirm");
    backend.time += 1000;
    sfx.play("sfx.ui.cancel");
    sfx.stopAll();
    expect(backend.sfxVoices.every((v) => v.stopped)).toBe(true);
  });
});
