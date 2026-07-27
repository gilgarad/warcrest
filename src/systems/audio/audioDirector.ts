import { BgmManager } from "./bgmManager";
import type { BgmStateId } from "./types";

const STATE_PRIORITY: Record<BgmStateId, number> = {
  menu: 10,
  preparation: 10,
  "battle-low": 10,
  "battle-high": 10,
  "fortress-under-attack": 50,
  victory: 100,
  defeat: 100,
};

const VICTORY_DEFEAT_PRIORITY = STATE_PRIORITY.victory;

const STATE_TO_BGM: Partial<Record<BgmStateId, string>> = {
  menu: "bgm.menu",
  preparation: "bgm.preparation",
  "battle-low": "bgm.battle.low",
  "battle-high": "bgm.battle.high",
  victory: "bgm.victory",
  defeat: "bgm.defeat",
};

/**
 * Situational music state machine. NOT wired into any scene yet — see the
 * integration guide in docs/dev-wiki/audio-system-prototype.md for where
 * `setState()` calls would go once a follow-up session connects it.
 */
export class AudioDirector {
  private currentState: BgmStateId | null = null;
  /** Set once victory/defeat is reached; blocks any lower-priority state until reset(). */
  private locked = false;
  private crossfadeDurationMs = 1200;

  constructor(private readonly bgm: BgmManager) {}

  get state(): BgmStateId | null {
    return this.currentState;
  }

  setCrossfadeDuration(ms: number): void {
    this.crossfadeDurationMs = ms;
  }

  setState(next: BgmStateId): void {
    if (next === this.currentState) return; // repeated same-state requests are ignored

    if (this.locked && STATE_PRIORITY[next] < VICTORY_DEFEAT_PRIORITY) {
      // victory/defeat protects itself from being overwritten until reset()
      return;
    }

    if (next === "fortress-under-attack") {
      // No dedicated track — layer a warning sting on top of whatever's
      // already playing instead of switching the main BGM.
      this.bgm.setWarningLayer(true);
      this.currentState = next;
      return;
    }

    this.bgm.setWarningLayer(false);

    const bgmId = STATE_TO_BGM[next];
    if (bgmId) {
      const isBattleIntensitySwap =
        (this.currentState === "battle-low" && next === "battle-high") ||
        (this.currentState === "battle-high" && next === "battle-low");
      this.bgm.crossfadeTo(bgmId, isBattleIntensitySwap ? this.crossfadeDurationMs : Math.min(600, this.crossfadeDurationMs));
    }

    this.currentState = next;
    if (next === "victory" || next === "defeat") this.locked = true;
  }

  /** Clears the victory/defeat lock and moves to `next` (default: menu). */
  reset(next: BgmStateId = "menu"): void {
    this.locked = false;
    this.currentState = null;
    this.setState(next);
  }
}
