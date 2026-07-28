import { describe, expect, it } from "vitest";
import { CAPTURE_POINT_DEFINITIONS } from "../../data/capturePointDefinitions";
import { createTeamState, makeResourceMap } from "../../systems/lane-economy/laneEconomy";
import { createLaneBattleHudSnapshot } from "../laneBattleHudModel";

describe("lane battle HUD model", () => {
  it("formats economy, wave, and worker state without Phaser objects", () => {
    const player = createTeamState("player", makeResourceMap(10.4, 20.6, 30.9, 40.2), 400);
    const enemy = createTeamState("enemy", makeResourceMap(0, 0, 0, 0), 400);
    player.workers.idle = 2;
    const snapshot = createLaneBattleHudSnapshot({
      player,
      enemy,
      playerUnitCount: 4,
      enemyUnitCount: 3,
      playerBaseMaxHp: 400,
      enemyBaseMaxHp: 400,
      opponentCount: 1,
    });

    expect(snapshot.resources).toMatchObject({ gold: "10", wood: "21", food: "30", metal: "40" });
    expect(snapshot.baseText).toBe("전장 병력 4 | 적 병력 3");
    expect(snapshot.workers.gold.canIncrease).toBe(true);
    expect(snapshot.captureTitle).toBe("거점 선택");
  });

  it("distinguishes fixed-fortress copy from buildable-point copy", () => {
    const player = createTeamState("player", makeResourceMap(0, 0, 0, 0), 400);
    const enemy = createTeamState("enemy", makeResourceMap(0, 0, 0, 0), 400);
    const snapshot = createLaneBattleHudSnapshot({
      player,
      enemy,
      playerUnitCount: 0,
      enemyUnitCount: 0,
      playerBaseMaxHp: 400,
      enemyBaseMaxHp: 400,
      opponentCount: 1,
      selectedCapturePoint: {
        id: 1,
        definition: {
          ...CAPTURE_POINT_DEFINITIONS[1],
          pointType: "fixed-fortress",
          initialBuilding: "fixed-fortress",
          allowedBuildingTypes: [],
          canDemolish: false,
          canRepair: true,
          canReplaceBuilding: false,
        },
        owner: "player",
        control: 1,
        buildingLevel: 0,
        towerBuilt: true,
        towerBuildRemainingSec: 0,
        towerHp: 130,
        towerMaxHp: 130,
      },
    });

    expect(snapshot.captureTitle).toContain("고정 요새");
    expect(snapshot.captureLines).toContain("고정 요새 전용 | 교체·폐기 불가");
  });
});
