import type { BgmStateId } from "./types";

export interface BattleAudioSnapshot {
  nowMs: number;
  engagedUnits: number;
  activeProjectiles: number;
  recentAttackEvents: number;
  playerBaseHpRatio: number;
  playerFortressHpRatio: number;
}

export interface BattleAudioDecision {
  state: Extract<BgmStateId, "preparation" | "battle-low" | "battle-high">;
  triggerFortressWarning: boolean;
}

const HIGH_ENTER_ENGAGED = 6;
const HIGH_EXIT_ENGAGED = 2;
const HIGH_ENTER_EVENTS = 7;
const HIGH_MIN_HOLD_MS = 6000;
const COMBAT_TAIL_MS = 2800;
const WARNING_ENTER_RATIO = 0.35;
const WARNING_RESET_RATIO = 0.48;
const WARNING_COOLDOWN_MS = 12000;

export class BattleAudioStateMachine {
  private current: BattleAudioDecision["state"] = "preparation";
  private highEnteredAtMs = -Infinity;
  private lastCombatAtMs = -Infinity;
  private warningLatched = false;
  private lastWarningAtMs = -Infinity;

  get state(): BattleAudioDecision["state"] {
    return this.current;
  }

  update(snapshot: BattleAudioSnapshot): BattleAudioDecision {
    const combatNow = snapshot.engagedUnits > 0
      || snapshot.activeProjectiles > 0
      || snapshot.recentAttackEvents > 0;
    if (combatNow) this.lastCombatAtMs = snapshot.nowMs;

    const wantsHigh = snapshot.engagedUnits >= HIGH_ENTER_ENGAGED
      || snapshot.activeProjectiles >= 3
      || snapshot.recentAttackEvents >= HIGH_ENTER_EVENTS;
    if (this.current !== "battle-high" && wantsHigh) {
      this.current = "battle-high";
      this.highEnteredAtMs = snapshot.nowMs;
    } else if (this.current === "battle-high") {
      const minimumHoldComplete = snapshot.nowMs - this.highEnteredAtMs >= HIGH_MIN_HOLD_MS;
      const pressureReleased = snapshot.engagedUnits <= HIGH_EXIT_ENGAGED
        && snapshot.activeProjectiles === 0
        && snapshot.recentAttackEvents <= 1;
      if (minimumHoldComplete && pressureReleased) {
        this.current = snapshot.nowMs - this.lastCombatAtMs < COMBAT_TAIL_MS
          ? "battle-low"
          : "preparation";
      }
    } else if (combatNow || snapshot.nowMs - this.lastCombatAtMs < COMBAT_TAIL_MS) {
      this.current = "battle-low";
    } else {
      this.current = "preparation";
    }

    const riskRatio = Math.min(snapshot.playerBaseHpRatio, snapshot.playerFortressHpRatio);
    if (this.warningLatched && riskRatio >= WARNING_RESET_RATIO) this.warningLatched = false;
    let triggerFortressWarning = false;
    if (
      !this.warningLatched
      && riskRatio <= WARNING_ENTER_RATIO
      && snapshot.nowMs - this.lastWarningAtMs >= WARNING_COOLDOWN_MS
    ) {
      this.warningLatched = true;
      this.lastWarningAtMs = snapshot.nowMs;
      triggerFortressWarning = true;
    }

    return { state: this.current, triggerFortressWarning };
  }

  reset(): void {
    this.current = "preparation";
    this.highEnteredAtMs = -Infinity;
    this.lastCombatAtMs = -Infinity;
    this.warningLatched = false;
    this.lastWarningAtMs = -Infinity;
  }
}
