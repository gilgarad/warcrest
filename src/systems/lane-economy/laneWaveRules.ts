import {
  getAgeBalance,
  getOpponentScale,
  INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC,
  WAVE_INTERVAL_SEC,
} from "../../data/balance";
import { getWaveRoster, type AgeWaveRoster } from "../../data/unitRosters";
import type { TeamState } from "./laneEconomy";

export interface WaveClockResult {
  prepareWarning: boolean;
  due: boolean;
}

export interface WaveDeploymentPlan {
  roster: AgeWaveRoster;
  foodCost: number;
  canDeploy: boolean;
}

export type InstantWaveEligibility = "ready" | "no-token" | "cooldown";

export function tickWaveClock(team: TeamState, deltaSec: number, prepareWarningSec = 10): WaveClockResult {
  const previous = team.nextWaveInSec;
  team.nextWaveInSec -= deltaSec;
  team.lastWaveElapsedSec += deltaSec;
  return {
    prepareWarning: previous > prepareWarningSec && team.nextWaveInSec <= prepareWarningSec,
    due: team.nextWaveInSec <= 0,
  };
}

export function createWaveDeploymentPlan(team: TeamState, opponentCount: 1 | 2 | 3): WaveDeploymentPlan {
  const foodCost = Math.round(
    getAgeBalance(team.selectedProductionAgeId).baseWaveFoodCost * getOpponentScale(opponentCount).foodCostMultiplier,
  );
  return {
    roster: getWaveRoster(team.selectedProductionAgeId),
    foodCost,
    canDeploy: team.resources.food >= foodCost,
  };
}

export function commitWaveDeployment(team: TeamState, foodCost: number): void {
  team.resources.food -= foodCost;
  resetWaveClock(team);
}

export function resetWaveClock(team: TeamState): void {
  team.nextWaveInSec = WAVE_INTERVAL_SEC;
  team.lastWaveElapsedSec = 0;
}

export function getInstantWaveEligibility(team: TeamState): InstantWaveEligibility {
  if (team.instantWaveTokens <= 0) return "no-token";
  if (team.lastWaveElapsedSec < INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC) return "cooldown";
  return "ready";
}

export function shouldAiUseInstantWave(team: TeamState, minimumRemainingSec: number): boolean {
  return getInstantWaveEligibility(team) === "ready" && team.nextWaveInSec > minimumRemainingSec;
}
