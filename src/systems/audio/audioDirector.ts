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
 * Scene-facing state changes are routed through AudioSystem so terminal-state
 * locking and warning-layer cleanup remain centralized.
 */
export class AudioDirector {
  private currentState: BgmStateId | null = null;
  /** Set once victory/defeat is reached; blocks any lower-priority state until reset(). */
  private locked = false;
  private crossfadeDurationMs = 1200;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;

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

    if (next === "fortress-under-attack") return this.triggerFortressWarning("battle-low");

    this.clearWarningTimer();
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

  triggerFortressWarning(returnState: Extract<BgmStateId, "preparation" | "battle-low" | "battle-high">): void {
    if (this.locked) return;
    this.clearWarningTimer();
    this.bgm.setWarningLayer(true);
    this.currentState = "fortress-under-attack";
    this.warningTimer = setTimeout(() => {
      this.warningTimer = null;
      this.bgm.setWarningLayer(false);
      this.currentState = null;
      this.setState(returnState);
    }, 1800);
  }

  /** Clears the victory/defeat lock and moves to `next` (default: menu). */
  reset(next: BgmStateId = "menu"): void {
    this.clearWarningTimer();
    this.bgm.setWarningLayer(false);
    this.locked = false;
    this.currentState = null;
    this.setState(next);
  }

  destroy(): void {
    this.clearWarningTimer();
    this.bgm.setWarningLayer(false);
  }

  private clearWarningTimer(): void {
    if (this.warningTimer === null) return;
    clearTimeout(this.warningTimer);
    this.warningTimer = null;
  }
}
