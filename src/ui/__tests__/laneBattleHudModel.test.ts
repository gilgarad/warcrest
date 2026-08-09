import { describe, expect, it } from "vitest";
import { DEFENSE_TOWER_DEFINITIONS } from "../../data/defenseTowerDefinitions";
import { createTeamState, makeResourceMap } from "../../systems/lane-economy/laneEconomy";
import { createLaneBattleHudSnapshot } from "../laneBattleHudModel";

describe("lane battle HUD model", () => {
  it("formats economy, wave, and worker state without Phaser objects", () => {
    const player = createTeamState("player", makeResourceMap(10.4, 20.6, 30.9, 40.2, 3.7), 400);
    const enemy = createTeamState("enemy", makeResourceMap(0, 0, 0, 0), 400);
    player.workers.idle = 2;
    player.ageId = "iron_late";
    player.selectedProductionAgeId = "bronze";
    const snapshot = createLaneBattleHudSnapshot({
      player,
      enemy,
      playerUnitCount: 4,
      enemyUnitCount: 3,
      playerBaseMaxHp: 400,
      enemyBaseMaxHp: 400,
      opponentCount: 1,
    });

    expect(snapshot.resources).toMatchObject({ gold: "10", wood: "21", food: "30", metal: "40", research: "4" });
    expect(snapshot.ageText).toContain("생산 청동기");
    expect(snapshot.rosterLines[0]).toContain("생산 시대: 청동기");
    expect(snapshot.baseText).toBe("전장 병력 4 | 적 병력 3");
    expect(snapshot.workers.gold.canIncrease).toBe(true);
    expect(snapshot.workers.research.canIncrease).toBe(false);
    expect(snapshot.workers.research.canDecrease).toBe(false);
    expect(snapshot.assignedWorkersText).toBe("4");
    expect(snapshot.idleWorkersText).toBe("2");
    expect(snapshot.researchWorkersText).toBe("0");
    expect(snapshot.captureTitle).toBe("거점 또는 타워 선택");
  });

  it("distinguishes a defense tower from a construction capture point", () => {
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
      selectedDefenseTower: {
        id: 1,
        definition: DEFENSE_TOWER_DEFINITIONS[1],
        owner: "player",
        built: true,
        buildRemainingSec: 0,
        hp: 130,
        maxHp: 130,
      },
    });

    expect(snapshot.captureTitle).toContain("방어 타워");
    expect(snapshot.captureLines[2]).toContain("재건 비용");
  });
});
