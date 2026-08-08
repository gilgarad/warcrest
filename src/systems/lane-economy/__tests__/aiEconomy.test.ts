import { describe, expect, it } from "vitest";
import { createTeamState, makeResourceMap } from "../laneEconomy";
import {
  createAiEconomyState,
  pickNeediestResourceRole,
  planAiWorkerRebalance,
  shouldAiHireResearchWorker,
  shouldAiHireWorker,
} from "../aiEconomy";

describe("AI economy pacing", () => {
  it("hires a worker once affordable with reserve, then waits out its cooldown", () => {
    const team = createTeamState("enemy", makeResourceMap(1000, 1000, 1000, 1000), 400);
    const state = createAiEconomyState();
    expect(shouldAiHireWorker(team, 0, state)).toBe(true);
    state.lastHireAttemptSec = 0;
    expect(shouldAiHireWorker(team, 2, state)).toBe(false);
    expect(shouldAiHireWorker(team, 7, state)).toBe(true);
  });

  it("refuses to hire a worker that would eat into the age-up reserve", () => {
    const team = createTeamState("enemy", makeResourceMap(0, 0, 0, 0), 400);
    team.resources.gold = 5;
    team.resources.wood = 5;
    team.resources.food = 9;
    const state = createAiEconomyState();
    expect(shouldAiHireWorker(team, 0, state)).toBe(false);
  });

  it("only buys a research worker once research is active for the age, and only once", () => {
    const team = createTeamState("enemy", makeResourceMap(0, 0, 0, 0), 400);
    team.resources.gold = 9999;
    team.resources.wood = 9999;
    team.resources.food = 9999;
    team.resources.metal = 9999;
    expect(shouldAiHireResearchWorker(team)).toBe(false);
    team.ageId = "renaissance";
    team.selectedProductionAgeId = "renaissance";
    expect(shouldAiHireResearchWorker(team)).toBe(true);
    team.workers.research = 1;
    expect(shouldAiHireResearchWorker(team)).toBe(false);
  });

  it("directs a freshly hired worker toward food when wave upkeep dominates", () => {
    const team = createTeamState("enemy", makeResourceMap(0, 0, 0, 0), 400);
    team.workers.gold = 5;
    team.workers.wood = 5;
    team.workers.metal = 5;
    team.workers.food = 0;
    expect(pickNeediestResourceRole(team)).toBe("food");
  });

  it("rebalances a worker only when the imbalance is large and respects its cooldown", () => {
    const team = createTeamState("enemy", makeResourceMap(0, 0, 0, 0), 400);
    team.workers.gold = 1;
    team.workers.wood = 1;
    team.workers.food = 5;
    team.workers.metal = 1;
    const state = createAiEconomyState();
    const plan = planAiWorkerRebalance(team, 0, state);
    expect(plan?.from).toBe("food");
    state.lastRebalanceSec = 0;
    expect(planAiWorkerRebalance(team, 3, state)).toBeNull();
  });

  it("never proposes stripping the sole remaining assigned worker", () => {
    const team = createTeamState("enemy", makeResourceMap(0, 0, 0, 0), 400);
    team.workers.gold = 1;
    team.workers.wood = 0;
    team.workers.food = 0;
    team.workers.metal = 0;
    const state = createAiEconomyState();
    expect(planAiWorkerRebalance(team, 0, state)).toBeNull();
  });
});
