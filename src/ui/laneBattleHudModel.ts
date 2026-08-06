import { getAge, getAgeIndex, isFinalAge } from "../data/ages";
import { getAgeBalance, getOpponentScale, getResearchWorkerDirectCost, MVP_ACTIVE_RESOURCE_IDS } from "../data/balance";
import type { CapturePointDefinition } from "../data/capturePointDefinitions";
import type { DefenseTowerDefinition } from "../data/defenseTowerDefinitions";
import type { ResourceId } from "../data/resources";
import { getWaveRoster } from "../data/unitRosters";
import { DISMANTLE_COST_GOLD, getBuildingCost, getBuildingDefinition, type BuildingId } from "../systems/lane-capture/captureRules";
import { getDefenseTowerBuildCost } from "../systems/lane-capture/defenseTowerRules";
import { getAgeUpCost, type TeamState, type WorkerRole } from "../systems/lane-economy/laneEconomy";
import { UNIT_STATS } from "../systems/lane-units/unitStats";

function formatCostInline(cost: Partial<Record<ResourceId, number>>): string {
  const parts: string[] = [];
  if (cost.gold) parts.push(`${Math.round(cost.gold)}G`);
  if (cost.wood) parts.push(`${Math.round(cost.wood)}W`);
  if (cost.food) parts.push(`${Math.round(cost.food)}F`);
  if (cost.metal) parts.push(`${Math.round(cost.metal)}M`);
  if (cost.research) parts.push(`${Math.round(cost.research)}R`);
  return parts.join(" ");
}

export interface LaneHudCapturePoint {
  id: number;
  definition: CapturePointDefinition;
  owner: "player" | "enemy" | "neutral";
  control: number;
  buildingId?: BuildingId;
  buildingLevel: number;
}

export interface LaneHudDefenseTower {
  id: number;
  definition: DefenseTowerDefinition;
  owner: "player" | "enemy" | "neutral";
  built: boolean;
  buildRemainingSec: number;
  hp: number;
  maxHp: number;
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
  selectedDefenseTower?: LaneHudDefenseTower;
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
  const productionAge = getAge(input.player.selectedProductionAgeId);
  const roster = getWaveRoster(input.player.selectedProductionAgeId);
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
  const selectedTower = input.selectedDefenseTower;

  return {
    ageText: input.player.selectedProductionAgeId === input.player.ageId
      ? `시대 ${getAge(input.player.ageId).label}`
      : `시대 ${getAge(input.player.ageId).label} | 생산 ${productionAge.label}`,
    waveText: `다음 웨이브 ${Math.max(0, Math.ceil(input.player.nextWaveInSec))}초 | 적 ${Math.max(0, Math.ceil(input.enemy.nextWaveInSec))}초`,
    baseText: `전장 병력 ${input.playerUnitCount} | 적 병력 ${input.enemyUnitCount}`,
    tokensText: `즉시 웨이브 토큰 ${input.player.instantWaveTokens}`,
    resources,
    workers,
    playerBaseRatio: clampRatio(input.player.baseHp / input.playerBaseMaxHp),
    enemyBaseRatio: clampRatio(input.enemy.baseHp / input.enemyBaseMaxHp),
    rosterLines: [
      `생산 시대: ${productionAge.label}`,
      `다음 웨이브: ${rosterSummary}`,
      `보급대 ${roster.support[0]?.count ?? 0}기 포함`,
      `웨이브 식량 ${Math.round(getAgeBalance(input.player.selectedProductionAgeId).baseWaveFoodCost * getOpponentScale(input.opponentCount).foodCostMultiplier)} | 연구 ${formatCostInline(getResearchWorkerDirectCost(input.player.ageId))} | 시대 업 ${AGESummary(input.player.ageId)}`,
    ],
    captureTitle: selectedTower
      ? `방어 타워 ${selectedTower.id + 1}`
      : selected ? `건설 거점 ${selected.id + 1}` : "거점 또는 타워 선택",
    captureLines: selectedTower
      ? [
          `소유 ${selectedTower.owner === "player" ? "아군" : selectedTower.owner === "enemy" ? "적" : "중립"}`,
          selectedTower.built
            ? `가동 중 HP ${Math.round(selectedTower.hp)}/${Math.round(selectedTower.maxHp)}`
            : selectedTower.buildRemainingSec > 0
              ? `재건 중 ${Math.ceil(selectedTower.buildRemainingSec)}초`
              : "폐허 거점",
          `재건 비용 ${formatCostInline(getDefenseTowerBuildCost(input.player.ageId))}`,
        ]
      : selected
      ? [
          `소유 ${selected.owner === "player" ? "아군" : selected.owner === "enemy" ? "적" : "중립"} | 점령 ${Math.round(Math.abs(selected.control) * 100)}%`,
          `건설 ${selected.buildingId ? `${getBuildingDefinition(selected.buildingId).label} Lv.${selected.buildingLevel}` : "없음"} | 폐기 ${DISMANTLE_COST_GOLD}G`,
          selected.owner === "player" && !selected.buildingId
            ? `타워 ${formatCostInline(getBuildingCost("defense_tower", input.player.ageId))} · 병참 ${formatCostInline(getBuildingCost("supply_depot", input.player.ageId))} · 조달소 ${formatCostInline(getBuildingCost("mint", input.player.ageId))}`
            : "파괴 후 중립화되며 점령 뒤 재건 가능",
        ]
      : ["거점이나 타워를 터치해 선택", "두 구조물은 서로 다른 위치와 규칙을 사용"],
  };
}

function AGESummary(ageId: TeamState["ageId"]): string {
  if (isFinalAge(ageId)) return "최종";
  return formatCostInline(getAgeUpCost(getAgeIndex(ageId)));
}
