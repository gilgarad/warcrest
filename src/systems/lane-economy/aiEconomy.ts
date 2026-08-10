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
const REBALANCE_INTERVAL_SEC = 2;
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
  const averageAgeUpNeed = ageUpCost
    ? (ageUpCost.gold + ageUpCost.wood + ageUpCost.metal) / 3
    : 1;
  return {
    gold: Math.max(averageAgeUpNeed * 0.8, (ageUpCost?.gold ?? 0) + 1),
    wood: Math.max(averageAgeUpNeed * 0.8, (ageUpCost?.wood ?? 0) + 1),
    metal: Math.max(averageAgeUpNeed * 0.8, (ageUpCost?.metal ?? 0) + 1),
    food: Math.max(averageAgeUpNeed * 0.9, Math.max(1, balance.baseWaveFoodCost) * 6),
  };
}

function getDesiredResourceReserve(team: TeamState, role: WorkerResourceId): number {
  const ageUpCost = nextAgeUpCost(team);
  const balance = getAgeBalance(team.ageId);
  if (role === "food") return Math.max(18, balance.baseWaveFoodCost * 3);
  const cost = ageUpCost?.[role] ?? 0;
  return Math.max(18, Math.round(cost * 0.28));
}

function getCriticalShortageRole(team: TeamState): WorkerResourceId | null {
  const deficits = WORKER_RESOURCE_IDS
    .map((role) => {
      const desired = getDesiredResourceReserve(team, role);
      const have = team.resources[role];
      return { role, ratio: desired <= 0 ? 0 : (desired - have) / desired };
    })
    .sort((a, b) => b.ratio - a.ratio);
  return deficits[0] && deficits[0].ratio > 0.22 ? deficits[0].role : null;
}

function getSurplusRoleForRebalance(team: TeamState, protectedRole: WorkerResourceId): WorkerResourceId | null {
  const surpluses = WORKER_RESOURCE_IDS
    .filter((role) => role !== protectedRole && team.workers[role] > 1)
    .map((role) => {
      const desired = getDesiredResourceReserve(team, role);
      const have = team.resources[role];
      return {
        role,
        ratio: desired <= 0 ? 0 : (have - desired) / desired,
        workers: team.workers[role],
      };
    })
    .sort((a, b) => {
      if (Math.abs(b.ratio - a.ratio) > 0.001) return b.ratio - a.ratio;
      return b.workers - a.workers;
    });
  return surpluses[0] && (surpluses[0].ratio > 0.35 || surpluses[0].workers >= 3) ? surpluses[0].role : null;
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
  const criticalShortage = getCriticalShortageRole(team);
  if (criticalShortage) return criticalShortage;
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

  const criticalShortage = getCriticalShortageRole(team);
  if (criticalShortage) {
    const donor = getSurplusRoleForRebalance(team, criticalShortage);
    if (donor) return { from: donor, to: criticalShortage };
  }

  const weights = computeResourceNeedWeights(team);
  const totalWeight = WORKER_RESOURCE_IDS.reduce((sum, role) => sum + weights[role], 0);
  const gaps: { role: WorkerResourceId; gap: number }[] = WORKER_RESOURCE_IDS.map((role) => {
    const targetShare = weights[role] / totalWeight;
    const currentShare = team.workers[role] / totalAssigned;
    return { role, gap: targetShare - currentShare };
  });

  const best = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
  // Each base resource keeps a floor of 1 assigned worker, same as the
  // player's own worker panel — only a role with a *spare* worker above
  // that floor is eligible to be pulled from.
  const removable = gaps.filter((entry) => team.workers[entry.role] > 1);
  if (removable.length === 0) return null;
  const worst = removable.reduce((a, b) => (b.gap < a.gap ? b : a));

  if (best.role === worst.role) return null;
  const workerCounts = WORKER_RESOURCE_IDS.map((role) => ({ role, count: team.workers[role] }))
    .sort((a, b) => b.count - a.count);
  const spread = workerCounts[0].count - workerCounts[workerCounts.length - 1].count;
  if (spread >= 2 && workerCounts[0].role !== workerCounts[workerCounts.length - 1].role && team.workers[workerCounts[0].role] > 1) {
    return { from: workerCounts[0].role, to: workerCounts[workerCounts.length - 1].role };
  }

  // Only move a worker when the imbalance is large enough to matter — avoids
  // shuffling a single worker back and forth every cycle.
  if (best.gap - worst.gap < 0.1) return null;
  return { from: worst.role, to: best.role };
}
