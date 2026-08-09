import { BUILDING_DEFINITIONS, getBuildingCost } from "../lane-capture/captureRules";
import { DEFENSE_TOWER_BUILD_DURATION_SEC, getDefenseTowerBuildCost } from "../lane-capture/defenseTowerRules";
import { BASE_WORKER_COST, getResearchWorkerDirectCost, AI_INSTANT_WAVE_MIN_REMAINING_SEC } from "../../data/balance";
import { canAfford, payCost, shouldAdvanceAiAge, type TeamState } from "../lane-economy/laneEconomy";
import { shouldAiUseInstantWave, tickWaveClock } from "../lane-economy/laneWaveRules";
import {
  createAiEconomyState,
  pickNeediestResourceRole,
  planAiWorkerRebalance,
  shouldAiHireResearchWorker,
  shouldAiHireWorker,
  type AiEconomyState,
} from "../lane-economy/aiEconomy";
import type { CapturePointState, DefenseTowerState } from "../../scenes/LaneBattleScene";

/**
 * Everything "what does the enemy team decide to do" in one place, instead
 * of scattered across the capture-point/tower code it happens to also read.
 * Constructed once by the scene with closures back into scene state — see
 * `docs/dev-wiki/ux-and-architecture-review.md` (2.2) for why this was
 * split out and `docs/dev-wiki/ai-economy-design.md` for the economy design
 * this composes.
 */
export interface AiControllerHost {
  getEnemyTeam(): TeamState;
  getElapsedSec(): number;
  getCapturePoints(): readonly CapturePointState[];
  getDefenseTowers(): readonly DefenseTowerState[];
  advanceAge(team: TeamState): void;
  tryUseInstantWaveToken(team: TeamState): void;
  initializeCaptureBuildingState(point: CapturePointState): void;
}

export class AiController {
  private readonly economyState: AiEconomyState = createAiEconomyState();

  constructor(private readonly host: AiControllerHost) {}

  reset(): void {
    Object.assign(this.economyState, createAiEconomyState());
  }

  tick(deltaSec: number): void {
    const enemy = this.host.getEnemyTeam();
    tickWaveClock(enemy, deltaSec);
    this.tickEconomy();
    if (this.shouldAgeUp()) this.host.advanceAge(enemy);
    if (shouldAiUseInstantWave(enemy, AI_INSTANT_WAVE_MIN_REMAINING_SEC)) {
      this.host.tryUseInstantWaveToken(enemy);
    }
  }

  /** Runs every frame from `tick()`; also called directly by `LaneBattleScene`'s always-on capture/tower auto-build checks so they share the same enemy team reference. */
  tickEconomy(): void {
    const enemy = this.host.getEnemyTeam();
    const elapsedSec = this.host.getElapsedSec();
    if (shouldAiHireWorker(enemy, elapsedSec, this.economyState)) {
      payCost(enemy.resources, BASE_WORKER_COST);
      enemy.workers.idle += 1;
      this.economyState.lastHireAttemptSec = elapsedSec;
    }
    if (enemy.workers.idle > 0) {
      const target = pickNeediestResourceRole(enemy);
      enemy.workers.idle -= 1;
      enemy.workers[target] += 1;
    }
    if (shouldAiHireResearchWorker(enemy)) {
      payCost(enemy.resources, getResearchWorkerDirectCost(enemy.ageId));
      enemy.workers.research += 1;
    }
    const rebalance = planAiWorkerRebalance(enemy, elapsedSec, this.economyState);
    if (rebalance) {
      enemy.workers[rebalance.from] -= 1;
      enemy.workers[rebalance.to] += 1;
      this.economyState.lastRebalanceSec = elapsedSec;
    }
  }

  shouldAgeUp(): boolean {
    // If the AI can afford a building it doesn't have yet at one of its own
    // capture points, let that cheap (10-18 resource) build claim the spend
    // this tick instead of always defaulting to the age-up lump sum — this
    // is the explicit "upgrade my own point, or age up" decision point.
    if (this.hasAffordableUnbuiltCapturePoint()) return false;
    return shouldAdvanceAiAge(this.host.getEnemyTeam(), this.host.getElapsedSec());
  }

  hasAffordableUnbuiltCapturePoint(): boolean {
    const enemy = this.host.getEnemyTeam();
    return this.host.getCapturePoints().some((point) =>
      point.owner === "enemy"
      && point.definition.pointType === "buildable"
      && !point.buildingId
      && BUILDING_DEFINITIONS.some((building) =>
        point.definition.allowedBuildingTypes.includes(building.id)
        && canAfford(enemy.resources, getBuildingCost(building.id, enemy.ageId)),
      ),
    );
  }

  autoBuildCapturePoint(): void {
    const enemy = this.host.getEnemyTeam();
    const target = this.host.getCapturePoints().find((point) =>
      point.owner === "enemy"
      && point.definition.pointType === "buildable"
      && !point.buildingId,
    );
    if (!target) return;
    const choices = BUILDING_DEFINITIONS.filter((entry) =>
      target.definition.allowedBuildingTypes.includes(entry.id),
    );
    if (choices.length === 0) return;
    const choice = choices[target.id % choices.length];
    const cost = getBuildingCost(choice.id, enemy.ageId);
    if (!canAfford(enemy.resources, cost)) return;
    payCost(enemy.resources, cost);
    target.buildingId = choice.id;
    target.buildingLevel = 1;
    this.host.initializeCaptureBuildingState(target);
  }

  autoRebuildDefenseTower(): void {
    const enemy = this.host.getEnemyTeam();
    const tower = this.host.getDefenseTowers().find((entry) =>
      entry.owner === "enemy" && !entry.built && entry.buildRemainingSec <= 0,
    );
    if (!tower) return;
    const cost = getDefenseTowerBuildCost(enemy.ageId);
    if (!canAfford(enemy.resources, cost)) return;
    payCost(enemy.resources, cost);
    tower.buildRemainingSec = DEFENSE_TOWER_BUILD_DURATION_SEC;
  }
}
