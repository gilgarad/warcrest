import { describe, expect, it } from "vitest";
import {
  advanceTeamAge,
  canAfford,
  convertWorkersToResearch,
  createTeamState,
  getAgeUpCost,
  makeResourceMap,
  payCost,
  shouldAdvanceAiAge,
  tickLaneEconomy,
} from "../laneEconomy";

describe("lane economy", () => {
  it("ticks both passive food and worker production through one accumulator", () => {
    const team = createTeamState("player", makeResourceMap(0, 0, 0, 0), 400);
    team.workers.gold = 2;
    tickLaneEconomy([team], new Map(), 10);
    expect(team.resources.food).toBeGreaterThan(10);
    expect(team.resources.gold).toBe(2);
  });

  it("keeps affordability and payment as one shared rule", () => {
    const resources = makeResourceMap(35, 20, 0, 28);
    const cost = getAgeUpCost(0);
    expect(canAfford(resources, cost)).toBe(true);
    payCost(resources, cost);
    expect(resources).toMatchObject({ gold: 0, wood: 0, metal: 0 });
  });

  it("advances AI age only after time and cost gates", () => {
    const team = createTeamState("enemy", makeResourceMap(35, 20, 0, 28), 400);
    expect(shouldAdvanceAiAge(team, 54)).toBe(false);
    expect(shouldAdvanceAiAge(team, 55)).toBe(true);
    expect(advanceTeamAge(team)).toBe(true);
    expect(team.ageId).toBe("bronze");
  });

  it("converts workers atomically into research workers", () => {
    const team = createTeamState("player", makeResourceMap(0, 0, 0, 0), 400);
    team.workers.idle = 6;
    team.workers.gold = 4;
    expect(convertWorkersToResearch(team.workers, 10, 1)).toBe(true);
    expect(team.workers.research).toBe(1);
    expect(team.workers.idle + team.workers.gold).toBe(0);
  });
});
