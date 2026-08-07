import { describe, expect, it } from "vitest";
import { createTeamState, makeResourceMap } from "../laneEconomy";
import {
  commitForcedWaveDeployment,
  commitWaveDeployment,
  createWaveDeploymentPlan,
  getInstantWaveEligibility,
  tickWaveClock,
} from "../laneWaveRules";

describe("lane wave rules", () => {
  it("reports the prepare threshold and due state from one clock", () => {
    const team = createTeamState("player", makeResourceMap(0, 0, 20, 0), 400);
    team.nextWaveInSec = 10.2;
    expect(tickWaveClock(team, 0.3)).toEqual({ prepareWarning: true, due: false });
    expect(tickWaveClock(team, 10)).toEqual({ prepareWarning: false, due: true });
  });

  it("plans and commits food-backed deployment atomically", () => {
    const team = createTeamState("player", makeResourceMap(0, 0, 5, 0), 400);
    const plan = createWaveDeploymentPlan(team, 1);
    expect(plan.foodCost).toBe(5);
    expect(plan.canDeploy).toBe(true);
    commitWaveDeployment(team, plan.foodCost);
    expect(team.resources.food).toBe(0);
    expect(team.lastWaveElapsedSec).toBe(0);
  });

  it("uses selected production age for roster and food cost", () => {
    const team = createTeamState("player", makeResourceMap(0, 0, 20, 0), 400);
    team.ageId = "iron_late";
    team.selectedProductionAgeId = "bronze";
    const plan = createWaveDeploymentPlan(team, 1);
    expect(plan.roster.ageId).toBe("bronze");
    expect(plan.foodCost).toBe(8);
  });

  it("distinguishes token absence from the post-wave cooldown", () => {
    const team = createTeamState("player", makeResourceMap(0, 0, 20, 0), 400);
    expect(getInstantWaveEligibility(team)).toBe("no-token");
    team.instantWaveTokens = 1;
    expect(getInstantWaveEligibility(team)).toBe("cooldown");
    team.lastWaveElapsedSec = 5;
    expect(getInstantWaveEligibility(team)).toBe("ready");
  });

  it("adds five seconds to the remaining timer after a forced wave", () => {
    const team = createTeamState("player", makeResourceMap(0, 0, 40, 0), 400);
    team.nextWaveInSec = 11;
    team.lastWaveElapsedSec = 7;
    commitForcedWaveDeployment(team, 5);
    expect(team.resources.food).toBe(35);
    expect(team.nextWaveInSec).toBe(16);
    expect(team.lastWaveElapsedSec).toBe(0);
  });
});
