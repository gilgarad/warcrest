import { getAge } from "../data/ages";
import { getAgeBalance, getOpponentScale, MVP_ACTIVE_RESOURCE_IDS } from "../data/balance";
import type { CapturePointDefinition } from "../data/capturePointDefinitions";
import type { ResourceId } from "../data/resources";
import { getWaveRoster } from "../data/unitRosters";
import { DISMANTLE_COST_GOLD, getBuildingDefinition, type BuildingId } from "../systems/lane-capture/captureRules";
import type { TeamState, WorkerRole } from "../systems/lane-economy/laneEconomy";
import { UNIT_STATS } from "../systems/lane-units/unitStats";

export interface LaneHudCapturePoint {
  id: number;
  definition: CapturePointDefinition;
  owner: "player" | "enemy" | "neutral";
  control: number;
  buildingId?: Exclude<BuildingId, "watchtower">;
  buildingLevel: number;
  towerBuilt: boolean;
  towerBuildRemainingSec: number;
  towerHp: number;
  towerMaxHp: number;
}

export interface LaneBattleHudSnapshot {
  ageText: string;
  waveText: string;
  baseText: string;
  tokensText: string;
  resources: Record<ResourceId, string>;
  workers: Record<WorkerRole, { value: string; canIncrease: boolean; canDecrease: boolean }>;
  playerBaseRatio: number;
  enemyBaseRatio: number;
  rosterLines: string[];
  captureTitle: string;
  captureLines: string[];
}

export interface LaneBattleHudInput {
  player: TeamState;
  enemy: TeamState;
  playerUnitCount: number;
  enemyUnitCount: number;
  playerBaseMaxHp: number;
  enemyBaseMaxHp: number;
  opponentCount: 1 | 2 | 3;
  selectedCapturePoint?: LaneHudCapturePoint;
}

const WORKER_ROLES: WorkerRole[] = ["gold", "wood", "food", "metal", "research", "idle"];

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getResourceIconKey(resourceId: ResourceId): string {
  return `icon-${resourceId}`;
}

export function getWorkerIconKey(role: WorkerRole): string {
  if (role === "research") return "icon-research";
  if (role === "idle") return "icon-idle";
  return "icon-worker";
}

export function getWorkerRoleLabel(role: WorkerRole): string {
  return {
    gold: "금",
    wood: "목재",
    food: "식량",
    metal: "금속",
    research: "연구",
    idle: "대기",
  }[role];
}

export function createLaneBattleHudSnapshot(input: LaneBattleHudInput): LaneBattleHudSnapshot {
  const roster = getWaveRoster(input.player.ageId);
  const rosterSummary = roster.battleline
    .map((entry) => `${UNIT_STATS[entry.unitId].label}${entry.count}`)
    .join(" · ");
  const resources = Object.fromEntries(MVP_ACTIVE_RESOURCE_IDS.map((resourceId) => {
    const value = input.player.resources[resourceId];
    return [resourceId, String(resourceId === "food" ? Math.floor(value) : Math.round(value))];
  })) as Record<ResourceId, string>;
  const workers = Object.fromEntries(WORKER_ROLES.map((role) => [role, {
    value: String(input.player.workers[role]),
    canIncrease: role !== "idle" && input.player.workers.idle > 0,
    canDecrease: role !== "idle" && input.player.workers[role] > 0,
  }])) as LaneBattleHudSnapshot["workers"];
  const selected = input.selectedCapturePoint;

  return {
    ageText: `시대 ${getAge(input.player.ageId).label}`,
    waveText: `다음 웨이브 ${Math.max(0, Math.ceil(input.player.nextWaveInSec))}초 | 적 ${Math.max(0, Math.ceil(input.enemy.nextWaveInSec))}초`,
    baseText: `전장 병력 ${input.playerUnitCount} | 적 병력 ${input.enemyUnitCount}`,
    tokensText: `즉시 웨이브 토큰 ${input.player.instantWaveTokens}`,
    resources,
    workers,
    playerBaseRatio: clampRatio(input.player.baseHp / input.playerBaseMaxHp),
    enemyBaseRatio: clampRatio(input.enemy.baseHp / input.enemyBaseMaxHp),
    rosterLines: [
      `다음 웨이브: ${rosterSummary}`,
      `보급대 ${roster.support[0]?.count ?? 0}기 포함`,
      `웨이브 식량 ${Math.round(getAgeBalance(input.player.ageId).baseWaveFoodCost * getOpponentScale(input.opponentCount).foodCostMultiplier)}`,
    ],
    captureTitle: selected
      ? selected.definition.pointType === "fixed-fortress"
        ? `고정 요새 · 거점 ${selected.id + 1}`
        : `건설 거점 ${selected.id + 1}`
      : "거점 선택",
    captureLines: selected
      ? [
          `소유 ${selected.owner === "player" ? "아군" : selected.owner === "enemy" ? "적" : "중립"} | 점령 ${Math.round(Math.abs(selected.control) * 100)}%`,
          `타워 ${selected.towerBuilt ? `가동 중 HP ${Math.round(selected.towerHp)}/${Math.round(selected.towerMaxHp)}` : selected.towerBuildRemainingSec > 0 ? `재건 ${Math.ceil(selected.towerBuildRemainingSec)}초` : "파괴됨"}`,
          selected.definition.pointType === "fixed-fortress"
            ? "고정 요새 전용 | 교체·폐기 불가"
            : `건설 ${selected.buildingId ? `${getBuildingDefinition(selected.buildingId).label} Lv.${selected.buildingLevel}` : "없음"} | 폐기 ${DISMANTLE_COST_GOLD}G`,
        ]
      : ["거점을 터치해 선택", "점령 후 건설 가능"],
  };
}
