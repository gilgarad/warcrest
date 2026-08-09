import { describe, expect, it } from "vitest";
import { getDefenseTowerTexture } from "../../presentation/structures/productionStructureRegistry";
import { createTeamState, makeResourceMap } from "../../systems/lane-economy/laneEconomy";
import { adjustDraftResearchLevel } from "../../systems/lane-economy/researchRules";
import { createTeamResearchState } from "../../systems/lane-economy/researchState";
import { createBaseResearchPanelSnapshot, getBrowsableAgeIds } from "../baseResearchPanelModel";

describe("base research panel model", () => {
  it("limits browsable ages to the current age and reports draft cost", () => {
    const team = createTeamState("player", makeResourceMap(20, 20, 20, 20, 80), 400);
    team.ageId = "iron_late";
    team.selectedProductionAgeId = "bronze";
    const researchState = createTeamResearchState();

    adjustDraftResearchLevel(researchState, "bronze", "bronze_swordsman", "attack", 1);
    adjustDraftResearchLevel(researchState, "bronze", "bronze_swordsman", "defense", 1);

    const snapshot = createBaseResearchPanelSnapshot({
      team,
      researchState,
      viewedAgeId: "bronze",
    });

    expect(getBrowsableAgeIds(team.ageId)).toEqual(["stone", "bronze", "iron_early", "iron_mid", "iron_late"]);
    expect(snapshot.ageLabel).toContain("청동기");
    expect(snapshot.ageLabel).toContain("현재 시대 후기 철기");
    expect(snapshot.researchText).toContain("적용 비용 40R");
    expect(snapshot.capText).toContain("1포인트당 20R");
    expect(snapshot.applyEnabled).toBe(true);
    expect(snapshot.rows[0]?.label).toBe("투석");
  });

  it("surfaces all late-era rows plus the current-age tower row", () => {
    const team = createTeamState("player", makeResourceMap(20, 20, 20, 20, 0), 400);
    team.ageId = "modern_late";
    team.selectedProductionAgeId = "modern_late";
    const researchState = createTeamResearchState();

    const snapshot = createBaseResearchPanelSnapshot({
      team,
      researchState,
      viewedAgeId: "modern_late",
    });

    expect(snapshot.rows).toHaveLength(6);
    expect(snapshot.rows.map((row) => row.label)).toEqual([
      "특수보병",
      "중화기병",
      "돌파병",
      "자주포",
      "현대 전차",
      "방어 타워",
    ]);
    expect(snapshot.rows[snapshot.rows.length - 1]?.iconTextureKey).toBe(getDefenseTowerTexture("modern_late", "full", "player"));
  });
});
