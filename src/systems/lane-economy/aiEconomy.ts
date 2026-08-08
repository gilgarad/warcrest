import { getAge, getAgeIndex, isFinalAge } from "../../data/ages";
import { BASE_WORKER_COST, getAgeBalance, getResearchWorkerDirectCost, type ResourceCost } from "../../data/balance";
import type { ResourceId } from "../../data/resources";
import { getAgeUpCost, type TeamState, type WorkerResourceId } from "./laneEconomy";

/**
 * AI economic pacing state. The AI previously never grew or rebalanced its
 * workforce — `workers` stayed frozen at the 1/1/1/1/0 starting allocation
 * for the whole match while age-up costs compound ~1.5x per age. That left
 * age-up as the only thing the AI's frozen income could ever meaningfully
 * save toward, which is why it read as "AI only ever tries to age up."
 * These cooldowns throttle how often the AI re-evaluates hiring/rebalancing
 * so it doesn't thrash a worker back and forth every tick.
 */
export interface AiEconomyState {
  lastHireAttemptSec: number;
  lastRebalanceSec: number;
}

export function createAiEconomyState(): AiEconomyState {
  return { lastHireAttemptSec: -999, lastRebalanceSec: -999 };
}

const WORKER_RESOURCE_IDS: WorkerResourceId[] = ["gold", "wood", "food", "metal"];
const HIRE_INTERVAL_SEC = 6;
const REBALANCE_INTERVAL_SEC = 9;
/** Fraction of the next age-up cost kept in reserve before spending on anything else, so hiring/rebalancing never permanently starves the age-up the time-threshold gate is trying to reach. */
const AGE_UP_RESERVE_FRACTION = 0.15;

function nextAgeUpCost(team: TeamState): ResourceCost | null {
  if (isFinalAge(team.ageId)) return null;
  return getAgeUpCost(getAgeIndex(team.ageId));
}

function reserveForAgeUp(team: TeamState): Partial<Record<string, number>> {
  const cost = nextAgeUpCost(team);
  if (!cost) return {};
  return Object.fromEntries(
    Object.entries(cost).map(([resourceId, amount]) => [resourceId, Math.round(amount * AGE_UP_RESERVE_FRACTION)]),
  );
}

function canAffordWithAgeUpReserve(team: TeamState, cost: ResourceCost): boolean {
  const reserve = reserveForAgeUp(team);
  return Object.entries(cost).every(([resourceId, amount]) => {
    const have = team.resources[resourceId as ResourceId] ?? 0;
    const keep = reserve[resourceId] ?? 0;
    return have - keep >= amount;
  });
}

/**
 * Relative income-growth need per base resource, given what the team is
 * actually spending on:
 * - gold/wood/metal are weighted by the next age-up's cost composition,
 *   since that is the AI's single biggest recurring expense.
 * - food is weighted by the *recurring* per-wave spawn cost instead of the
 *   age-up cost (food isn't part of age-up cost at all, but starving it
 *   stalls wave production, which is worse than a delayed age-up).
 * Exported so both worker rebalancing and idle-worker assignment use the
 * same notion of "what does this economy need right now."
 */
export function computeResourceNeedWeights(team: TeamState): Record<WorkerResourceId, number> {
  const ageUpCost = nextAgeUpCost(team);
  const balance = getAgeBalance(team.ageId);
  return {
    gold: (ageUpCost?.gold ?? 0) + 1,
    wood: (ageUpCost?.wood ?? 0) + 1,
    metal: (ageUpCost?.metal ?? 0) + 1,
    food: Math.max(1, balance.baseWaveFoodCost) * 4,
  };
}

export function shouldAiHireWorker(team: TeamState, elapsedSec: number, state: AiEconomyState): boolean {
  if (elapsedSec - state.lastHireAttemptSec < HIRE_INTERVAL_SEC) return false;
  return canAffordWithAgeUpReserve(team, BASE_WORKER_COST);
}

export function shouldAiHireResearchWorker(team: TeamState): boolean {
  if (!getAge(team.ageId).activeResourceIds.includes("research")) return false;
  if (team.workers.research >= 1) return false;
  return canAffordWithAgeUpReserve(team, getResearchWorkerDirectCost(team.ageId));
}

/** Which currently-assigned resource role has the largest shortfall vs. its need weight — used to place a freshly hired idle worker. */
export function pickNeediestResourceRole(team: TeamState): WorkerResourceId {
  const weights = computeResourceNeedWeights(team);
  const totalAssigned = WORKER_RESOURCE_IDS.reduce((sum, role) => sum + team.workers[role], 0);
  const totalWeight = WORKER_RESOURCE_IDS.reduce((sum, role) => sum + weights[role], 0);
  let best: WorkerResourceId = "gold";
  let bestGap = -Infinity;
  WORKER_RESOURCE_IDS.forEach((role) => {
    const targetShare = weights[role] / totalWeight;
    const currentShare = totalAssigned > 0 ? team.workers[role] / totalAssigned : 0;
    const gap = targetShare - currentShare;
    if (gap > bestGap) {
      bestGap = gap;
      best = role;
    }
  });
  return best;
}

export function planAiWorkerRebalance(
  team: TeamState,
  elapsedSec: number,
  state: AiEconomyState,
): { from: WorkerResourceId; to: WorkerResourceId } | null {
  if (elapsedSec - state.lastRebalanceSec < REBALANCE_INTERVAL_SEC) return null;
  const totalAssigned = WORKER_RESOURCE_IDS.reduce((sum, role) => sum + team.workers[role], 0);
  if (totalAssigned <= 1) return null;

  const weights = computeResourceNeedWeights(team);
  const totalWeight = WORKER_RESOURCE_IDS.reduce((sum, role) => sum + weights[role], 0);
  const gaps: { role: WorkerResourceId; gap: number }[] = WORKER_RESOURCE_IDS.map((role) => {
    const targetShare = weights[role] / totalWeight;
    const currentShare = team.workers[role] / totalAssigned;
    return { role, gap: targetShare - currentShare };
  });

  const best = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
  const removable = gaps.filter((entry) => team.workers[entry.role] > 0);
  const worst = removable.reduce((a, b) => (b.gap < a.gap ? b : a));

  if (best.role === worst.role) return null;
  // Only move a worker when the imbalance is large enough to matter — avoids
  // shuffling a single worker back and forth every cycle.
  if (best.gap - worst.gap < 0.18) return null;
  return { from: worst.role, to: best.role };
}
