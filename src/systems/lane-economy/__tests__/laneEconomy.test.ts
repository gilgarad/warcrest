import { describe, expect, it } from "vitest";
import {
  advanceTeamAge,
  canAfford,
  createTeamState,
  getAgeUpCost,
  makeResourceMap,
  payCost,
  shouldAdvanceAiAge,
  tickLaneEconomy,
} from "../laneEconomy";

describe("lane economy", () => {
  it("produces one resource per assigned worker every five seconds", () => {
    const team = createTeamState("player", makeResourceMap(0, 0, 0, 0), 400);
    team.workers.gold = 2;
    team.workers.wood = 3;
    team.workers.food = 4;
    team.workers.metal = 2;
    team.workers.research = 2;
    tickLaneEconomy([team], new Map(), 5);
    expect(team.resources.gold).toBe(2);
    expect(team.resources.wood).toBe(3);
    expect(team.resources.food).toBe(4);
    expect(team.resources.metal).toBe(2);
    expect(team.resources.research).toBe(0);
    tickLaneEconomy([team], new Map([["player:research", 5]]), 5);
    expect(team.resources.research).toBe(2);
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
    team.selectedProductionAgeId = "stone";
    expect(advanceTeamAge(team)).toBe(true);
    expect(team.ageId).toBe("bronze");
    expect(team.selectedProductionAgeId).toBe("bronze");
  });

});
