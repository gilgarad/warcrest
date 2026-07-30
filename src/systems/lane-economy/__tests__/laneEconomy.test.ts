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
  it("only keeps metal worker production on the passive economy tick", () => {
    const team = createTeamState("player", makeResourceMap(0, 0, 0, 0), 400);
    team.workers.metal = 2;
    tickLaneEconomy([team], new Map(), 10);
    expect(team.resources.gold).toBe(0);
    expect(team.resources.wood).toBe(0);
    expect(team.resources.food).toBe(0);
    expect(team.resources.metal).toBe(2);
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

});
