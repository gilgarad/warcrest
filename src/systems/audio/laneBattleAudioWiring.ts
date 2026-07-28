import { BattleAudioStateMachine, type BattleAudioDecision } from "./battleAudioStateMachine";
import { calculateSpatialAudio, type AudioCameraView, type AudioWorldPoint } from "./spatialAudio";
import type { AudioSystem } from "./audioSystem";

type LaneBattleAudioPort = Pick<
  AudioSystem,
  "getState" | "playSfx" | "setDirectorState" | "triggerFortressWarning"
>;

export interface LaneBattleAudioMetrics {
  engagedUnits: number;
  activeProjectiles: number;
  playerBaseHpRatio: number;
  playerFortressHpRatio: number;
}

const STATE_UPDATE_INTERVAL_SEC = 0.45;
const RECENT_COMBAT_WINDOW_MS = 3000;

export class LaneBattleAudioWiring {
  private readonly stateMachine = new BattleAudioStateMachine();
  private readonly combatEventTimes: number[] = [];
  private nextStateUpdateSec = 0;

  constructor(private readonly audio: LaneBattleAudioPort) {}

  reset(): void {
    this.stateMachine.reset();
    this.combatEventTimes.length = 0;
    this.nextStateUpdateSec = 0;
  }

  recordCombatEvent(elapsedSec: number): void {
    this.combatEventTimes.push(elapsedSec * 1000);
  }

  update(elapsedSec: number, metrics: LaneBattleAudioMetrics): BattleAudioDecision | null {
    if (elapsedSec < this.nextStateUpdateSec) return null;
    this.nextStateUpdateSec = elapsedSec + STATE_UPDATE_INTERVAL_SEC;
    const nowMs = elapsedSec * 1000;
    while (this.combatEventTimes[0] !== undefined && this.combatEventTimes[0] < nowMs - RECENT_COMBAT_WINDOW_MS) {
      this.combatEventTimes.shift();
    }
    const decision = this.stateMachine.update({
      nowMs,
      ...metrics,
      recentAttackEvents: this.combatEventTimes.length,
    });
    if (this.audio.getState().bgmState !== "fortress-under-attack") {
      this.audio.setDirectorState(decision.state);
    }
    if (decision.triggerFortressWarning) {
      this.audio.playSfx("sfx.fortress.warning", { eventKey: "fortress:danger-entry" });
      this.audio.triggerFortressWarning(decision.state);
    }
    return decision;
  }

  playWorldSfx(
    assetId: string,
    point: AudioWorldPoint,
    camera: AudioCameraView,
    eventKey: string,
    elapsedSec: number,
    highFrequency = true,
  ): void {
    const mix = calculateSpatialAudio(point, camera);
    this.audio.playSfx(assetId, {
      eventKey,
      highFrequency,
      volumeMultiplier: mix.audible ? mix.volumeMultiplier : 0,
      pan: mix.pan,
    });
    if (highFrequency) this.recordCombatEvent(elapsedSec);
  }

  getDebugLines(): string[] {
    const state = this.audio.getState();
    return [
      `AUDIO ${state.contextState} ${state.unlocked ? "unlocked" : "locked"}`,
      `state ${state.bgmState ?? "-"} | ${state.currentBgmId ?? "queued"}`,
      `voices bgm ${state.activeBgmVoices} / sfx ${state.activeSfxVoices}`,
      `vol ${state.settings.masterVolume.toFixed(2)} · ${state.settings.bgmVolume.toFixed(2)} · ${state.settings.sfxVolume.toFixed(2)}`,
      `mute ${state.settings.mute} | combat ${state.settings.combatSfxMode}`,
      `fallback ${state.missingAssetFallback} | skipped ${state.skippedEventCount}`,
      ...state.recentEvents.slice(-4).map((event) => `${event.id.replace("sfx.", "")} ${event.result}`),
    ];
  }
}
