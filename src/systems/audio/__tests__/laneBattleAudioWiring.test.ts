import { describe, expect, it, vi } from "vitest";
import type { AudioSystem } from "../audioSystem";
import { LaneBattleAudioWiring } from "../laneBattleAudioWiring";

function createAudioPort() {
  const state = {
    contextState: "running",
    unlocked: true,
    bgmState: "preparation",
    currentBgmId: "bgm.age.stone",
    gameplayMusicTheme: "stone",
    activeBgmVoices: 1,
    activeSfxVoices: 0,
    settings: { masterVolume: 1, bgmVolume: 0.5, sfxVolume: 0.8, mute: false, combatSfxMode: "full" },
    missingAssetFallback: false,
    skippedEventCount: 0,
    recentEvents: [],
  };
  return {
    port: {
      getState: vi.fn(() => state),
      playSfx: vi.fn(),
      setDirectorState: vi.fn(),
      triggerFortressWarning: vi.fn(),
    } as unknown as AudioSystem,
    state,
  };
}

describe("lane battle audio wiring", () => {
  it("owns the throttled battle-state update policy", () => {
    const { port } = createAudioPort();
    const wiring = new LaneBattleAudioWiring(port);
    const metrics = { engagedUnits: 1, activeProjectiles: 0, playerBaseHpRatio: 1, playerFortressHpRatio: 1 };

    expect(wiring.update(1, metrics)?.state).toBe("battle-low");
    expect(wiring.update(1.2, metrics)).toBeNull();
    expect(port.setDirectorState).toHaveBeenCalledTimes(1);
  });

  it("applies camera-relative mix and records high-frequency combat", () => {
    const { port } = createAudioPort();
    const wiring = new LaneBattleAudioWiring(port);

    wiring.playWorldSfx(
      "sfx.combat.melee",
      { x: 100, y: 100 },
      { centerX: 100, centerY: 100, width: 1600, height: 900, zoom: 1 },
      "hit:1",
      2,
    );

    expect(port.playSfx).toHaveBeenCalledWith("sfx.combat.melee", expect.objectContaining({
      eventKey: "hit:1",
      highFrequency: true,
      volumeMultiplier: 1,
      pan: 0,
    }));
  });
});
