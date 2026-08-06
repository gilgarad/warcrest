import type { AttackTargetKind } from "../presentation/units/combatPresentation";
import type { UnitFacingDirection } from "../presentation/units/unitAnimationRegistry";
import type { CapturePointAction } from "../data/capturePointDefinitions";
import type { TeamId } from "../systems/lane-economy/laneEconomy";

export interface LaneBattleDebugUnitSnapshot {
  id: number;
  team: TeamId;
  unitId: string;
  role: "battle" | "support";
  laneId: string;
  progress: number;
  laneRow: number;
  hp: number;
  maxHp: number;
  facingX: -1 | 1;
  facingDirection: UnitFacingDirection;
  travelFacingX: -1 | 1;
  travelFacingDirection: UnitFacingDirection;
  combatFacingX: -1 | 1;
  combatFacingDirection: UnitFacingDirection;
  flipX: boolean;
  tint: number;
  motion: { x: number; y: number };
  pose: string;
  renderTexture: string;
  attackAnimTime: number;
  attackFacingLockSec: number;
  combatFacingHoldSec: number;
  attackTargetKind: AttackTargetKind;
  manaCurrent: number;
  manaMax: number;
  manaRegenPerSec: number;
  healManaCost: number;
  healPower: number;
  presentation: {
    x: number;
    y: number;
    rotationRad: number;
    spriteDisplayWidth: number;
    spriteDisplayHeight: number;
  };
  overlay: {
    mode: string;
    hpVisible: boolean;
    manaVisible: boolean;
    labelVisible: boolean;
    labelText: string;
  };
  attackTiming: {
    durationSec: number;
    eventDelayMs: number;
    eventProgress: number;
    targetKind: AttackTargetKind;
  };
}

export interface LaneBattleDebugSnapshot {
  phase: string;
  elapsedSec: number;
  player: {
    ageId: string;
    selectedProductionAgeId: string;
    resources: Record<string, number>;
    workers: Record<string, number>;
    baseHp: number;
    nextWaveInSec: number;
  };
  enemy: {
    ageId: string;
    selectedProductionAgeId: string;
    resources: Record<string, number>;
    workers: Record<string, number>;
    baseHp: number;
    nextWaveInSec: number;
  };
  units: LaneBattleDebugUnitSnapshot[];
  battlefield: {
    capturePoints: unknown;
    controlPoints: Array<{
      id: number;
      laneId: string;
      pointType: string;
      allowedBuildingTypes: readonly string[];
      owner: "player" | "enemy" | "neutral";
      control: number;
      progress: number;
      worldX: number;
      worldY: number;
      labelWorldX: number;
      labelWorldY: number;
      markerTexture: string;
      buildingId: string | null;
      buildingLevel: number;
      availableActions: CapturePointAction[];
    }>;
    defenseTowers: Array<{
      id: number;
      laneId: string;
      owner: TeamId | "neutral";
      linkedCapturePointId: number;
      progress: number;
      built: boolean;
      hp: number;
      maxHp: number;
      buildRemainingSec: number;
    }>;
    laneStart: { x: number; y: number };
    laneEnd: { x: number; y: number };
    lanes: Array<{
      id: string;
      role: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
    }>;
  };
  ui: {
    ageLabel: string;
    playerSelectedProductionAgeId: string;
    selectedMainBaseTeam: TeamId | null;
    selectedCapturePointId: number | null;
    selectedDefenseTowerId: number | null;
    visibleCaptureActions: string[];
    hudVisible: boolean;
    composition: Record<string, unknown>;
    unitOverlayDensityEnabled: boolean;
    unitOverlayModes: Record<string, string>;
  };
  activeProjectiles: Array<{
    textureKey: string;
    x: number;
    y: number;
  }>;
  engagement: {
    uniqueAttackers: number;
    battleUnits: number;
    currentlyAnimating: number;
  };
  towerAttackPatterns: Record<string, {
    projectileCount: number;
    perProjectileDamage: number;
    cooldownSec: number;
  }>;
  verification: {
    seed: string;
    terrainMode: string;
    prototypePreset: string;
    scalePreset: string;
    visualValidationScenario: boolean;
    camera: {
      scrollX: number;
      scrollY: number;
      zoom: number;
      centerX: number;
      centerY: number;
    };
    rules: Record<string, number>;
    terrain: Record<string, unknown>;
    presentation: Record<string, unknown>;
    unitStats: Record<string, {
      hp: number;
      attack: number;
      defense: number;
      range: number;
      speed: number;
      attackCooldownSec: number;
      healPower: number;
    }>;
  };
}
