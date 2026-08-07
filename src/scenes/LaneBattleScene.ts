import Phaser from "phaser";
import { AGES, getAge, type AgeId, type AgeProductionGroup } from "../data/ages";
import {
  BASE_WORKER_COST,
  AI_INSTANT_WAVE_MIN_REMAINING_SEC,
  getAgeBalance,
  getResearchWorkerDirectCost,
  WAVE_INTERVAL_SEC,
} from "../data/balance";
import {
  getSupportResourceProfile,
  getWaveRoster,
  type BattleUnitId,
  type SupportUnitId,
} from "../data/unitRosters";
import {
  CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC,
  getBattlefieldMapSpec,
  getPrimaryLaneSpec,
  getCapturePointSocketId,
  getDefenseTowerSocketId,
  getStructureSocket,
} from "../data/battlefieldMaps";
import {
  getPrototypeScaleConfig,
  getPrototypeVisualConfig,
  isTerrainDebugInputEnabled,
  parseScalePreset,
  parsePrototypePreset,
  parseTerrainRenderMode,
  type PrototypeScaleConfig,
  type PrototypePresetId,
  type PrototypeVisualConfig,
  type ScalePresetId,
  type TerrainRenderMode,
} from "../config/prototypeVisualConfig";
import {
  getCapturePointDefinitions,
  getCapturePointActions,
  type CapturePointAction,
  type CapturePointDefinition,
} from "../data/capturePointDefinitions";
import {
  getDefenseTowerDefinitions,
  type DefenseTowerAction,
  type DefenseTowerDefinition,
} from "../data/defenseTowerDefinitions";
import {
  BattlefieldPrototypeRenderer,
  type StructureGroundPresentation,
} from "../gfx/battlefieldPrototypeRenderer";
import { BattlefieldWorldRenderer } from "../gfx/battlefieldWorldRenderer";
import {
  CAPTURE_MARKER_VISIBLE_HEIGHT_RATIO,
  MAIN_BASE_VISIBLE_HEIGHT_RATIO,
  STRUCTURE_GROUND_ORIGIN,
  getCaptureMarkerTexture,
  getDefenseTowerTexture,
  getDefenseTowerVisibleHeightRatio,
  getMainBaseTexture,
  type DefenseTowerVisualState,
} from "../presentation/structures/productionStructureRegistry";
import { generateBattlefield, type BattlefieldResult } from "../systems/battlefieldGenerator";
import { getAudioSystem } from "../systems/audio";
import { LaneBattleAudioWiring } from "../systems/audio/laneBattleAudioWiring";
import { LaneBattleHudView } from "../ui/LaneBattleHudView";
import { createLaneBattleHudSnapshot } from "../ui/laneBattleHudModel";
import { BaseResearchPanel } from "../ui/BaseResearchPanel";
import { createBaseResearchPanelSnapshot, getBrowsableAgeIds } from "../ui/baseResearchPanelModel";
import { areLaneBattleAssetsReady, queueLaneBattleAssets } from "./laneBattleAssetPreload";
import {
  deriveAnimationPrefix,
  resolveAnimationTextureFromPrefix,
  getUnitAnimationDefinition,
  getUnitDirectionalPoses,
  isMechanizedUnit,
  resolveUnitAnimationTexture,
  resolveUnitFacingDirection,
  resolveTeamUnitTextureKey,
  shouldFlipUnitFrame,
  type UnitFacingDirection,
} from "../presentation/units/unitAnimationRegistry";
import {
  resolveUnitFramePresentation,
} from "../presentation/units/unitPresentation";
import {
  resolveUnitOverlayDensity,
  type UnitOverlayMode,
} from "../presentation/units/unitOverlayDensity";
import {
  resolveWalkMotion,
} from "../presentation/units/combatPresentation";
import {
  UNIT_STATS,
  getProjectileKeyForUnit,
} from "../systems/lane-units/unitStats";
import { RANGE_TO_PROGRESS } from "../systems/lane-units/rangeRules";
import { createTowerAttackPattern } from "../systems/lane-combat/towerAttack";
import {
  getAttackTimingProfile,
  type AttackTimingProfile,
  type AttackTimingRole,
} from "../systems/lane-combat/attackTiming";
import {
  launchLaneProjectile,
  setLaneProjectileProgress,
} from "../systems/lane-combat/projectileLauncher";
import {
  resolveAttackMotion,
  type AttackTargetKind,
} from "../presentation/units/combatPresentation";
import {
  COMBAT_PROGRESS_CLEARANCE,
  COMBAT_PROGRESS_OFFSETS,
  COMBAT_ROW_CLEARANCE,
  COMBAT_ROW_REACH,
  COMBAT_ROW_STEP,
  LANE_ROW_MAX,
  LANE_ROW_MIN,
  LANE_SHIFT_STEP,
  createLaneRowCandidates,
} from "../systems/lane-combat/laneOccupancy";
import {
  advanceTeamAge,
  canAfford,
  createTeamState,
  getAgeUpCost,
  makeResourceMap,
  payCost,
  shouldAdvanceAiAge,
  tickLaneEconomy,
  type TeamId,
  type TeamState,
  type WorkerRole,
} from "../systems/lane-economy/laneEconomy";
import {
  adjustDraftResearchLevel,
  applyResearchDraft,
  getDraftResearchApplyCost,
  type ResearchStatKey,
} from "../systems/lane-economy/researchRules";
import {
  createTeamResearchState,
  discardResearchDraftForAge,
  getAppliedResearchLevels,
  type TeamResearchState,
} from "../systems/lane-economy/researchState";
import { TOWER_RESEARCH_SUBJECT_ID, type ResearchSubjectId } from "../systems/lane-economy/researchSubjects";
import {
  commitForcedWaveDeployment,
  commitWaveDeployment,
  createWaveDeploymentPlan,
  getInstantWaveEligibility,
  resetWaveClock,
  shouldAiUseInstantWave,
  tickWaveClock,
} from "../systems/lane-economy/laneWaveRules";
import {
  BUILDING_DEFINITIONS,
  DISMANTLE_COST_GOLD,
  getBuildingDefinition,
  getBuildingCost,
  resolveCapturedBuilding,
  type BuildingDefinition,
  type BuildingId,
} from "../systems/lane-capture/captureRules";
import {
  DEFENSE_TOWER_BUILD_DURATION_SEC,
  getDefenseTowerBuildCost,
  getDefenseTowerDefense,
  getDefenseTowerMaxHp,
  shouldGrantTowerResearchCarryover,
} from "../systems/lane-capture/defenseTowerRules";
import type { LaneBattleDebugSnapshot } from "./laneBattleDebugSnapshot";
import { resolveSpawnUnitStats } from "../systems/lane-units/unitStatResolver";

const CANVAS_W = 1600;
const CANVAS_H = 900;
const WORLD_W = 7000;
const WORLD_H = 3900;
const DEPTH_BG = 0;
const DEPTH_FIELD = 100;
const DEPTH_UNIT = 180;
const DEPTH_UI = 1000;
const PLAYER_OPPONENT_COUNT: 1 = 1;
const PLAYER_BASE_HP = 400;
const ENEMY_BASE_HP = 400;
const LANE_ROW_SPACING = 62;
// Baseline lane progress per second before per-unit speed multipliers are applied.
const UNIT_PROGRESS_SPEED = 0.02;
const FRIENDLY_GAP = 0.011;
const ENGAGE_GAP = 0.022;
const FIELD_CAMERA_ZOOM = 0.46;
const TOWER_W = 148;
const TOWER_H = 176;
const CENTRAL_CAPTURE_PROGRESS = 0.588;
const DEFAULT_VERIFICATION_SEED = "warcrest-central-v1";
const QUERY_PARAMS = new URLSearchParams(window.location.search);
const FACING_DEAD_ZONE_WORLD_PX = 1.5;
const HORIZONTAL_FACING_FLIP_DEAD_ZONE_WORLD_PX = 22;
const COMBAT_FACING_HOLD_SEC = 0.2;
const SUPPORT_ACQUISITION_RANGE_PROGRESS = 0.13;
const SUPPORT_ARRIVAL_EPSILON_PROGRESS = 0.003;


interface LaneUnit {
  id: number;
  team: TeamId;
  role: "battle" | "support";
  unitId: BattleUnitId | SupportUnitId;
  laneId: string;
  progress: number;
  laneRow: number;
  visualProgress: number;
  visualLaneRow: number;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  range: number;
  speed: number;
  attackCooldownSec: number;
  attackTimerSec: number;
  attackAnimTime: number;
  attackFacingLockSec: number;
  combatFacingHoldSec: number;
  attackTargetKind: AttackTargetKind;
  attackSequence: number;
  healPower: number;
  manaCurrent: number;
  manaMax: number;
  manaRegenPerSec: number;
  healManaCost: number;
  attrition: number;
  displaySize: number;
  bobPhase: number;
  animationPrefix: string;
  currentTextureKey: string;
  presentationOverrideTexture?: string;
  travelFacingX: -1 | 1;
  travelFacingDirection: UnitFacingDirection;
  combatFacingX: -1 | 1;
  combatFacingDirection: UnitFacingDirection;
  lastPresentationX: number;
  lastPresentationY: number;
  motionX: number;
  motionY: number;
  walkCyclePhase: number;
  visualOffsetX: number;
  visualLift: number;
  visualRotationRad: number;
  visualSpriteWidth: number;
  visualSpriteHeight: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  selectionRing: Phaser.GameObjects.Ellipse;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  manaBg: Phaser.GameObjects.Rectangle;
  manaFill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  hovered: boolean;
  selected: boolean;
}

interface CombatSlot {
  progress: number;
  laneRow: number;
}


interface LaneObstacle {
  textureKey: string;
  progress: number;
  laneRow: number;
  radiusProgress: number;
  radiusRows: number;
  width: number;
  height: number;
  alpha?: number;
}

interface LanePathNode {
  progress: number;
  position: Phaser.Math.Vector2;
}

interface CapturePointState {
  id: number;
  definition: CapturePointDefinition;
  laneId: string;
  progress: number;
  owner: TeamId | "neutral";
  control: number;
  buildingId?: BuildingId;
  buildingLevel: number;
  attackTimerSec: number;
  incomeTimerSec: number;
  supplyTimerSec: number;
  manaCurrent: number;
  manaMax: number;
  manaRegenPerSec: number;
  ring: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Arc;
  marker: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  ownerText: Phaser.GameObjects.Text;
  buildingText: Phaser.GameObjects.Text;
}

interface DefenseTowerState {
  id: number;
  definition: DefenseTowerDefinition;
  laneId: string;
  progress: number;
  owner: TeamId | "neutral";
  control: number;
  attackTimerSec: number;
  buildRemainingSec: number;
  built: boolean;
  maxHp: number;
  hp: number;
  defense: number;
  sprite: Phaser.GameObjects.Image;
  selectionHitZone: Phaser.GameObjects.Zone;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  groundPresentation?: StructureGroundPresentation;
  groundPresentationV2?: StructureGroundPresentation;
  groundPresentationWorld?: StructureGroundPresentation;
  label: Phaser.GameObjects.Text;
  ownerText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
}

let nextUnitId = 1;

const CAPTURE_RADIUS_PROGRESS = 0.06;
const CAPTURE_RATE_PER_SEC = 0.36;
const TOWER_CAPTURE_RADIUS_PROGRESS = 0.065;
const TOWER_CAPTURE_RATE_PER_SEC = 0.34;
const SUPPLY_DEPOT_ATTACK_BUFF_MULTIPLIER = 1.2;
const SUPPLY_DEPOT_SUPPORT_MANA_RESTORE = 6;
const STRUCTURE_SOCKET_ATTACH_Y = 12;

function resolveGameplayMusicTheme(group: AgeProductionGroup): "stone" | "bronze" | "medieval" | "renaissance" | "industrial" | "modern" {
  switch (group) {
    case "ancient":
      return "stone";
    case "classical":
      return "bronze";
    case "iron":
      return "medieval";
    case "renaissance":
      return "renaissance";
    case "industrial":
      return "industrial";
    case "modern":
      return "modern";
  }
}

function progressBetween(a: number, b: number): number {
  return Math.abs(a - b);
}

export class LaneBattleScene extends Phaser.Scene {
  private battlefield!: BattlefieldResult;
  private units: LaneUnit[] = [];
  private capturePoints: CapturePointState[] = [];
  private defenseTowers: DefenseTowerState[] = [];
  private selectedMainBaseTeam: TeamId | null = null;
  private selectedCapturePointId: number | null = null;
  private selectedDefenseTowerId: number | null = null;
  private player!: TeamState;
  private enemy!: TeamState;
  private playerResearchState: TeamResearchState = createTeamResearchState();
  private enemyResearchState: TeamResearchState = createTeamResearchState();
  private devModeEnabled = false;
  private elapsedSec = 0;
  private workerAccumulator = new Map<string, number>();
  private terrainPrototype!: BattlefieldPrototypeRenderer;
  private terrainPrototypeV2!: BattlefieldPrototypeRenderer;
  private terrainWorld!: BattlefieldWorldRenderer;
  private originalBackground!: Phaser.GameObjects.Image;
  private prototypeV2Background!: Phaser.GameObjects.Image;
  private readonly legacyObstacleObjects: Phaser.GameObjects.Image[] = [];
  private terrainMode: TerrainRenderMode = parseTerrainRenderMode(QUERY_PARAMS.get("terrain"));
  private terrainPrototypeEnabled = this.terrainMode !== "legacy";
  private readonly prototypePresetId: PrototypePresetId = parsePrototypePreset(QUERY_PARAMS.get("preset"));
  private readonly prototypeVisualConfig: PrototypeVisualConfig = getPrototypeVisualConfig(this.prototypePresetId);
  private readonly scalePresetId: ScalePresetId = parseScalePreset(QUERY_PARAMS.get("scale"));
  private readonly scaleVisualConfig: PrototypeScaleConfig = getPrototypeScaleConfig(this.scalePresetId);
  private readonly verificationSeed = QUERY_PARAMS.get("seed") ?? DEFAULT_VERIFICATION_SEED;
  private readonly visualValidationScenario = QUERY_PARAMS.get("scenario") === "visual-validation";
  private readonly terrainDebugInputEnabled = isTerrainDebugInputEnabled(QUERY_PARAMS.get("terrainDebug"));
  private readonly mapSpec = getBattlefieldMapSpec(QUERY_PARAMS.get("map"));
  private readonly primaryLaneSpec = getPrimaryLaneSpec(this.mapSpec);
  private readonly lanePaths = new Map(this.mapSpec.lanes.map((lane) => [lane.id, lane.path.map((node) => ({
    progress: node.progress,
    position: new Phaser.Math.Vector2(node.position.x, node.position.y),
  }))]));
  private readonly lanePath: LanePathNode[] = this.lanePaths.get(this.primaryLaneSpec.id) ?? [];
  private readonly laneStart = this.lanePath[0].position.clone();
  private readonly laneEnd = this.lanePath[this.lanePath.length - 1].position.clone();
  private isDraggingField = false;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private readonly worldObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly uiObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly activeProjectiles = new Set<Phaser.GameObjects.Image>();
  private readonly engagedUnitIds = new Set<number>();
  private unitOverlayDensityEnabled = true;
  private unitOverlayModes = new Map<number, UnitOverlayMode>();
  private readonly audio = getAudioSystem();
  private readonly audioWiring = new LaneBattleAudioWiring(this.audio);
  private hud!: LaneBattleHudView;
  private baseResearchPanel!: BaseResearchPanel;
  private audioSettingsOpen = false;
  private readonly laneObstacles: LaneObstacle[] = [
    { textureKey: "rock-cluster", progress: 0.20, laneRow: -10.2, radiusProgress: 0.03, radiusRows: 1.2, width: 176, height: 132 },
    { textureKey: "tree-cluster", progress: 0.32, laneRow: 10.4, radiusProgress: 0.035, radiusRows: 1.4, width: 144, height: 190 },
    { textureKey: "rock-cluster", progress: 0.51, laneRow: -10.1, radiusProgress: 0.03, radiusRows: 1.2, width: 166, height: 124 },
    { textureKey: "tree-cluster", progress: 0.69, laneRow: 10.3, radiusProgress: 0.035, radiusRows: 1.4, width: 138, height: 184 },
    { textureKey: "rock-cluster", progress: 0.87, laneRow: -10.2, radiusProgress: 0.028, radiusRows: 1.1, width: 154, height: 116 },
  ];


  constructor() {
    super("run");
  }

  preload(): void {
    if (!areLaneBattleAssetsReady(this, this.terrainMode)) {
      queueLaneBattleAssets(this, this.terrainMode);
    }
  }

  create(): void {
    Phaser.Math.RND.sow([this.verificationSeed]);
    void this.audio.initialize();
    this.audio.resetDirector("preparation");
    this.audioWiring.reset();
    this.battlefield = generateBattlefield();
    this.cameras.main.setBackgroundColor(0x081018);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setZoom(FIELD_CAMERA_ZOOM);
    const initialProgress = new URLSearchParams(window.location.search).get("camera") === "central"
      ? CENTRAL_CAPTURE_PROGRESS
      : 0.22;
    const initialFocus = this.progressToScreen(initialProgress, 0);
    this.cameras.main.centerOn(initialFocus.x, initialFocus.y);

    this.createUiIconTextures();

    this.player = createTeamState("player", makeResourceMap(20, 20, 20, 0), PLAYER_BASE_HP);
    this.enemy = createTeamState("enemy", makeResourceMap(20, 20, 20, 0), ENEMY_BASE_HP);
    this.syncGameplayMusicTheme();

    this.drawBattlefield();
    this.worldObjects.push(...this.children.list);
    this.createUi();
    this.uiObjects.push(...this.children.list.filter((obj) => !this.worldObjects.includes(obj)));
    this.uiCamera = this.cameras.add(0, 0, CANVAS_W, CANVAS_H);
    this.uiCamera.setZoom(1);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.ignore(this.worldObjects);
    this.cameras.main.ignore(this.uiObjects);
    this.selectCapturePoint(1);

    this.grantInstantWaveToken(this.player);
    this.grantInstantWaveToken(this.enemy);
    this.deployOpeningWave(this.player);
    this.deployOpeningWave(this.enemy);
    if (this.visualValidationScenario) this.setupVisualValidationScenario();
    this.setupFieldDrag();
    this.setupTerrainPrototypeControls();
    this.refreshUi();
    this.publishDebug();
  }

  update(_time: number, deltaMs: number): void {
    if (this.audioSettingsOpen) {
      this.publishDebug();
      this.updateAudioDebugOverlay();
      return;
    }
    const deltaSec = deltaMs / 1000;
    this.elapsedSec += deltaSec;
    this.tickEconomy(deltaSec);
    this.tickAi(deltaSec);
    this.tickWaves(deltaSec);
    this.tickCombat(deltaSec);
    this.refreshUnitOverlayDensity();
    this.tickCapturePoints(deltaSec);
    this.syncGameplayMusicTheme();
    this.updateAudioState();
    this.refreshUi();
    this.publishDebug();
    this.updateAudioDebugOverlay();
  }

  private createUiIconTextures(): void {
    if (this.textures.exists("icon-gold")) return;
    const defs: Array<{ key: string; draw: (g: Phaser.GameObjects.Graphics) => void }> = [
      {
        key: "icon-gold",
        draw: (g) => {
          g.fillStyle(0xe8c14e, 1).fillCircle(16, 16, 10);
          g.lineStyle(2, 0xffefab, 1).strokeCircle(16, 16, 10);
        },
      },
      {
        key: "icon-wood",
        draw: (g) => {
          g.fillStyle(0x8c5e34, 1).fillRoundedRect(6, 10, 20, 12, 4);
          g.lineStyle(2, 0xcaa07a, 1).strokeRoundedRect(6, 10, 20, 12, 4);
        },
      },
      {
        key: "icon-food",
        draw: (g) => {
          g.fillStyle(0xd9b15d, 1).fillEllipse(16, 18, 18, 12);
          g.lineStyle(2, 0xf4e2a0, 1).beginPath().moveTo(16, 6).lineTo(16, 14).strokePath();
        },
      },
      {
        key: "icon-metal",
        draw: (g) => {
          g.fillStyle(0xa9bfd2, 1).fillRoundedRect(7, 8, 18, 16, 3);
          g.lineStyle(2, 0xe6f3ff, 1).strokeRoundedRect(7, 8, 18, 16, 3);
        },
      },
      {
        key: "icon-worker",
        draw: (g) => {
          g.fillStyle(0x83b7ff, 1).fillCircle(16, 10, 5);
          g.fillRoundedRect(11, 16, 10, 12, 4);
        },
      },
      {
        key: "icon-research",
        draw: (g) => {
          g.fillStyle(0xcfdfff, 1).fillCircle(16, 9, 5);
          g.fillRoundedRect(10, 14, 12, 14, 5);
          g.lineStyle(2, 0x7ba1ff, 1).beginPath().moveTo(16, 14).lineTo(16, 28).strokePath();
        },
      },
      {
        key: "icon-idle",
        draw: (g) => {
          g.fillStyle(0xb6bfd2, 1).fillCircle(16, 10, 5);
          g.fillRoundedRect(11, 16, 10, 12, 4);
          g.lineStyle(2, 0xeff5ff, 1).strokeCircle(16, 16, 12);
        },
      },
    ];
    defs.forEach(({ key, draw }) => {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, 32, 32);
      g.destroy();
    });

    const towerDefs: Array<{ key: string; banner: number; body: number }> = [
      { key: "tower-player", banner: 0x4ea5ff, body: 0xaebed0 },
      { key: "tower-enemy", banner: 0xff6b6b, body: 0xc9a7a7 },
      { key: "tower-neutral", banner: 0xf3cc6a, body: 0xb6b6b6 },
      { key: "tower-ruin", banner: 0x6f6f6f, body: 0x7a7268 },
    ];
    towerDefs.forEach(({ key, banner, body }) => {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x223244, 1).fillRoundedRect(18, 60, 44, 20, 6);
      g.fillStyle(body, 1).fillRoundedRect(24, 18, 32, 50, 6);
      g.fillStyle(0x4b5b6d, 1).fillRect(36, 6, 8, 18);
      g.fillStyle(banner, 1).fillTriangle(44, 10, 66, 18, 44, 26);
      g.generateTexture(key, 80, 88);
      g.destroy();
    });

    const projectileDefs: Array<{ key: string; color: number; draw: (g: Phaser.GameObjects.Graphics) => void }> = [
      {
        key: "projectile-stone",
        color: 0x9e8c76,
        draw: (g) => {
          g.fillStyle(0x312a24, 0.8).fillCircle(11, 12, 9);
          g.fillStyle(0xb6a186, 1).fillCircle(10, 10, 7);
          g.fillStyle(0xe0cfb2, 0.9).fillCircle(7, 7, 2);
        },
      },
      {
        key: "projectile-arrow",
        color: 0xe6f1ff,
        draw: (g) => {
          g.fillStyle(0x8a6b45, 1).fillRect(2, 8, 14, 4);
          g.fillStyle(0xe6f1ff, 1).fillTriangle(16, 6, 22, 10, 16, 14);
        },
      },
      {
        key: "projectile-shot",
        color: 0xfff2b0,
        draw: (g) => g.fillStyle(0xfff2b0, 1).fillCircle(10, 10, 4),
      },
    ];
    projectileDefs.forEach(({ key, draw }) => {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, 24, 24);
      g.destroy();
    });
  }

  private setupFieldDrag(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isPointerOnUi(pointer)) return;
      this.isDraggingField = true;
    });
    this.input.on("pointerup", () => {
      this.isDraggingField = false;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.isDraggingField || !pointer.isDown) return;
      const visibleWorldW = CANVAS_W / this.cameras.main.zoom;
      const visibleWorldH = CANVAS_H / this.cameras.main.zoom;
      this.cameras.main.scrollX = Phaser.Math.Clamp(
        this.cameras.main.scrollX - (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom,
        0,
        Math.max(0, WORLD_W - visibleWorldW),
      );
      this.cameras.main.scrollY = Phaser.Math.Clamp(
        this.cameras.main.scrollY - (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom,
        0,
        Math.max(0, WORLD_H - visibleWorldH),
      );
    });
  }

  private setupTerrainPrototypeControls(): void {
    const keyboard = this.input.keyboard;
    if (keyboard && this.terrainDebugInputEnabled) {
      const cycleTerrainMode = () => {
        const modes: TerrainRenderMode[] = ["legacy", "prototype", "prototype-v2", "world-surface"];
        const currentIndex = modes.indexOf(this.terrainMode);
        this.setTerrainMode(modes[(currentIndex + 1) % modes.length], true);
      };
      keyboard.on("keydown-T", cycleTerrainMode);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off("keydown-T", cycleTerrainMode));
    }

    const prepareAgeWaveProbe = (ageId: AgeId) => {
      this.units.forEach((unit) => this.destroyUnitPresentation(unit));
      this.units = [];
      this.player.ageId = ageId;
      this.player.selectedProductionAgeId = ageId;
      this.spawnWaveUnits(this.player, getWaveRoster(ageId), 0.5);
      this.units.forEach((unit) => {
        unit.attackTimerSec = 10;
        this.syncUnitPresentation(unit);
      });
      const focus = this.progressToScreen(0.5, 0);
      this.cameras.main.centerOn(focus.x, focus.y);
      this.refreshUi();
      this.publishDebug();
    };

    const control = {
      setEnabled: (enabled: boolean) => this.setTerrainMode(enabled ? "prototype" : "legacy", false),
      toggle: () => this.setTerrainMode(this.terrainMode === "legacy" ? "prototype" : "legacy", false),
      setMode: (mode: TerrainRenderMode) => this.setTerrainMode(mode, false),
      focusCentral: () => this.focusCentralCapture(),
      focusProgress: (progress: number) => {
        const focus = this.progressToScreen(Phaser.Math.Clamp(progress, 0, 1), 0);
        this.cameras.main.centerOn(focus.x, focus.y);
      },
      focusLaneProgress: (laneId: string, progress: number) => {
        const focus = this.progressToScreen(Phaser.Math.Clamp(progress, 0, 1), 0, laneId);
        this.cameras.main.centerOn(focus.x, focus.y);
      },
      setPaused: (paused: boolean) => {
        if (paused) {
          this.scene.pause();
        } else {
          this.scene.resume();
        }
        this.publishDebug();
      },
      openAudioSettings: () => this.hud.openAudioSettings(),
      forceGameOver: (win: boolean) => this.scene.start("gameover", {
        win,
        squadSize: this.units.filter((unit) => unit.team === "player").length,
        summary: win ? "오디오 통합 승리 검증" : "오디오 통합 패배 검증",
      }),
      snapshot: () => this.createVerificationSnapshot(),
      fundDay8Regression: () => {
        Object.keys(this.player.resources).forEach((resourceId) => {
          this.player.resources[resourceId as keyof typeof this.player.resources] = 9999;
        });
        this.player.lastWaveElapsedSec = 10;
        this.refreshUi();
        this.publishDebug();
      },
      advanceStructureProbe: (seconds: number) => {
        this.tickCapturePoints(Math.max(0, seconds));
        this.refreshUi();
        this.publishDebug();
      },
      prepareCaptureOwnershipProbe: () => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.defenseTowers.forEach((tower) => {
          tower.built = false;
          tower.hp = 0;
          tower.buildRemainingSec = 0;
        });
        const point = this.capturePoints[0];
        point.owner = "enemy";
        point.control = -1;
        point.buildingId = "mint";
        point.buildingLevel = 4;
        this.spawnLaneUnit("player", "battle", "stone_axeman", point.progress, 0);
        this.selectCapturePoint(point.id);
        this.refreshCapturePointVisuals();
        this.publishDebug();
      },
      selectCapturePoint: (id: number) => this.selectCapturePoint(id),
      selectDefenseTower: (id: number) => this.selectDefenseTower(id),
      setCentralFortressHpRatio: (ratio: number) => {
        const tower = this.defenseTowers[1];
        if (!tower) return;
        tower.built = ratio > 0;
        tower.buildRemainingSec = 0;
        tower.hp = tower.maxHp * Phaser.Math.Clamp(ratio, 0, 1);
        this.selectDefenseTower(tower.id);
        this.refreshUi();
      },
      prepareTowerConstructionProbe: () => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.activeProjectiles.forEach((projectile) => projectile.destroy());
        this.activeProjectiles.clear();
        const tower = this.defenseTowers[0];
        tower.owner = "player";
        tower.built = false;
        tower.hp = 0;
        tower.buildRemainingSec = DEFENSE_TOWER_BUILD_DURATION_SEC;
        const focus = this.progressToScreen(tower.progress, 0, tower.laneId);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshDefenseTowerVisuals();
        this.publishDebug();
        this.scene.pause();
      },
      prepareTowerStateProbe: (state: DefenseTowerVisualState, owner: TeamId = "player") => {
        const tower = this.defenseTowers[0];
        tower.owner = owner;
        tower.buildRemainingSec = state === "construction" ? DEFENSE_TOWER_BUILD_DURATION_SEC : 0;
        tower.built = state !== "ruins" && state !== "construction";
        tower.hp = state === "full"
          ? tower.maxHp
          : state === "damaged"
            ? tower.maxHp * 0.5
            : state === "critical" ? tower.maxHp * 0.2 : 0;
        const focus = this.progressToScreen(tower.progress, 0, tower.laneId);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshDefenseTowerVisuals();
        this.publishDebug();
        this.scene.pause();
      },
      prepareCaptureMarkerProbe: (owner: CapturePointState["owner"]) => {
        const point = this.capturePoints[0];
        if (!point) return;
        point.owner = owner;
        point.control = owner === "player" ? 1 : owner === "enemy" ? -1 : 0;
        const focus = this.progressToScreen(point.progress, 0, point.laneId);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshCapturePointVisuals();
        this.publishDebug();
        this.scene.pause();
      },
      setPlayerBaseHpRatio: (ratio: number) => {
        this.player.baseHp = PLAYER_BASE_HP * Phaser.Math.Clamp(ratio, 0, 1);
        this.refreshUi();
        this.publishDebug();
      },
      prepareCapturePointInteraction: (id: number, _hpRatio = 1) => {
        const point = this.capturePoints.find((entry) => entry.id === id);
        if (!point) return;
        point.owner = "player";
        point.control = 1;
        point.buildingId = undefined;
        point.buildingLevel = 0;
        const focus = this.progressToScreen(point.progress, 0, point.laneId);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.selectCapturePoint(point.id);
        this.publishDebug();
      },
      setAttackVisualPhase: (
        unitId: BattleUnitId | SupportUnitId,
        team: TeamId,
        phase: number,
      ) => {
        const unit = this.units.find((entry) => entry.unitId === unitId && entry.team === team);
        if (!unit) return;
        const timing = this.getUnitAttackTiming(unit, unit.attackTargetKind);
        unit.attackAnimTime = timing.durationSec * (1 - Phaser.Math.Clamp(phase, 0, 1));
        unit.attackFacingLockSec = unit.attackAnimTime;
        this.syncUnitPresentation(unit);
        this.publishDebug();
      },
      prepareUnitPoseGallery: (unitId: BattleUnitId | SupportUnitId) => {
        const definition = getUnitAnimationDefinition(unitId);
        const poses = getUnitDirectionalPoses(unitId, definition?.fallbackDirection ?? "w");
        if (!definition || !poses) return;
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        const walkPreview = poses.walk.length >= 3
          ? [poses.walk[0], poses.walk[Math.floor(poses.walk.length / 2)], poses.walk[poses.walk.length - 1]]
          : poses.walk;
        const textures = [
          poses.idle,
          ...walkPreview,
          poses.attack[poses.attack.length - 1] ?? poses.idle,
        ];
        textures.forEach((texture, index) => {
          this.spawnLaneUnit(
            "player",
            unitId === "supply_wagon" ? "support" : "battle",
            unitId,
            0.445 + index * 0.022,
            (index - 2) * 1.6,
          );
          const unit = this.units[this.units.length - 1];
          if (!unit) return;
          unit.presentationOverrideTexture = texture;
          unit.attackTimerSec = 10;
          this.syncUnitPresentation(unit);
        });
        const focus = this.progressToScreen(0.505, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.publishDebug();
      },
      prepareTeamPaletteProbe: (unitId: BattleUnitId | SupportUnitId) => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        const role = unitId === "supply_wagon" ? "support" : "battle";
        this.spawnLaneUnit("player", role, unitId, 0.48, -1.8);
        this.spawnLaneUnit("enemy", role, unitId, 0.52, 1.8);
        this.units.forEach((unit) => {
          unit.attackTimerSec = 10;
          this.syncUnitPresentation(unit);
        });
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.publishDebug();
      },
      prepareAgeWaveProbe,
      prepareBronzeWaveProbe: () => prepareAgeWaveProbe("bronze"),
      prepareTowerVolleyProbe: () => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.activeProjectiles.forEach((projectile) => projectile.destroy());
        this.activeProjectiles.clear();
        const tower = this.defenseTowers[1];
        tower.owner = "player";
        tower.built = true;
        tower.hp = tower.maxHp;
        tower.attackTimerSec = 0;
        this.spawnLaneUnit("enemy", "battle", "stone_axeman", tower.progress + 0.065, 0, tower.laneId);
        this.tickWatchtower(tower, 0);
        this.activeProjectiles.forEach((projectile) => setLaneProjectileProgress(projectile, 0.45));
        const focus = this.progressToScreen(tower.progress, 0, tower.laneId);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.publishDebug();
        this.scene.pause();
      },
      prepareCaptureLayoutProbe: () => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.capturePoints.forEach((point, index) => {
          point.owner = index === 0 ? "player" : "enemy";
          point.control = index === 0 ? 1 : -1;
        });
        this.defenseTowers.forEach((tower, index) => {
          tower.owner = index === 0 ? "player" : "enemy";
          tower.built = true;
          tower.buildRemainingSec = 0;
          tower.hp = tower.maxHp;
        });
        const focus = this.progressToScreen(0.571, 0).add(new Phaser.Math.Vector2(0, -150));
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshCapturePointVisuals();
        this.refreshDefenseTowerVisuals();
        this.publishDebug();
      },
      prepareStructureAttackProbe: (unitId: "stone_axeman" | "stone_slinger") => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.activeProjectiles.forEach((projectile) => projectile.destroy());
        this.activeProjectiles.clear();
        this.engagedUnitIds.clear();
        const point = this.defenseTowers[1];
        point.owner = "enemy";
        point.built = true;
        point.buildRemainingSec = 0;
        point.hp = point.maxHp;
        const offset = unitId === "stone_axeman" ? 0.012 : 0.046;
        this.spawnLaneUnit("player", "battle", unitId, point.progress - offset, 0, point.laneId);
        const unit = this.units[0];
        unit.attackTimerSec = 0;
        const focus = this.progressToScreen(point.progress - 0.018, 0, point.laneId);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshCapturePointVisuals();
        this.publishDebug();
      },
      prepareUnitAttackProbe: (unitId: "stone_axeman" | "stone_slinger" | "bronze_spearman") => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.activeProjectiles.forEach((projectile) => projectile.destroy());
        this.activeProjectiles.clear();
        this.engagedUnitIds.clear();
        this.defenseTowers.forEach((tower) => {
          tower.built = false;
          tower.hp = 0;
          tower.buildRemainingSec = 0;
        });
        const gap = unitId === "stone_slinger" ? 0.034 : 0.012;
        this.spawnLaneUnit("player", "battle", unitId, 0.5 - gap / 2, 0);
        this.spawnLaneUnit("enemy", "battle", "stone_axeman", 0.5 + gap / 2, 0);
        const [attacker, target] = this.units;
        attacker.attackTimerSec = 0;
        target.attackTimerSec = 10;
        attacker.visualProgress = attacker.progress;
        target.visualProgress = target.progress;
        this.syncUnitPresentation(attacker);
        this.syncUnitPresentation(target);
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshDefenseTowerVisuals();
        this.publishDebug();
        this.scene.pause();
      },
      prepareOccupancyProbe: () => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.engagedUnitIds.clear();
        this.capturePoints.forEach((point) => { point.owner = "neutral"; point.control = 0; });
        this.defenseTowers.forEach((tower) => { tower.built = false; tower.hp = 0; });
        const rows = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
        for (let index = 0; index < 12; index += 1) {
          const row = rows[index % rows.length];
          this.spawnLaneUnit("player", "battle", "stone_axeman", 0.47 - Math.floor(index / rows.length) * 0.008, row);
          this.spawnLaneUnit("enemy", "battle", "stone_axeman", 0.53 + Math.floor(index / rows.length) * 0.008, -row);
        }
        this.units.forEach((unit) => {
          unit.attackTimerSec = 0;
        });
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshCapturePointVisuals();
        this.units.forEach((unit) => this.syncUnitPresentation(unit));
        this.refreshUnitOverlayDensity();
        this.publishDebug();
      },
      stepOccupancyProbe: (deltaSec: number, steps: number) => {
        const step = Phaser.Math.Clamp(deltaSec, 0, 0.1);
        const count = Phaser.Math.Clamp(Math.floor(steps), 0, 600);
        for (let index = 0; index < count; index += 1) {
          this.tickCombat(step);
        }
        this.units.forEach((unit) => this.syncUnitPresentation(unit));
        this.refreshUnitOverlayDensity();
        this.publishDebug();
      },
      setUnitOverlayDensityEnabled: (enabled: boolean) => {
        this.unitOverlayDensityEnabled = enabled;
        this.refreshUnitOverlayDensity();
        this.publishDebug();
      },
      setHudVisible: (visible: boolean) => {
        this.uiCamera.setVisible(visible);
        this.publishDebug();
      },
      setVisualAuditLayer: (layer: "ground" | "props" | "units" | "combat") => {
        this.uiCamera.setVisible(false);
        if (layer === "ground") {
          this.worldObjects.forEach((object) => {
            const renderable = object as Phaser.GameObjects.GameObject & {
              depth?: number;
              setVisible?: (visible: boolean) => unknown;
            };
            if ((renderable.depth ?? 0) > 8) renderable.setVisible?.(false);
          });
        }
        const showUnits = layer === "units" || layer === "combat";
        this.units.forEach((unit) => this.setUnitPresentationVisible(unit, showUnits));
        this.activeProjectiles.forEach((projectile) => projectile.setVisible(layer === "combat"));
        this.capturePoints.forEach((point) => {
          point.ring.setVisible(false);
          point.core.setVisible(false);
          point.label.setVisible(false);
          point.ownerText.setVisible(false);
          point.buildingText.setVisible(false);
        });
        this.defenseTowers.forEach((tower) => {
          tower.hpBg.setVisible(false);
          tower.hpFill.setVisible(false);
          tower.label.setVisible(false);
          tower.ownerText.setVisible(false);
          tower.statusText.setVisible(false);
        });
      },
      prepareVisualAuditCombat: () => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.activeProjectiles.forEach((projectile) => projectile.destroy());
        this.activeProjectiles.clear();
        this.engagedUnitIds.clear();
        this.capturePoints.forEach((point) => { point.owner = "neutral"; point.control = 0; });
        this.defenseTowers.forEach((tower) => { tower.built = false; tower.hp = 0; });
        this.spawnLaneUnit("player", "battle", "stone_axeman", 0.492, -0.5);
        this.spawnLaneUnit("enemy", "battle", "stone_axeman", 0.508, 0.5);
        this.units.forEach((unit) => {
          unit.attackTimerSec = 0;
          unit.visualProgress = unit.progress;
          unit.visualLaneRow = unit.laneRow;
          this.syncUnitPresentation(unit);
        });
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshCapturePointVisuals();
        this.publishDebug();
      },
      stepVisualAuditCombat: (deltaSec: number) => {
        this.tickCombat(Phaser.Math.Clamp(deltaSec, 0, 0.1));
        this.units.forEach((unit) => this.syncUnitPresentation(unit));
        this.publishDebug();
      },
      resetDirectionShowcase: () => this.resetValidationDirectionShowcase(),
      prepareDirectionProbe: (direction: -1 | 1) => {
        const unit = this.units.find((entry) => entry.unitId === "stone_axeman" && entry.team === "player");
        if (!unit) return;
        this.units.forEach((entry) => this.setUnitPresentationVisible(entry, entry === unit));
        unit.attackAnimTime = 0;
        unit.attackFacingLockSec = 0;
        unit.attackTimerSec = 10;
        unit.progress = 0.5 + direction * 0.045;
        unit.visualProgress = 0.5;
        unit.laneRow = 0;
        unit.visualLaneRow = 0;
        unit.travelFacingX = direction === 1 ? -1 : 1;
        unit.travelFacingDirection = direction === 1 ? "w" : "e";
        unit.combatFacingX = unit.travelFacingX;
        unit.combatFacingDirection = unit.travelFacingDirection;
        const start = this.progressToScreen(unit.visualProgress, unit.visualLaneRow, unit.laneId);
        unit.lastPresentationX = start.x;
        unit.lastPresentationY = start.y;
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.syncUnitPresentation(unit);
        this.publishDebug();
      },
      prepareDirectionalAuditProbe: (
        unitId: BattleUnitId | SupportUnitId,
        team: TeamId,
        direction: -1 | 1,
      ) => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        const role = unitId === "supply_wagon" ? "support" : "battle";
        this.spawnLaneUnit(team, role, unitId, 0.5 + direction * 0.045, 0);
        const unit = this.units[0];
        if (!unit) return;
        unit.attackAnimTime = 0;
        unit.attackFacingLockSec = 0;
        unit.attackTimerSec = 10;
        unit.progress = 0.5 + direction * 0.045;
        unit.visualProgress = 0.5;
        unit.laneRow = 0;
        unit.visualLaneRow = 0;
        unit.travelFacingX = direction === 1 ? -1 : 1;
        unit.travelFacingDirection = direction === 1 ? "w" : "e";
        unit.combatFacingX = unit.travelFacingX;
        unit.combatFacingDirection = unit.travelFacingDirection;
        const start = this.progressToScreen(unit.visualProgress, unit.visualLaneRow, unit.laneId);
        unit.lastPresentationX = start.x;
        unit.lastPresentationY = start.y;
        this.units.forEach((entry) => this.setUnitPresentationVisible(entry, entry === unit));
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.syncUnitPresentation(unit);
        this.publishDebug();
      },
      stepDirectionProbe: () => {
        const unit = this.units.find((entry) => entry.sprite.visible);
        if (!unit) return;
        this.syncUnitVisual(unit, 1 / 60);
        this.publishDebug();
      },
      setDirectionalAuditPhase: (phase: number) => {
        const unit = this.units.find((entry) => entry.sprite.visible);
        if (!unit) return;
        unit.walkCyclePhase = Phaser.Math.Wrap(phase, 0, 1);
        this.syncUnitPresentation(unit);
        this.publishDebug();
      },
      setUnitsVisible: (visible: boolean) => {
        this.units.forEach((unit) => this.setUnitPresentationVisible(unit, visible));
      },
      focusAttackPair: (unitId: BattleUnitId, team: TeamId) => {
        const attacker = this.units.find((unit) => unit.unitId === unitId && unit.team === team);
        if (!attacker) return;
        const target = this.findNearestEnemy(attacker);
        this.units.forEach((unit) => {
          this.setUnitPresentationVisible(unit, unit === attacker || unit === target);
        });
      },
      prepareRangedProjectile: () => {
        this.units.forEach((unit) => {
          unit.attackTimerSec = 10;
          this.setUnitPresentationVisible(unit, false);
        });
        const attacker = this.units.find((unit) => unit.unitId === "stone_slinger" && unit.team === "player");
        if (!attacker) return;
        const target = this.findNearestEnemy(attacker);
        attacker.attackTimerSec = 0;
        this.setUnitPresentationVisible(attacker, true);
        if (target) this.setUnitPresentationVisible(target, true);
      },
      prepareSupportProbe: () => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.activeProjectiles.forEach((projectile) => projectile.destroy());
        this.activeProjectiles.clear();
        this.defenseTowers.forEach((tower) => {
          tower.built = false;
          tower.hp = 0;
          tower.buildRemainingSec = 0;
        });
        for (let index = 0; index < 3; index += 1) {
          this.spawnLaneUnit("player", "battle", "stone_axeman", 0.5 + (index - 1) * 0.008, (index - 1) * 1.6);
        }
        this.spawnLaneUnit("player", "support", "supply_wagon", 0.482, 0);
        const support = this.units.find((unit) => unit.unitId === "supply_wagon");
        const allies = this.units.filter((unit) => unit.role === "battle");
        if (!support) return;
        support.manaCurrent = support.manaMax;
        support.attackTimerSec = 0;
        allies.forEach((ally) => {
          ally.attackTimerSec = 10;
          ally.hp = Math.max(1, ally.maxHp - 12);
        });
        [...allies, support].forEach((unit) => this.syncUnitPresentation(unit));
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.publishDebug();
        this.scene.pause();
      },
      prepareSupportSeekProbe: (
        team: TeamId,
        relation: "ahead" | "behind" | "far",
      ) => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.activeProjectiles.forEach((projectile) => projectile.destroy());
        this.activeProjectiles.clear();
        const supportProgress = 0.5;
        const forward = team === "player" ? 1 : -1;
        const allyOffset = relation === "far"
          ? forward * 0.22
          : relation === "ahead" ? forward * 0.09 : forward * -0.06;
        this.spawnLaneUnit(team, "support", "supply_wagon", supportProgress, 0);
        this.spawnLaneUnit(team, "battle", "stone_axeman", supportProgress + allyOffset, 0);
        const support = this.units.find((unit) => unit.role === "support");
        const ally = this.units.find((unit) => unit.role === "battle");
        if (!support || !ally) return;
        support.attackTimerSec = 0;
        support.manaCurrent = support.manaMax;
        ally.attackTimerSec = 10;
        ally.hp = Math.max(1, ally.maxHp - 20);
        this.units.forEach((unit) => this.syncUnitPresentation(unit));
        const focus = this.progressToScreen(supportProgress, 0, support.laneId);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.publishDebug();
        this.scene.pause();
      },
      stepSupportProbe: (deltaSec: number) => {
        const support = this.units.find((unit) => unit.unitId === "supply_wagon" && unit.team === "player");
        if (!support) return;
        const step = Math.max(0, deltaSec);
        support.attackTimerSec -= step;
        support.manaCurrent = Math.min(support.manaMax, support.manaCurrent + support.manaRegenPerSec * step);
        this.tickSupport(support, step);
        this.units.filter((unit) => unit.team === "player").forEach((unit) => this.syncUnitPresentation(unit));
        this.publishDebug();
      },
      stepSupportSeekProbe: (deltaSec: number) => {
        const step = Math.max(0, deltaSec);
        this.units.filter((unit) => unit.role === "support").forEach((support) => {
          support.attackTimerSec -= step;
          support.manaCurrent = Math.min(
            support.manaMax,
            support.manaCurrent + support.manaRegenPerSec * step,
          );
          this.tickSupport(support, step);
        });
        this.units.forEach((unit) => this.syncUnitVisual(unit, step));
        this.publishDebug();
      },
    };
    (window as unknown as { __terrainPrototypeControl: typeof control }).__terrainPrototypeControl = control;
    this.setTerrainMode(this.terrainMode, false);
  }

  private setTerrainMode(mode: TerrainRenderMode, announce: boolean): void {
    this.terrainMode = mode;
    this.terrainPrototypeEnabled = mode !== "legacy";
    this.terrainPrototype.setEnabled(mode === "prototype");
    this.terrainPrototypeV2.setEnabled(mode === "prototype-v2");
    this.terrainWorld.setEnabled(mode === "world-surface");
    this.originalBackground.setVisible(mode === "legacy" || mode === "prototype");
    this.prototypeV2Background.setVisible(mode === "prototype-v2");
    this.legacyObstacleObjects.forEach((object) => object.setVisible(mode !== "world-surface"));

    this.capturePoints.forEach((point) => {
      const isV2 = mode === "prototype-v2" || mode === "world-surface";
      point.ring
        .setScale(1)
        .setVisible(!isV2 || this.selectedCapturePointId === point.id);
      point.core
        .setScale(1)
        .setVisible(!isV2);
    });
    this.units.forEach((unit) => this.syncUnitPresentation(unit));
    this.refreshCapturePointVisuals();
    this.refreshDefenseTowerVisuals();

    if (announce) {
      const label = mode === "legacy"
        ? "기존 전장 렌더링"
        : mode === "prototype"
          ? "중앙 지형 프로토타입 V1"
          : `전체 레인 지형 V2 · ${this.prototypePresetId}/${this.scalePresetId}`;
      this.hud.setInfo(`${label} 표시`);
    }
  }

  private focusCentralCapture(): void {
    const focus = this.progressToScreen(CENTRAL_CAPTURE_PROGRESS, 0);
    this.cameras.main.centerOn(focus.x, focus.y);
  }

  private isPointerOnUi(pointer: Phaser.Input.Pointer): boolean {
    return this.audioSettingsOpen || pointer.y <= 250 || pointer.y >= CANVAS_H - 260;
  }

  private drawBattlefield(): void {
    this.originalBackground = this.add.image(WORLD_W / 2, WORLD_H / 2, "lane-battlefield-bg")
      .setDisplaySize(WORLD_W, WORLD_H)
      .setDepth(DEPTH_BG);
    this.prototypeV2Background = this.add.image(WORLD_W / 2, WORLD_H / 2, "lane-battlefield-bg-v2")
      .setDisplaySize(WORLD_W, WORLD_H)
      .setDepth(DEPTH_BG)
      .setVisible(false);
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x07111b, 0.12).setDepth(DEPTH_BG + 1);

    this.terrainPrototype = new BattlefieldPrototypeRenderer(
      this,
      CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC,
      (groundY, offset) => this.getGroundDepth(groundY, offset),
    );
    this.terrainPrototype.create();
    this.terrainPrototype.setEnabled(this.terrainMode === "prototype");
    this.terrainPrototypeV2 = new BattlefieldPrototypeRenderer(
      this,
      this.mapSpec,
      (groundY, offset) => this.getGroundDepth(groundY, offset),
      "v2",
      {
        ...this.prototypeVisualConfig,
        terrain: {
          ...this.prototypeVisualConfig.terrain,
          foundationScale: this.prototypeVisualConfig.terrain.foundationScale
            * this.scaleVisualConfig.foundationScaleMultiplier,
        },
      },
    );
    this.terrainPrototypeV2.create();
    this.terrainPrototypeV2.setEnabled(this.terrainMode === "prototype-v2");
    this.terrainWorld = new BattlefieldWorldRenderer(
      this,
      this.mapSpec,
      WORLD_W,
      WORLD_H,
      (groundY, offset) => this.getGroundDepth(groundY, offset),
    );
    this.terrainWorld.create();
    this.terrainWorld.setEnabled(this.terrainMode === "world-surface");

    const laneGlow = this.add.graphics().setDepth(DEPTH_FIELD);
    laneGlow.lineStyle(82, 0xffffff, 0.05);
    laneGlow.beginPath();
    laneGlow.moveTo(this.lanePath[0].position.x, this.lanePath[0].position.y);
    this.lanePath.slice(1).forEach((node) => laneGlow.lineTo(node.position.x, node.position.y));
    laneGlow.strokePath();
    laneGlow.lineStyle(18, 0xf2e0a4, 0.18);
    laneGlow.beginPath();
    laneGlow.moveTo(this.lanePath[0].position.x, this.lanePath[0].position.y);
    this.lanePath.slice(1).forEach((node) => laneGlow.lineTo(node.position.x, node.position.y));
    laneGlow.strokePath();

    this.laneObstacles.forEach((obstacle) => {
      const pos = this.progressToScreen(obstacle.progress, obstacle.laneRow);
      const object = this.add.image(pos.x, pos.y, obstacle.textureKey)
        .setDisplaySize(obstacle.width, obstacle.height)
        .setOrigin(0.5, 0.86)
        .setAlpha(obstacle.alpha ?? 1)
        .setDepth(this.getGroundDepth(pos.y));
      object.setVisible(this.terrainMode !== "world-surface");
      this.legacyObstacleObjects.push(object);
    });

    const captureDefinitions = getCapturePointDefinitions(this.mapSpec);
    const captureSockets = this.mapSpec.structureSockets.filter((socket) => socket.kind === "capture-point");
    this.capturePoints = captureDefinitions.map((definition, socketIndex) => {
      const { id: index } = definition;
      const socket = captureSockets[socketIndex] ?? getStructureSocket(
        this.mapSpec,
        getCapturePointSocketId(index),
      );
      const progress = socket?.progress ?? definition.progress;
      const laneId = socket?.laneRef.laneId ?? this.primaryLaneSpec.id;
      const pos = this.progressToScreen(progress, 0, laneId);
      const ring = this.add.circle(pos.x, pos.y, 34, 0xf3cc6a, 0.2)
        .setDepth(this.getGroundDepth(pos.y, -6))
        .setStrokeStyle(4, 0xf8e2a5, 0.55);
      const core = this.add.circle(pos.x, pos.y, 14, 0xf8e2a5, 0.78)
        .setDepth(this.getGroundDepth(pos.y, -5));
      const marker = this.add.image(pos.x, pos.y + STRUCTURE_SOCKET_ATTACH_Y, getCaptureMarkerTexture("neutral"))
        .setOrigin(STRUCTURE_GROUND_ORIGIN.x, STRUCTURE_GROUND_ORIGIN.y)
        .setDepth(this.getGroundDepth(pos.y))
        .setVisible(this.terrainMode === "world-surface");
      const label = this.add.text(pos.x, pos.y - 40, `거점 ${index + 1}`, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#fff4cf",
        stroke: "#1a130a",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(this.getGroundDepth(pos.y, 4));
      const ownerText = this.add.text(pos.x, pos.y + 28, "중립", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#eadfb3",
        stroke: "#1a130a",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(this.getGroundDepth(pos.y, 4));
      const buildingText = this.add.text(pos.x, pos.y + 46, "빈 거점", {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: "#d3d8e8",
        stroke: "#132033",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(this.getGroundDepth(pos.y, 4));
      ring.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));
      core.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));
      marker.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));
      label.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));

      return {
        id: index,
        definition,
        laneId,
        progress,
        owner: "neutral",
        control: 0,
        buildingId: undefined,
        buildingLevel: 0,
        attackTimerSec: 0,
        incomeTimerSec: 0,
        supplyTimerSec: 0,
        manaCurrent: 0,
        manaMax: 0,
        manaRegenPerSec: 0,
        ring,
        core,
        marker,
        label,
        ownerText,
        buildingText,
      };
    });

    const towerDefinitions = getDefenseTowerDefinitions(this.mapSpec);
    const towerSockets = this.mapSpec.structureSockets.filter((socket) => socket.kind === "defense-tower");
    this.defenseTowers = towerDefinitions.map((definition, socketIndex) => {
      const socket = towerSockets[socketIndex] ?? getStructureSocket(
        this.mapSpec,
        getDefenseTowerSocketId(definition.id),
      );
      const progress = socket?.progress ?? definition.progress;
      const laneId = socket?.laneRef.laneId ?? this.primaryLaneSpec.id;
      const pos = this.progressToScreen(progress, 0, laneId);
      const sprite = this.add.image(pos.x, pos.y + STRUCTURE_SOCKET_ATTACH_Y, getDefenseTowerTexture("full", definition.owner))
        .setDisplaySize(TOWER_W, TOWER_H)
        .setOrigin(STRUCTURE_GROUND_ORIGIN.x, STRUCTURE_GROUND_ORIGIN.y)
        .setDepth(this.getGroundDepth(pos.y));
      const selectionHitZone = this.add.zone(pos.x, pos.y, TOWER_W, TOWER_H)
        .setOrigin(STRUCTURE_GROUND_ORIGIN.x, STRUCTURE_GROUND_ORIGIN.y)
        .setDepth(this.getGroundDepth(pos.y, -1))
        .setInteractive({ useHandCursor: true });
      const hpBg = this.add.rectangle(pos.x, pos.y - 158, 60, 7, 0x132033, 0.92)
        .setDepth(sprite.depth + 1);
      const hpFill = this.add.rectangle(pos.x - 30, pos.y - 158, 60, 7, 0xf3cc6a, 1)
        .setOrigin(0, 0.5)
        .setDepth(sprite.depth + 2);
      const label = this.add.text(pos.x, pos.y - 190, `방어 타워 ${definition.id + 1}`, {
        fontFamily: "sans-serif", fontSize: "14px", color: "#fff4cf", stroke: "#1a130a", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(this.getGroundDepth(pos.y, 7));
      const ownerText = this.add.text(pos.x, pos.y + 34, definition.owner === "player" ? "아군 타워" : "적 타워", {
        fontFamily: "sans-serif", fontSize: "12px", color: "#d3d8e8", stroke: "#132033", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(this.getGroundDepth(pos.y, 7));
      const statusText = this.add.text(pos.x, pos.y + 52, "가동 중", {
        fontFamily: "sans-serif", fontSize: "11px", color: "#d3d8e8", stroke: "#132033", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(this.getGroundDepth(pos.y, 7));
      sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectDefenseTower(definition.id));
      selectionHitZone.on("pointerdown", () => this.selectDefenseTower(definition.id));
      label.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectDefenseTower(definition.id));
      const maxHp = getDefenseTowerMaxHp("stone");
      const defense = getDefenseTowerDefense("stone");
      return {
        id: definition.id,
        definition,
        laneId,
        progress,
        owner: definition.owner,
        control: definition.owner === "player" ? 1 : -1,
        attackTimerSec: 0,
        buildRemainingSec: 0,
        built: true,
        maxHp,
        hp: maxHp,
        defense,
        sprite,
        selectionHitZone,
        hpBg,
        hpFill,
        groundPresentation: this.terrainPrototype.getSocketPresentation(getDefenseTowerSocketId(definition.id)),
        groundPresentationV2: this.terrainPrototypeV2.getSocketPresentation(getDefenseTowerSocketId(definition.id)),
        groundPresentationWorld: this.terrainWorld.getSocketPresentation(getDefenseTowerSocketId(definition.id)),
        label,
        ownerText,
        statusText,
      };
    });

    const laneStarts = this.mapSpec.lanes.map((lane) => this.progressToScreen(0, 0, lane.id));
    const laneEnds = this.mapSpec.lanes.map((lane) => this.progressToScreen(1, 0, lane.id));
    const playerBase = laneStarts.reduce((sum, point) => sum.add(point), new Phaser.Math.Vector2(0, 0)).scale(1 / laneStarts.length);
    const enemyBase = laneEnds.reduce((sum, point) => sum.add(point), new Phaser.Math.Vector2(0, 0)).scale(1 / laneEnds.length);
    const baseVisibleWorldHeight = this.cssPxToWorld(220);
    const baseDisplaySize = baseVisibleWorldHeight / MAIN_BASE_VISIBLE_HEIGHT_RATIO;
    this.add.ellipse(playerBase.x + 8, playerBase.y + 3, 250, 82, 0x111918, 0.34)
      .setRotation(-0.08)
      .setDepth(this.getGroundDepth(playerBase.y, -1));
    const playerBaseSprite = this.add.image(playerBase.x, playerBase.y, getMainBaseTexture("player"))
      .setDisplaySize(baseDisplaySize, baseDisplaySize)
      .setOrigin(STRUCTURE_GROUND_ORIGIN.x, STRUCTURE_GROUND_ORIGIN.y)
      .setDepth(this.getGroundDepth(playerBase.y));
    this.add.ellipse(enemyBase.x + 8, enemyBase.y + 3, 250, 82, 0x111918, 0.34)
      .setRotation(-0.08)
      .setDepth(this.getGroundDepth(enemyBase.y, -1));
    const enemyBaseSprite = this.add.image(enemyBase.x, enemyBase.y, getMainBaseTexture("enemy"))
      .setDisplaySize(baseDisplaySize, baseDisplaySize)
      .setOrigin(STRUCTURE_GROUND_ORIGIN.x, STRUCTURE_GROUND_ORIGIN.y)
      .setDepth(this.getGroundDepth(enemyBase.y));
    const playerBaseLabel = this.add.text(playerBase.x - 8, playerBase.y - baseVisibleWorldHeight - this.cssPxToWorld(20), "아군 본진", {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#dceeff",
      stroke: "#16202a",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(this.getGroundDepth(playerBase.y, 4));
    const enemyBaseLabel = this.add.text(enemyBase.x + 4, enemyBase.y - baseVisibleWorldHeight - this.cssPxToWorld(20), "적 본진", {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#ffe1e1",
      stroke: "#2a1616",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(this.getGroundDepth(enemyBase.y, 4));
    const playerBaseHitZone = this.add.zone(playerBase.x, playerBase.y, baseDisplaySize * 0.82, baseDisplaySize * 0.82)
      .setDepth(this.getGroundDepth(playerBase.y, 3))
      .setInteractive({ useHandCursor: true });
    const enemyBaseHitZone = this.add.zone(enemyBase.x, enemyBase.y, baseDisplaySize * 0.82, baseDisplaySize * 0.82)
      .setDepth(this.getGroundDepth(enemyBase.y, 3))
      .setInteractive({ useHandCursor: true });
    playerBaseSprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectMainBase("player"));
    playerBaseLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectMainBase("player"));
    playerBaseHitZone.on("pointerdown", () => this.selectMainBase("player"));
    enemyBaseSprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectMainBase("enemy"));
    enemyBaseLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectMainBase("enemy"));
    enemyBaseHitZone.on("pointerdown", () => this.selectMainBase("enemy"));
  }

  private createUi(): void {
    this.hud = new LaneBattleHudView(
      this,
      this.audio,
      {
        hireWorker: () => this.hireWorker(),
        hireResearchWorker: () => this.hireResearchWorker(),
        useInstantWave: () => this.tryUseInstantWaveToken(this.player),
        ageUp: () => this.tryAgeUpPlayer(),
        shiftWorker: (role, delta) => this.shiftWorker(role, delta),
        rebuildDefenseTower: () => this.tryRebuildSelectedDefenseTower(),
        buildDefenseTower: () => this.tryBuildAtSelectedPoint("defense_tower"),
        buildSupplyDepot: () => this.tryBuildAtSelectedPoint("supply_depot"),
        buildMint: () => this.tryBuildAtSelectedPoint("mint"),
        dismantle: () => this.tryDismantleSelectedPoint(),
        toggleDevMode: () => this.toggleDevMode(),
        grantDevResearch: () => this.grantDevResearchPoints(),
        onAudioSettingsVisibilityChange: (visible) => {
          this.audioSettingsOpen = visible;
        },
      },
      CANVAS_W,
      CANVAS_H,
      DEPTH_UI,
      QUERY_PARAMS.get("audioDebug") === "1",
    );
    this.baseResearchPanel = new BaseResearchPanel(this, {
      close: () => this.closeMainBasePanel(),
      browseAge: (delta) => this.browsePlayerProductionAge(delta),
      adjustStat: (unitId, stat, delta) => this.adjustPlayerResearchDraft(unitId, stat, delta),
      apply: () => this.applyPlayerResearchDraft(),
      cancel: () => this.cancelPlayerResearchDraft(),
    }, DEPTH_UI + 80);
  }

  private getSelectedCaptureActions(): (CapturePointAction | DefenseTowerAction)[] {
    const tower = this.defenseTowers.find((entry) => entry.id === this.selectedDefenseTowerId);
    if (tower) {
      return tower.owner === "player" && !tower.built && tower.buildRemainingSec <= 0
        ? ["rebuild-defense-tower"]
        : [];
    }
    const point = this.capturePoints.find((entry) => entry.id === this.selectedCapturePointId);
    return point ? getCapturePointActions(point.definition, point) : [];
  }

  private updateAudioState(): void {
    const engagedUnits = this.units.filter((unit) => {
      const nearest = this.findNearestEnemy(unit);
      if (!nearest) return false;
      const engagementDistance = Math.max(ENGAGE_GAP * 2.6, unit.range * RANGE_TO_PROGRESS * 1.35);
      return this.unitDistance(unit, nearest) <= engagementDistance;
    }).length;
    const playerTower = this.defenseTowers.find((tower) => tower.owner === "player");
    this.audioWiring.update(this.elapsedSec, {
      engagedUnits,
      activeProjectiles: this.activeProjectiles.size,
      playerBaseHpRatio: this.player.baseHp / PLAYER_BASE_HP,
      playerFortressHpRatio: playerTower
        ? playerTower.built ? playerTower.hp / playerTower.maxHp : 0
        : 1,
    });
  }

  private syncGameplayMusicTheme(): void {
    const theme = resolveGameplayMusicTheme(getAge(this.player.ageId).productionGroup);
    this.audio.setGameplayMusicTheme(theme);
  }

  private playWorldSfx(
    assetId: string,
    x: number,
    y: number,
    eventKey: string,
    highFrequency = true,
  ): void {
    const camera = this.cameras.main;
    this.audioWiring.playWorldSfx(
      assetId,
      { x, y },
      {
        centerX: camera.midPoint.x,
        centerY: camera.midPoint.y,
        width: camera.width,
        height: camera.height,
        zoom: camera.zoom,
      },
      eventKey,
      this.elapsedSec,
      highFrequency,
    );
  }

  private updateAudioDebugOverlay(): void {
    this.hud.setAudioDebugLines(this.audioWiring.getDebugLines());
  }

  private tickEconomy(deltaSec: number): void {
    tickLaneEconomy([this.player, this.enemy], this.workerAccumulator, deltaSec);
  }

  private tickAi(deltaSec: number): void {
    tickWaveClock(this.enemy, deltaSec);
    if (this.shouldAiAgeUp()) this.advanceAge(this.enemy);
    if (shouldAiUseInstantWave(this.enemy, AI_INSTANT_WAVE_MIN_REMAINING_SEC)) {
      this.tryUseInstantWaveToken(this.enemy);
    }
  }

  private shouldAiAgeUp(): boolean {
    return shouldAdvanceAiAge(this.enemy, this.elapsedSec);
  }

  private tickWaves(deltaSec: number): void {
    const playerClock = tickWaveClock(this.player, deltaSec);
    if (playerClock.prepareWarning) {
      this.audio.playSfx("sfx.wave.prepare", { eventKey: `wave:prepare:${Math.floor(this.elapsedSec)}` });
    }
    if (playerClock.due) this.trySpawnWave(this.player, false);
    if (this.enemy.nextWaveInSec <= 0) this.trySpawnWave(this.enemy, false);
  }

  private tickCombat(deltaSec: number): void {
    const playerHasSupply = this.units.some((unit) => unit.team === "player" && unit.role === "support");
    const enemyHasSupply = this.units.some((unit) => unit.team === "enemy" && unit.role === "support");

    this.units.forEach((unit) => {
      if (unit.team === "player" && unit.role === "battle") unit.attrition = Phaser.Math.Clamp(unit.attrition + (playerHasSupply ? -0.18 : 0.12) * deltaSec, 0, 0.7);
      if (unit.team === "enemy" && unit.role === "battle") unit.attrition = Phaser.Math.Clamp(unit.attrition + (enemyHasSupply ? -0.18 : 0.12) * deltaSec, 0, 0.7);
    });

    this.units.forEach((unit) => {
      unit.attackAnimTime = Math.max(0, unit.attackAnimTime - deltaSec);
      unit.attackFacingLockSec = Math.max(0, unit.attackFacingLockSec - deltaSec);
      unit.combatFacingHoldSec = Math.max(0, unit.combatFacingHoldSec - deltaSec);
      unit.attackTimerSec -= deltaSec;
      if (unit.role === "support") {
        unit.manaCurrent = Math.min(unit.manaMax, unit.manaCurrent + unit.manaRegenPerSec * deltaSec);
        this.tickSupport(unit, deltaSec);
        return;
      }
      const nearest = this.findNearestEnemy(unit);
      const enemyTower = this.findNearestEnemyTower(unit);
      if (!nearest && !enemyTower) {
        this.advanceUnit(unit, deltaSec);
        return;
      }
      if (enemyTower && (!nearest || this.towerDistance(unit, enemyTower) < this.unitDistance(unit, nearest))) {
        const towerDistance = this.towerDistance(unit, enemyTower);
        const attackRange = unit.range * RANGE_TO_PROGRESS;
        if (towerDistance > attackRange) {
          this.advanceUnit(unit, deltaSec);
          return;
        }
        this.holdUnitCombatFacing(unit, enemyTower.sprite.x, enemyTower.sprite.y);
        if (unit.attackTimerSec <= 0) {
          unit.attackTimerSec = unit.attackCooldownSec;
          this.playWorldSfx(
            this.isRangedUnit(unit) ? "sfx.combat.rangedFire" : "sfx.combat.meleeAttack",
            unit.sprite.x,
            unit.sprite.y,
            `attack:${unit.id}:tower:${enemyTower.id}:${Math.round(this.elapsedSec * 1000)}`,
          );
          const damageBase = unit.attack * (1 - unit.attrition);
          const damage = Math.max(1, Math.round(damageBase * this.getAttackBuffMultiplier(unit)));
          if (this.isRangedUnit(unit)) {
            const start = this.getUnitProjectileAnchor(unit);
            const end = this.getTowerProjectileAnchor(enemyTower, false);
            this.startRangedAttack(unit, enemyTower.sprite.x, enemyTower.sprite.y, "structure", () => {
              this.launchProjectile(start, end, getProjectileKeyForUnit(unit.unitId), () => this.applyDamageToTower(enemyTower, damage, unit.team), 1.02);
            });
          } else {
            this.startMeleeAttack(unit, enemyTower.sprite.x, enemyTower.sprite.y, "structure", () => {
              this.applyDamageToTower(enemyTower, damage, unit.team);
            });
          }
        }
        return;
      }
      if (!nearest) {
        this.advanceUnit(unit, deltaSec);
        return;
      }
      const distance = this.unitDistance(unit, nearest);
      const attackRange = unit.range * RANGE_TO_PROGRESS;
      if (distance > attackRange) {
        this.advanceUnit(unit, deltaSec, nearest);
        return;
      }
      this.holdUnitCombatFacing(unit, nearest.sprite.x, nearest.sprite.y);
      if (unit.attackTimerSec <= 0) {
        unit.attackTimerSec = unit.attackCooldownSec;
        this.playWorldSfx(
          this.isRangedUnit(unit) ? "sfx.combat.rangedFire" : "sfx.combat.meleeAttack",
          unit.sprite.x,
          unit.sprite.y,
          `attack:${unit.id}:unit:${nearest.id}:${Math.round(this.elapsedSec * 1000)}`,
        );
        const damageBase = unit.attack * (1 - unit.attrition);
        const damage = Math.max(1, Math.round(damageBase * this.getAttackBuffMultiplier(unit) - nearest.defense));
        if (this.isRangedUnit(unit)) {
          const start = this.getUnitProjectileAnchor(unit);
          const end = this.getUnitProjectileAnchor(nearest);
          this.startRangedAttack(unit, nearest.sprite.x, nearest.sprite.y, "unit", () => {
            if (!this.units.includes(nearest)) return;
            this.launchProjectile(start, end, getProjectileKeyForUnit(unit.unitId), () => this.applyDamageToUnit(nearest, damage, unit.team === "player" ? "#ffd67a" : "#ff8f8f"), 1.04);
          });
        } else {
          this.startMeleeAttack(unit, nearest.sprite.x, nearest.sprite.y, "unit", () => {
            if (!this.units.includes(nearest)) return;
            nearest.hp -= damage;
            this.playWorldSfx(
              "sfx.combat.meleeHit",
              nearest.sprite.x,
              nearest.sprite.y,
              `impact:melee:${unit.id}:${nearest.id}:${Math.round(this.elapsedSec * 1000)}`,
            );
            this.playImpactFeedback(unit, nearest, damage);
            this.spawnToast(`${damage}`, nearest.sprite.x, nearest.sprite.y - 26, unit.team === "player" ? "#ffd67a" : "#ff8f8f");
            if (nearest.hp <= 0) this.killUnit(nearest);
          });
        }
      }
    });

    this.units.forEach((unit) => this.syncUnitVisual(unit, deltaSec));
    this.checkBasePressure(deltaSec);
  }

  private tickSupport(unit: LaneUnit, deltaSec: number): void {
    const allies = this.units.filter((other) =>
      other.team === unit.team
      && other.role === "battle"
      && other.laneId === unit.laneId,
    );
    const healRange = unit.range * RANGE_TO_PROGRESS;
    const injured = allies
      .filter((ally) => ally.hp < ally.maxHp)
      .sort((a, b) => {
        const distanceDelta = this.unitDistance(unit, a) - this.unitDistance(unit, b);
        if (Math.abs(distanceDelta) > 0.004) return distanceDelta;
        return a.hp / a.maxHp - b.hp / b.maxHp;
      });
    const injuredInRange = injured.filter((ally) => this.unitDistance(unit, ally) <= healRange);
    if (injuredInRange.length > 0 && unit.attackTimerSec <= 0 && unit.manaCurrent >= unit.healManaCost) {
      unit.attackTimerSec = unit.attackCooldownSec;
      unit.manaCurrent -= unit.healManaCost;
      this.startSupportCast(
        unit,
        injuredInRange[0].sprite.x,
        injuredInRange[0].sprite.y,
        () => this.applySupportHeal(unit),
      );
      return;
    }

    const pursuedInjured = injured.find(
      (ally) => this.unitDistance(unit, ally) <= SUPPORT_ACQUISITION_RANGE_PROGRESS,
    );
    const nearestAlly = [...allies]
      .filter((ally) => this.unitDistance(unit, ally) <= SUPPORT_ACQUISITION_RANGE_PROGRESS)
      .sort((a, b) => this.unitDistance(unit, a) - this.unitDistance(unit, b))[0];
    const target = pursuedInjured ?? nearestAlly;
    if (!target) return;

    const currentDistance = this.unitDistance(unit, target);
    const desiredRange = healRange * (pursuedInjured ? 0.68 : 0.78);
    if (currentDistance <= desiredRange) return;
    this.moveSupportTowardAlly(unit, target, desiredRange, deltaSec);
  }

  private moveSupportTowardAlly(
    unit: LaneUnit,
    ally: LaneUnit,
    desiredRange: number,
    deltaSec: number,
  ): void {
    const trailingDirection = unit.team === "player" ? -1 : 1;
    const desiredProgress = Phaser.Math.Clamp(
      ally.progress + trailingDirection * desiredRange,
      0.01,
      0.99,
    );
    const desiredLaneRow = ally.laneRow;
    if (
      progressBetween(unit.progress, desiredProgress) <= SUPPORT_ARRIVAL_EPSILON_PROGRESS
      && Math.abs(unit.laneRow - desiredLaneRow) <= 0.18
    ) return;

    // Use the full ally-relative destination for facing. A one-tick movement
    // delta is below the flip dead zone and previously left support walking backward.
    this.setUnitTravelFacing(unit, desiredProgress, desiredLaneRow);
    const moveStep = unit.speed * UNIT_PROGRESS_SPEED * deltaSec;
    unit.progress = this.moveToward(unit.progress, desiredProgress, moveStep);
    unit.laneRow = Phaser.Math.Linear(unit.laneRow, desiredLaneRow, Math.min(1, deltaSec * 4.2));
    this.keepUnitInPlayableLane(unit);
  }

  private applySupportHeal(unit: LaneUnit): void {
    const injured = this.units
      .filter((ally) => (
        ally.team === unit.team
        && ally.role === "battle"
        && ally.laneId === unit.laneId
        && ally.hp < ally.maxHp
        && this.unitDistance(unit, ally) <= unit.range * RANGE_TO_PROGRESS
      ))
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    let remainingHeal = unit.healPower;
    let totalHealed = 0;
    for (const ally of injured) {
      if (remainingHeal <= 0) break;
      const missingHp = ally.maxHp - ally.hp;
      if (missingHp <= 0) continue;
      const applied = Math.min(missingHp, Math.max(1, remainingHeal));
      ally.hp += applied;
      remainingHeal -= applied;
      totalHealed += applied;
    }
    if (totalHealed <= 0) return;
    this.playWorldSfx(
      "sfx.support.heal",
      unit.sprite.x,
      unit.sprite.y,
      `support-heal:${unit.id}:${Math.round(this.elapsedSec * 1000)}`,
    );
    this.spawnToast(`치유 ${totalHealed}`, unit.sprite.x, unit.sprite.y - 44, "#92f1a5");
  }

  private getUnitAttackTimingRole(unit: LaneUnit): AttackTimingRole {
    if (unit.role === "support") return "support";
    return this.isRangedUnit(unit) ? "ranged" : "melee";
  }

  private getUnitAttackTiming(unit: LaneUnit, targetKind: AttackTargetKind): AttackTimingProfile {
    return getAttackTimingProfile(this.getUnitAttackTimingRole(unit), targetKind);
  }

  private beginAttackPresentation(
    unit: LaneUnit,
    targetX: number,
    targetY: number,
    targetKind: AttackTargetKind,
  ): AttackTimingProfile {
    const timing = this.getUnitAttackTiming(unit, targetKind);
    unit.attackAnimTime = timing.durationSec;
    unit.attackFacingLockSec = timing.durationSec;
    unit.attackTargetKind = targetKind;
    this.engagedUnitIds.add(unit.id);
    this.holdUnitCombatFacing(unit, targetX, targetY, timing.durationSec);
    return timing;
  }

  private startMeleeAttack(
    unit: LaneUnit,
    targetX: number,
    targetY: number,
    targetKind: AttackTargetKind,
    onContact: () => void,
  ): void {
    const timing = this.beginAttackPresentation(unit, targetX, targetY, targetKind);
    const sequence = ++unit.attackSequence;
    this.time.delayedCall(timing.eventDelayMs, () => {
      if (!this.units.includes(unit) || unit.attackSequence !== sequence) return;
      onContact();
    });
  }

  private startRangedAttack(
    unit: LaneUnit,
    targetX: number,
    targetY: number,
    targetKind: AttackTargetKind,
    onRelease: () => void,
  ): void {
    const timing = this.beginAttackPresentation(unit, targetX, targetY, targetKind);
    const sequence = ++unit.attackSequence;
    this.time.delayedCall(timing.eventDelayMs, () => {
      if (!this.units.includes(unit) || unit.attackSequence !== sequence) return;
      onRelease();
    });
  }

  private startSupportCast(unit: LaneUnit, targetX: number, targetY: number, onCast: () => void): void {
    const timing = this.beginAttackPresentation(unit, targetX, targetY, "unit");
    const sequence = ++unit.attackSequence;
    this.time.delayedCall(timing.eventDelayMs, () => {
      if (!this.units.includes(unit) || unit.attackSequence !== sequence) return;
      onCast();
    });
  }

  private holdUnitCombatFacing(
    unit: LaneUnit,
    targetX: number,
    targetY: number,
    holdSec = COMBAT_FACING_HOLD_SEC,
  ): void {
    const deltaX = targetX - unit.sprite.x;
    const deltaY = targetY - unit.sprite.y;
    if (
      Math.abs(deltaX) <= FACING_DEAD_ZONE_WORLD_PX
      && Math.abs(deltaY) <= FACING_DEAD_ZONE_WORLD_PX
    ) return;
    unit.combatFacingDirection = resolveUnitFacingDirection(deltaX, deltaY, unit.combatFacingDirection);
    if (Math.abs(deltaX) > HORIZONTAL_FACING_FLIP_DEAD_ZONE_WORLD_PX) unit.combatFacingX = deltaX >= 0 ? 1 : -1;
    unit.combatFacingHoldSec = Math.max(unit.combatFacingHoldSec, holdSec);
  }

  private advanceUnit(unit: LaneUnit, deltaSec: number, combatTarget?: LaneUnit): void {
    const dir = unit.team === "player" ? 1 : -1;
    if (combatTarget && this.isMeleeUnit(unit)) {
      const slot = this.findCombatSlot(unit, combatTarget);
      if (slot) {
        this.setUnitTravelFacing(unit, slot.progress, slot.laneRow);
        unit.laneRow = Phaser.Math.Linear(unit.laneRow, slot.laneRow, 0.34);
        const moveStep = unit.speed * UNIT_PROGRESS_SPEED * deltaSec;
        unit.progress = this.moveToward(unit.progress, slot.progress, moveStep);
        this.keepUnitInPlayableLane(unit);
        return;
      }
    }
    const desired = unit.progress + dir * unit.speed * UNIT_PROGRESS_SPEED * deltaSec;
    const enemyAhead = this.findNearestEnemy(unit);
    if (enemyAhead) this.repositionTowardCombat(unit, enemyAhead);
    if (enemyAhead && this.unitDistance(unit, enemyAhead) <= ENGAGE_GAP + unit.range * RANGE_TO_PROGRESS * 0.3 && !this.isMeleeUnit(unit)) return;

    const friendAhead = this.units
      .filter((other) =>
        other.id !== unit.id
        && other.team === unit.team
        && other.laneId === unit.laneId
        && Math.abs(other.laneRow - unit.laneRow) < 0.5,
      )
      .filter((other) => (unit.team === "player" ? other.progress > unit.progress : other.progress < unit.progress))
      .sort((a, b) => progressBetween(a.progress, unit.progress) - progressBetween(b.progress, unit.progress))[0];

    if (friendAhead) {
      const nextGap = progressBetween(friendAhead.progress, desired);
      if (nextGap < FRIENDLY_GAP) {
        if (!this.tryShiftLane(unit, enemyAhead)) {
          const packedDesired = unit.team === "player"
            ? Math.min(desired, friendAhead.progress - 0.006)
            : Math.max(desired, friendAhead.progress + 0.006);
          this.setUnitTravelFacing(unit, packedDesired, unit.laneRow);
          unit.progress = Phaser.Math.Clamp(packedDesired, 0.01, 0.99);
          this.keepUnitInPlayableLane(unit);
          return;
        }
      }
    }

    this.setUnitTravelFacing(unit, desired, unit.laneRow);
    unit.progress = Phaser.Math.Clamp(desired, 0.01, 0.99);
    this.keepUnitInPlayableLane(unit);
  }

  private repositionTowardCombat(unit: LaneUnit, enemy: LaneUnit): void {
    if (this.isMeleeUnit(unit)) {
      const slot = this.findCombatSlot(unit, enemy);
      if (slot) {
        unit.laneRow = Phaser.Math.Linear(unit.laneRow, slot.laneRow, 0.4);
        return;
      }
    }
    const frontlineGap = progressBetween(unit.progress, enemy.progress);
    if (frontlineGap < 0.08 && Math.abs(enemy.laneRow - unit.laneRow) < 1.2) {
      unit.laneRow = Phaser.Math.Linear(unit.laneRow, enemy.laneRow, 0.45);
      return;
    }
    if (Math.abs(enemy.laneRow - unit.laneRow) < 0.45) return;
    const targetRow = enemy.laneRow > unit.laneRow
      ? unit.laneRow + LANE_SHIFT_STEP
      : unit.laneRow - LANE_SHIFT_STEP;
    if (this.isLaneRowFree(unit, targetRow)) {
      unit.laneRow = Phaser.Math.Clamp(targetRow, LANE_ROW_MIN, LANE_ROW_MAX);
    }
  }

  private tryShiftLane(unit: LaneUnit, enemy?: LaneUnit): boolean {
    const candidates = createLaneRowCandidates(unit.laneRow, 5, LANE_SHIFT_STEP);
    const preferred = enemy
      ? candidates.sort((a, b) => {
          const laneBias = Math.abs(a - enemy.laneRow) - Math.abs(b - enemy.laneRow);
          if (laneBias !== 0) return laneBias;
          return Math.abs(a) - Math.abs(b);
        })
      : candidates;
    const nextRow = preferred.find((row) => row !== unit.laneRow && this.isLaneRowFree(unit, row));
    if (nextRow === undefined) return false;
    unit.laneRow = nextRow;
    this.keepUnitInPlayableLane(unit);
    return true;
  }

  private isLaneRowFree(unit: LaneUnit, laneRow: number): boolean {
    return !this.units.some((other) =>
      other.id !== unit.id
      && other.team === unit.team
      && other.laneId === unit.laneId
      && Math.abs(other.laneRow - laneRow) < COMBAT_ROW_CLEARANCE
      && progressBetween(other.progress, unit.progress) < FRIENDLY_GAP,
    );
  }

  private isMeleeUnit(unit: LaneUnit): boolean {
    return unit.role === "battle" && unit.range <= 2.5;
  }

  private isRangedUnit(unit: LaneUnit): boolean {
    return unit.role === "battle" && unit.range > 2.5;
  }

  private findCombatSlot(unit: LaneUnit, enemy: LaneUnit): CombatSlot | undefined {
    const direction = unit.team === "player" ? -1 : 1;
    const laneCandidates = createLaneRowCandidates(
      enemy.laneRow,
      COMBAT_ROW_REACH,
      COMBAT_ROW_STEP,
    );
    const progressCandidates = COMBAT_PROGRESS_OFFSETS.map((offset) => enemy.progress + direction * offset);

    let best: CombatSlot | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const progress of progressCandidates) {
      for (const laneRow of laneCandidates) {
        const slot = { progress: Phaser.Math.Clamp(progress, 0.02, 0.98), laneRow };
        if (!this.isCombatSlotFree(unit, slot, enemy)) continue;
        const score =
          Math.abs(slot.laneRow - unit.laneRow) * 0.6 +
          Math.abs(slot.progress - unit.progress) * 100 +
          Math.abs(slot.laneRow - enemy.laneRow) * 0.25;
        if (score < bestScore) {
          bestScore = score;
          best = slot;
        }
      }
    }
    return best;
  }

  private isCombatSlotFree(unit: LaneUnit, slot: CombatSlot, enemy: LaneUnit): boolean {
    if (Math.abs(slot.laneRow - enemy.laneRow) > COMBAT_ROW_REACH + 0.001) return false;
    return !this.units.some((other) =>
      other.id !== unit.id &&
      other.team === unit.team &&
      other.laneId === unit.laneId &&
      progressBetween(other.progress, slot.progress) < COMBAT_PROGRESS_CLEARANCE &&
      Math.abs(other.laneRow - slot.laneRow) < COMBAT_ROW_CLEARANCE,
    );
  }

  private moveToward(current: number, target: number, maxDelta: number): number {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + Math.sign(target - current) * maxDelta;
  }

  private setUnitTravelFacing(unit: LaneUnit, targetProgress: number, targetLaneRow: number): void {
    const current = this.progressToScreen(unit.progress, unit.laneRow, unit.laneId);
    const next = this.progressToScreen(
      Phaser.Math.Clamp(targetProgress, 0.01, 0.99),
      Phaser.Math.Clamp(targetLaneRow, LANE_ROW_MIN, LANE_ROW_MAX),
      unit.laneId,
    );
    const deltaX = next.x - current.x;
    const deltaY = next.y - current.y;
    if (
      Math.abs(deltaX) <= FACING_DEAD_ZONE_WORLD_PX
      && Math.abs(deltaY) <= FACING_DEAD_ZONE_WORLD_PX
    ) return;
    unit.travelFacingDirection = resolveUnitFacingDirection(deltaX, deltaY, unit.travelFacingDirection);
    if (Math.abs(deltaX) > HORIZONTAL_FACING_FLIP_DEAD_ZONE_WORLD_PX) {
      unit.travelFacingX = deltaX >= 0 ? 1 : -1;
    }
  }

  private findNearestEnemy(unit: LaneUnit): LaneUnit | undefined {
    return this.units
      .filter((other) => other.team !== unit.team && other.laneId === unit.laneId)
      .sort((a, b) => this.unitDistance(unit, a) - this.unitDistance(unit, b))[0];
  }

  private findNearestEnemyTower(unit: LaneUnit): DefenseTowerState | undefined {
    return this.defenseTowers
      .filter((tower) => tower.owner !== unit.team && tower.built && tower.laneId === unit.laneId)
      .sort((a, b) => this.towerDistance(unit, a) - this.towerDistance(unit, b))[0];
  }

  private unitDistance(a: LaneUnit, b: LaneUnit): number {
    const progressDistance = progressBetween(a.progress, b.progress);
    const rowDistance = Math.abs(a.laneRow - b.laneRow) * 0.01;
    return Math.sqrt(progressDistance * progressDistance + rowDistance * rowDistance);
  }

  private towerDistance(unit: LaneUnit, tower: DefenseTowerState): number {
    const progressDistance = progressBetween(unit.progress, tower.progress);
    const rowDistance = Math.abs(unit.laneRow) * 0.01;
    return Math.sqrt(progressDistance * progressDistance + rowDistance * rowDistance);
  }

  private keepUnitInPlayableLane(unit: LaneUnit): void {
    unit.laneRow = Phaser.Math.Clamp(unit.laneRow, LANE_ROW_MIN, LANE_ROW_MAX);
    this.laneObstacles.forEach((obstacle) => {
      if (progressBetween(unit.progress, obstacle.progress) > obstacle.radiusProgress) return;
      if (Math.abs(unit.laneRow - obstacle.laneRow) > obstacle.radiusRows) return;
      const pushDir = unit.laneRow >= obstacle.laneRow ? 1 : -1;
      unit.laneRow = obstacle.laneRow + pushDir * (obstacle.radiusRows + 0.4);
    });
    unit.laneRow = Phaser.Math.Clamp(unit.laneRow, LANE_ROW_MIN, LANE_ROW_MAX);
  }

  private tickCapturePoints(deltaSec: number): void {
    this.capturePoints.forEach((point) => {
      const prevOwner = point.owner;
      const nearbyPlayer = this.units.filter((unit) => unit.team === "player" && unit.laneId === point.laneId && progressBetween(unit.progress, point.progress) <= CAPTURE_RADIUS_PROGRESS).length;
      const nearbyEnemy = this.units.filter((unit) => unit.team === "enemy" && unit.laneId === point.laneId && progressBetween(unit.progress, point.progress) <= CAPTURE_RADIUS_PROGRESS).length;
      const pressure = Phaser.Math.Clamp((nearbyPlayer - nearbyEnemy) * CAPTURE_RATE_PER_SEC * deltaSec, -0.8, 0.8);

      if (pressure !== 0) point.control = Phaser.Math.Clamp(point.control + pressure, -1, 1);

      if (point.control >= 1) point.owner = "player";
      else if (point.control <= -1) point.owner = "enemy";
      else if (Math.abs(point.control) < 0.08 && nearbyPlayer === 0 && nearbyEnemy === 0) point.owner = "neutral";

      if (prevOwner !== point.owner && prevOwner !== "neutral" && point.owner !== "neutral") {
        this.resolveCapturedStructure(point, point.owner);
      }
      if (prevOwner !== point.owner) {
        if (point.owner === "player") {
          this.audio.playSfx("sfx.capture.complete", { eventKey: `capture:${point.id}:player` });
        } else if (prevOwner === "player") {
          this.audio.playSfx("sfx.capture.lost", { eventKey: `capture:${point.id}:lost` });
        }
      }

      if (point.buildingId === "defense_tower") this.tickCapturePointTower(point, deltaSec);
      if (point.buildingId === "supply_depot") this.tickSupplyDepot(point, deltaSec);
      if (point.buildingId === "mint") this.tickMint(point, deltaSec);
    });

    this.enemyAutoBuildCapturePoint();
    this.defenseTowers.forEach((tower) => this.tickWatchtower(tower, deltaSec));
    this.enemyAutoRebuildDefenseTower();
    this.refreshCapturePointVisuals();
    this.refreshDefenseTowerVisuals();
  }

  private tickWatchtower(tower: DefenseTowerState, deltaSec: number): void {
    if (tower.buildRemainingSec > 0) {
      tower.buildRemainingSec = Math.max(0, tower.buildRemainingSec - deltaSec);
      if (tower.buildRemainingSec === 0) {
        tower.built = true;
        tower.maxHp = getDefenseTowerMaxHp(
          tower.owner === "enemy" ? this.enemy.ageId : this.player.ageId,
          this.getTowerResearchState(tower.owner),
        );
        tower.defense = getDefenseTowerDefense(
          tower.owner === "enemy" ? this.enemy.ageId : this.player.ageId,
          this.getTowerResearchState(tower.owner),
        );
        tower.hp = tower.maxHp;
        tower.attackTimerSec = 0.3;
        if (tower.owner === "player") this.hud.setInfo("타워 재건축 완료");
        if (tower.owner === "player") {
          this.audio.playSfx("sfx.construction.complete", { eventKey: `tower:${tower.id}:complete` });
          this.audio.playSfx("sfx.fortress.rebuilt", { eventKey: `tower:${tower.id}:rebuilt` });
        }
      }
      return;
    }
    if (!tower.built) {
      this.tickTowerRuinControl(tower, deltaSec);
      return;
    }
    if (tower.owner === "neutral") return;
    const expectedMaxHp = getDefenseTowerMaxHp(
      tower.owner === "enemy" ? this.enemy.ageId : this.player.ageId,
      this.getTowerResearchState(tower.owner),
    );
    const expectedDefense = getDefenseTowerDefense(
      tower.owner === "enemy" ? this.enemy.ageId : this.player.ageId,
      this.getTowerResearchState(tower.owner),
    );
    if (tower.maxHp !== expectedMaxHp && tower.maxHp > 0) {
      tower.hp = Math.max(1, tower.hp * (expectedMaxHp / tower.maxHp));
      tower.maxHp = expectedMaxHp;
    }
    tower.defense = expectedDefense;
    tower.attackTimerSec -= deltaSec;
    if (tower.attackTimerSec > 0) return;
    const spec = createTowerAttackPattern(
      tower.owner === "player" ? this.player.ageId : this.enemy.ageId,
      this.getTowerResearchState(tower.owner),
    );
    const target = this.units
      .filter((unit) => unit.team !== tower.owner && unit.laneId === tower.laneId && progressBetween(unit.progress, tower.progress) <= spec.rangeProgress)
      .sort((a, b) => a.hp - b.hp)[0];
    if (!target) return;
    tower.attackTimerSec = spec.cooldownSec;
    const start = this.getTowerProjectileAnchor(tower, true);
    this.playWorldSfx(
      "sfx.combat.towerAttack",
      start.x,
      start.y,
      `tower-attack:${tower.id}:${target.id}:${Math.round(this.elapsedSec * 1000)}`,
    );
    Array.from({ length: spec.projectileCount }, (_, index) => {
      const centeredIndex = index - (spec.projectileCount - 1) / 2;
      const offset = centeredIndex * spec.spreadWorldPx * 2;
      const launch = start.clone().add(new Phaser.Math.Vector2(
        centeredIndex * spec.spreadWorldPx,
        -centeredIndex * 4,
      ));
      const aim = this.getUnitProjectileAnchor(target).add(new Phaser.Math.Vector2(offset, index * 3));
      this.launchProjectile(
        launch,
        aim,
        spec.projectileKey,
        () => this.applyDamageToUnit(
          target,
          spec.perProjectileDamage,
          tower.owner === "player" ? "#8fd2ff" : "#ffb4b4",
          "요새",
        ),
        1,
      );
    });
  }

  private tickTowerRuinControl(tower: DefenseTowerState, deltaSec: number): void {
    const nearbyPlayer = this.units.filter((unit) => unit.team === "player" && unit.laneId === tower.laneId && progressBetween(unit.progress, tower.progress) <= TOWER_CAPTURE_RADIUS_PROGRESS).length;
    const nearbyEnemy = this.units.filter((unit) => unit.team === "enemy" && unit.laneId === tower.laneId && progressBetween(unit.progress, tower.progress) <= TOWER_CAPTURE_RADIUS_PROGRESS).length;
    const pressure = Phaser.Math.Clamp((nearbyPlayer - nearbyEnemy) * TOWER_CAPTURE_RATE_PER_SEC * deltaSec, -0.8, 0.8);
    if (pressure !== 0) tower.control = Phaser.Math.Clamp(tower.control + pressure, -1, 1);
    if (nearbyPlayer > 0 && nearbyEnemy > 0 && Math.abs(tower.control) < 0.92) {
      tower.owner = "neutral";
      return;
    }
    if (tower.control >= 1) tower.owner = "player";
    else if (tower.control <= -1) tower.owner = "enemy";
    else if (Math.abs(tower.control) < 0.08) tower.owner = "neutral";
  }

  private tickSupplyDepot(point: CapturePointState, deltaSec: number): void {
    point.manaCurrent = Math.min(point.manaMax, point.manaCurrent + point.manaRegenPerSec * deltaSec);
    point.supplyTimerSec -= deltaSec;
    if (point.owner === "neutral" || point.supplyTimerSec > 0 || point.manaCurrent <= 0) return;
    const support = this.units
      .filter((unit) =>
        unit.team === point.owner
        && unit.role === "support"
        && progressBetween(unit.progress, point.progress) <= CAPTURE_RADIUS_PROGRESS,
      )
      .sort((a, b) => a.manaCurrent / Math.max(1, a.manaMax) - b.manaCurrent / Math.max(1, b.manaMax))[0];
    if (!support || support.manaCurrent >= support.manaMax) return;
    point.supplyTimerSec = 1.5;
    point.manaCurrent = Math.max(0, point.manaCurrent - SUPPLY_DEPOT_SUPPORT_MANA_RESTORE);
    support.manaCurrent = Math.min(support.manaMax, support.manaCurrent + SUPPLY_DEPOT_SUPPORT_MANA_RESTORE + point.buildingLevel * 2);
    this.spawnToast("병참", support.sprite.x, support.sprite.y - 28, "#92b8ff");
  }

  private tickMint(point: CapturePointState, deltaSec: number): void {
    point.supplyTimerSec -= deltaSec;
    if (point.owner === "neutral" || point.supplyTimerSec > 0) return;
    const ally = this.units
      .filter((unit) => unit.team === point.owner && progressBetween(unit.progress, point.progress) <= CAPTURE_RADIUS_PROGRESS)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!ally) return;
    point.supplyTimerSec = 1.5;
    ally.hp = Math.min(ally.maxHp, ally.hp + 4 + point.buildingLevel * 2);
    ally.attrition = Math.max(0, ally.attrition - (0.05 + point.buildingLevel * 0.02));
    this.spawnToast("조달", ally.sprite.x, ally.sprite.y - 28, "#92f1a5");
  }

  private tickCapturePointTower(point: CapturePointState, deltaSec: number): void {
    if (point.owner === "neutral") return;
    point.attackTimerSec -= deltaSec;
    if (point.attackTimerSec > 0) return;
    const ageId = point.owner === "player" ? this.player.ageId : this.enemy.ageId;
    const spec = createTowerAttackPattern(ageId);
    const target = this.units
      .filter((unit) => unit.team !== point.owner && unit.laneId === point.laneId && progressBetween(unit.progress, point.progress) <= spec.rangeProgress)
      .sort((a, b) => a.hp - b.hp)[0];
    if (!target) return;
    point.attackTimerSec = spec.cooldownSec;
    const start = this.getCapturePointProjectileAnchor(point, true);
    this.playWorldSfx(
      "sfx.combat.towerAttack",
      start.x,
      start.y,
      `capture-tower:${point.id}:${target.id}:${Math.round(this.elapsedSec * 1000)}`,
    );
    Array.from({ length: spec.projectileCount }, (_, index) => {
      const centeredIndex = index - (spec.projectileCount - 1) / 2;
      const offset = centeredIndex * spec.spreadWorldPx * 2;
      const launch = start.clone().add(new Phaser.Math.Vector2(centeredIndex * spec.spreadWorldPx, -centeredIndex * 4));
      const aim = this.getUnitProjectileAnchor(target).add(new Phaser.Math.Vector2(offset, index * 3));
      this.launchProjectile(
        launch,
        aim,
        spec.projectileKey,
        () => this.applyDamageToUnit(
          target,
          spec.perProjectileDamage,
          point.owner === "player" ? "#8fd2ff" : "#ffb4b4",
          "타워",
        ),
        1,
      );
    });
  }

  private selectCapturePoint(id: number): void {
    this.selectedCapturePointId = id;
    this.selectedDefenseTowerId = null;
    this.selectedMainBaseTeam = null;
    this.audio.playSfx("sfx.ui.buildSelect", { eventKey: `capture:select:${id}` });
    this.refreshCapturePointVisuals();
    this.baseResearchPanel.setVisible(false);
    this.refreshUi();
  }

  private selectDefenseTower(id: number): void {
    this.selectedDefenseTowerId = id;
    this.selectedCapturePointId = null;
    this.selectedMainBaseTeam = null;
    this.audio.playSfx("sfx.ui.buildSelect", { eventKey: `tower:select:${id}` });
    this.refreshCapturePointVisuals();
    this.refreshDefenseTowerVisuals();
    this.baseResearchPanel.setVisible(false);
    this.refreshUi();
  }

  private selectMainBase(team: TeamId): void {
    this.selectedMainBaseTeam = team;
    this.selectedCapturePointId = null;
    this.selectedDefenseTowerId = null;
    this.refreshCapturePointVisuals();
    this.refreshDefenseTowerVisuals();
    if (team === "player") {
      this.audio.playSfx("sfx.ui.buildSelect", { eventKey: "base:select:player" });
    }
    this.refreshUi();
  }

  private closeMainBasePanel(): void {
    this.cancelPlayerResearchDraft();
    this.selectedMainBaseTeam = null;
    this.baseResearchPanel.setVisible(false);
    this.refreshUi();
  }

  private browsePlayerProductionAge(delta: 1 | -1): void {
    const browsable = getBrowsableAgeIds(this.player.ageId);
    const currentIndex = browsable.indexOf(this.player.selectedProductionAgeId);
    const nextAgeId = browsable[Phaser.Math.Clamp(currentIndex + delta, 0, browsable.length - 1)];
    if (!nextAgeId || nextAgeId === this.player.selectedProductionAgeId) return;
    this.player.selectedProductionAgeId = nextAgeId;
    this.audio.playSfx("sfx.ui.hover", { eventKey: `base:browse:${nextAgeId}` });
    this.refreshUi();
  }

  private adjustPlayerResearchDraft(unitId: ResearchSubjectId, stat: ResearchStatKey, delta: 1 | -1): void {
    adjustDraftResearchLevel(this.playerResearchState, this.player.selectedProductionAgeId, unitId, stat, delta);
    this.audio.playSfx(delta > 0 ? "sfx.ui.confirm" : "sfx.ui.hover", {
      eventKey: `base:research:${this.player.selectedProductionAgeId}:${unitId}:${stat}:${delta}`,
    });
    this.refreshUi();
  }

  private applyPlayerResearchDraft(): void {
    const draftCost = getDraftResearchApplyCost(this.playerResearchState, this.player.selectedProductionAgeId);
    if (draftCost <= 0) {
      this.hud.setInfo("연구 포인트가 부족하거나 적용할 변경이 없습니다");
      this.audio.playSfx("sfx.ui.hireFail", { eventKey: "base:research:apply:fail" });
      return;
    }
    if (this.devModeEnabled) {
      const originalResearch = this.player.resources.research;
      if (originalResearch < draftCost) this.player.resources.research = draftCost;
      const applied = applyResearchDraft(this.player.resources, this.playerResearchState, this.player.selectedProductionAgeId);
      this.player.resources.research = originalResearch;
      if (!applied) {
        this.hud.setInfo("DEV 연구 적용에 실패했습니다");
        this.audio.playSfx("sfx.ui.hireFail", { eventKey: "base:research:apply:dev-fail" });
        return;
      }
    } else if (!applyResearchDraft(this.player.resources, this.playerResearchState, this.player.selectedProductionAgeId)) {
      this.hud.setInfo("연구 포인트가 부족하거나 적용할 변경이 없습니다");
      this.audio.playSfx("sfx.ui.hireFail", { eventKey: "base:research:apply:fail" });
      return;
    }
    this.hud.setInfo(`${getAge(this.player.selectedProductionAgeId).label} 병력 연구를 적용했습니다`);
    this.audio.playSfx("sfx.ui.confirm", { eventKey: `base:research:apply:${this.player.selectedProductionAgeId}` });
    this.refreshUi();
  }

  private cancelPlayerResearchDraft(): void {
    getBrowsableAgeIds(this.player.ageId).forEach((ageId) => {
      discardResearchDraftForAge(this.playerResearchState, ageId);
    });
    this.audio.playSfx("sfx.ui.cancel", { eventKey: "base:research:cancel" });
    this.refreshUi();
  }

  private tryBuildAtSelectedPoint(buildingId: BuildingId): void {
    const point = this.capturePoints.find((entry) => entry.id === this.selectedCapturePointId);
    if (!point) {
      this.hud.setInfo("먼저 거점을 선택하십시오");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: "build:no-point" });
      return;
    }
    if (point.owner !== "player") {
      this.hud.setInfo("아군 점령 거점에서만 건설 가능합니다");
      this.audio.playSfx("sfx.ui.hireFail", { eventKey: `build:${point.id}:not-owned` });
      return;
    }
    if (!point.definition.allowedBuildingTypes.includes(buildingId)) {
      this.hud.setInfo("이 거점에는 해당 건물을 건설할 수 없습니다");
      this.audio.playSfx("sfx.ui.hireFail", { eventKey: `build:${point.id}:not-allowed:${buildingId}` });
      return;
    }
    const building = getBuildingDefinition(buildingId);
    if (point.buildingId) {
      this.hud.setInfo("이미 건설된 거점입니다");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: `build:${point.id}:occupied` });
      return;
    }
    const cost = getBuildingCost(buildingId, this.player.ageId);
    if (!canAfford(this.player.resources, cost)) {
      this.hud.setInfo(`${building.label} 건설 자원 부족`);
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: `build:${point.id}:shortage:${buildingId}` });
      return;
    }
    payCost(this.player.resources, cost);
    point.buildingId = buildingId;
    point.buildingLevel = 1;
    this.initializeCaptureBuildingState(point);
    this.hud.setInfo(`${building.label} 건설 완료`);
    this.audio.playSfx("sfx.construction.start", { eventKey: `build:${point.id}:start:${buildingId}` });
    this.time.delayedCall(180, () => {
      this.audio.playSfx("sfx.construction.complete", { eventKey: `build:${point.id}:complete:${buildingId}` });
    });
    this.refreshCapturePointVisuals();
  }

  private enemyAutoBuildCapturePoint(): void {
    const target = this.capturePoints.find((point) =>
      point.owner === "enemy"
      && point.definition.pointType === "buildable"
      && !point.buildingId,
    );
    if (!target) return;
    const choices = BUILDING_DEFINITIONS.filter((entry): entry is BuildingDefinition =>
      target.definition.allowedBuildingTypes.includes(entry.id),
    );
    if (choices.length === 0) return;
    const choice = choices[target.id % choices.length];
    const cost = getBuildingCost(choice.id, this.enemy.ageId);
    if (!canAfford(this.enemy.resources, cost)) return;
    payCost(this.enemy.resources, cost);
    target.buildingId = choice.id;
    target.buildingLevel = 1;
    this.initializeCaptureBuildingState(target);
  }

  private enemyAutoRebuildDefenseTower(): void {
    const tower = this.defenseTowers.find((entry) =>
      entry.owner === "enemy" && !entry.built && entry.buildRemainingSec <= 0,
    );
    if (!tower) return;
    const cost = getDefenseTowerBuildCost(this.enemy.ageId);
    if (!canAfford(this.enemy.resources, cost)) return;
    payCost(this.enemy.resources, cost);
    tower.buildRemainingSec = DEFENSE_TOWER_BUILD_DURATION_SEC;
  }

  private tryDismantleSelectedPoint(): void {
    const point = this.capturePoints.find((entry) => entry.id === this.selectedCapturePointId);
    if (!point || point.owner !== "player" || !point.definition.canDemolish || !point.buildingId) {
      this.hud.setInfo("폐기할 아군 거점 건물이 없습니다");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: "dismantle:invalid" });
      return;
    }
    if (this.player.resources.gold < DISMANTLE_COST_GOLD) {
      this.hud.setInfo("폐기 비용이 부족합니다");
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: `dismantle:${point.id}:shortage` });
      return;
    }
    this.player.resources.gold -= DISMANTLE_COST_GOLD;
    point.buildingId = undefined;
    point.buildingLevel = 0;
    this.resetCaptureBuildingState(point);
    this.hud.setInfo(`거점 건물을 폐기했습니다 (-${DISMANTLE_COST_GOLD}G)`);
    this.audio.playSfx("sfx.ui.confirm", { eventKey: `dismantle:${point.id}:complete` });
    this.refreshCapturePointVisuals();
  }

  private tryRebuildSelectedDefenseTower(): void {
    const tower = this.defenseTowers.find((entry) => entry.id === this.selectedDefenseTowerId);
    if (!tower || tower.owner !== "player") {
      this.hud.setInfo("재건할 아군 타워를 선택하십시오");
      this.audio.playSfx("sfx.ui.hireFail", { eventKey: "tower:rebuild:invalid" });
      return;
    }
    if (tower.buildRemainingSec > 0) {
      this.hud.setInfo(`타워 재건 중 (${Math.ceil(tower.buildRemainingSec)}초)`);
      this.audio.playSfx("sfx.ui.cancel", { eventKey: `tower:${tower.id}:busy` });
      return;
    }
    if (tower.built) {
      this.hud.setInfo("선택한 타워가 이미 가동 중입니다");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: `tower:${tower.id}:active` });
      return;
    }
    const cost = getDefenseTowerBuildCost(this.player.ageId);
    if (!canAfford(this.player.resources, cost)) {
      this.hud.setInfo("타워 재건 자원 부족");
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: `tower:${tower.id}:shortage` });
      return;
    }
    payCost(this.player.resources, cost);
    tower.buildRemainingSec = DEFENSE_TOWER_BUILD_DURATION_SEC;
    tower.control = 1;
    this.hud.setInfo(`타워 재건을 시작했습니다 (${DEFENSE_TOWER_BUILD_DURATION_SEC}초)`);
    this.audio.playSfx("sfx.construction.start", { eventKey: `tower:${tower.id}:start` });
    this.refreshDefenseTowerVisuals();
  }

  private resolveCapturedStructure(point: CapturePointState, toOwner: TeamId): void {
    const outcome = resolveCapturedBuilding(
      point.buildingId,
      point.buildingLevel,
      Phaser.Math.RND.frac(),
      Phaser.Math.Between(1, 3),
    );
    point.buildingId = outcome.buildingId;
    point.buildingLevel = outcome.buildingLevel;
    if (!point.buildingId) this.resetCaptureBuildingState(point);
    else this.initializeCaptureBuildingState(point);
    if (outcome.result === "none") return;
    if (outcome.result === "destroyed") {
      if (toOwner === "player") this.hud.setInfo("적 거점 건물이 파괴되었습니다");
      return;
    }
    if (outcome.result === "collapsed") {
      if (toOwner === "player") this.hud.setInfo("적 건물을 접수하려 했지만 붕괴했습니다");
      return;
    }
    if (toOwner === "player") this.hud.setInfo(`적 건물을 접수했습니다 (레벨 -${outcome.levelDrop})`);
  }

  private isPrototypeV2(): boolean {
    return this.terrainMode === "prototype-v2" || this.terrainMode === "world-surface";
  }

  private getCanvasCssScale(): number {
    const bounds = this.game.canvas.getBoundingClientRect();
    return Math.max(0.01, bounds.width / CANVAS_W);
  }

  private cssPxToWorld(cssPx: number): number {
    return cssPx / Math.max(0.01, this.getCanvasCssScale() * this.cameras.main.zoom);
  }

  private snapWorldPointToCanvasPixel(x: number, y: number): Phaser.Math.Vector2 {
    const camera = this.cameras.main;
    const screenX = (x - camera.scrollX) * camera.zoom;
    const screenY = (y - camera.scrollY) * camera.zoom;
    return new Phaser.Math.Vector2(
      Math.round(screenX) / camera.zoom + camera.scrollX,
      Math.round(screenY) / camera.zoom + camera.scrollY,
    );
  }

  private styleV2WorldText(
    text: Phaser.GameObjects.Text,
    targetCssPx: number,
    withBackground: boolean,
  ): void {
    const fontWorldPx = Math.max(12, Math.round(this.cssPxToWorld(targetCssPx)));
    const strokeWorldPx = Math.max(2, Math.round(this.cssPxToWorld(1.15)));
    const textResolution = Math.max(2, Math.ceil(window.devicePixelRatio * 2));
    text
      .setFontSize(fontWorldPx)
      .setResolution(textResolution)
      .setScale(1)
      .setStroke("#071016", strokeWorldPx)
      .setShadow(0, Math.max(1, Math.round(strokeWorldPx * 0.55)), "#000000", 0, true, true)
      .setBackgroundColor(
        withBackground
          ? `rgba(7, 16, 24, ${this.prototypeVisualConfig.worldUi.labelBackgroundAlpha})`
          : "rgba(0, 0, 0, 0)",
      )
      .setPadding(withBackground ? 3 : 0, withBackground ? 1 : 0, withBackground ? 3 : 0, withBackground ? 1 : 0);
  }

  private refreshCapturePointVisuals(): void {
    this.capturePoints.forEach((point) => {
      const selected = this.selectedCapturePointId === point.id;
      const ownerColor = point.owner === "player" ? 0x61c3ff : point.owner === "enemy" ? 0xff7f7f : 0xf3cc6a;
      const rawPos = this.progressToScreen(point.progress, 0, point.laneId);
      const pos = this.isPrototypeV2()
        ? this.snapWorldPointToCanvasPixel(rawPos.x, rawPos.y)
        : rawPos;
      const structuredPoint = this.isPrototypeV2();
      point.ring.setFillStyle(ownerColor, selected ? 0.32 : 0.18);
      point.ring.setRadius(structuredPoint ? (selected ? 48 : 42) : selected ? 40 : 34);
      point.ring.setStrokeStyle(selected ? 5 : 4, selected ? 0xffffff : ownerColor, selected ? 0.9 : 0.5);
      point.ring
        .setPosition(pos.x, pos.y)
        .setDepth(this.getGroundDepth(pos.y, -6))
        .setVisible(!structuredPoint || selected);
      point.core.setFillStyle(ownerColor, 0.78);
      point.core.setRadius(selected ? 17 : 14);
      point.core
        .setPosition(pos.x, pos.y)
        .setDepth(this.getGroundDepth(pos.y, -5))
        .setVisible(!structuredPoint || selected);
      const showingTower = point.buildingId === "defense_tower";
      const markerHeight = showingTower
        ? this.cssPxToWorld(this.scaleVisualConfig.captureTowerCssHeight / getDefenseTowerVisibleHeightRatio("full"))
        : this.cssPxToWorld(96 / CAPTURE_MARKER_VISIBLE_HEIGHT_RATIO);
      point.marker
        .setTexture(showingTower ? getDefenseTowerTexture("full", point.owner === "enemy" ? "enemy" : "player") : getCaptureMarkerTexture(point.owner))
        .setPosition(pos.x, pos.y + STRUCTURE_SOCKET_ATTACH_Y)
        .setOrigin(STRUCTURE_GROUND_ORIGIN.x, STRUCTURE_GROUND_ORIGIN.y)
        .setDisplaySize(markerHeight, markerHeight)
        .setDepth(this.getGroundDepth(pos.y))
        .setVisible(this.terrainMode === "world-surface");
      point.ownerText.setText(point.owner === "player" ? "아군 점령" : point.owner === "enemy" ? "적 점령" : "중립");
      point.ownerText.setColor(point.owner === "player" ? "#cfeeff" : point.owner === "enemy" ? "#ffd8d8" : "#eadfb3");
      const labelY = pos.y - (
        this.terrainMode === "world-surface"
          ? this.cssPxToWorld(114)
          : this.isPrototypeV2() ? this.cssPxToWorld(36) : 40
      );
      const ownerY = pos.y + (this.isPrototypeV2() ? this.cssPxToWorld(18) : 28);
      const buildingY = pos.y + (this.isPrototypeV2() ? this.cssPxToWorld(36) : 46);
      point.label
        .setText(`건설 거점 ${point.id + 1}`)
        .setPosition(pos.x, labelY)
        .setDepth(this.getGroundDepth(pos.y, 7))
        .setVisible(selected);
      point.ownerText
        .setPosition(pos.x, ownerY)
        .setDepth(this.getGroundDepth(pos.y, 7))
        .setVisible(selected);
      point.buildingText
        .setPosition(pos.x, buildingY)
        .setDepth(this.getGroundDepth(pos.y, 7))
        .setVisible(selected);
      point.buildingText.setText(
        point.buildingId
          ? `${getBuildingDefinition(point.buildingId).shortLabel} Lv.${point.buildingLevel}`
          : "빈 건설 거점",
      );
      if (this.isPrototypeV2()) {
        this.styleV2WorldText(point.label, this.scaleVisualConfig.towerFontCssPx, true);
        this.styleV2WorldText(point.ownerText, this.scaleVisualConfig.auxiliaryFontCssPx, true);
        this.styleV2WorldText(point.buildingText, this.scaleVisualConfig.auxiliaryFontCssPx, true);
      } else {
        point.label
          .setScale(1)
          .setStroke("#1a130a", 3)
          .setShadow(0, 0, "#000000", 0, false, false)
          .setBackgroundColor("rgba(0, 0, 0, 0)")
          .setPadding(0);
        point.ownerText
          .setScale(1)
          .setStroke("#1a130a", 3)
          .setShadow(0, 0, "#000000", 0, false, false)
          .setBackgroundColor("rgba(0, 0, 0, 0)")
          .setPadding(0);
        point.buildingText
          .setScale(1)
          .setStroke("#132033", 3)
          .setShadow(0, 0, "#000000", 0, false, false)
          .setBackgroundColor("rgba(0, 0, 0, 0)")
          .setPadding(0);
      }
    });
  }

  private refreshDefenseTowerVisuals(): void {
    this.defenseTowers.forEach((tower) => {
      const selected = this.selectedDefenseTowerId === tower.id;
      const ownerColor = tower.owner === "player" ? 0x61c3ff : tower.owner === "enemy" ? 0xff7f7f : 0xf3cc6a;
      const rawPos = this.progressToScreen(tower.progress, 0, tower.laneId);
      const pos = this.isPrototypeV2() ? this.snapWorldPointToCanvasPixel(rawPos.x, rawPos.y) : rawPos;
      const selectedScale = this.isPrototypeV2() ? 1 : selected ? 1.04 : 1;
      const visualState = this.getDefenseTowerVisualState(tower);
      const visibleHeightRatio = getDefenseTowerVisibleHeightRatio(visualState);
      const towerHeight = this.isPrototypeV2()
        ? this.cssPxToWorld(this.scaleVisualConfig.captureTowerCssHeight / visibleHeightRatio) * selectedScale
        : TOWER_H * selectedScale;
      const towerWidth = this.isPrototypeV2()
        ? towerHeight * (tower.sprite.frame.realWidth / tower.sprite.frame.realHeight)
        : TOWER_W * selectedScale;
      const hpRatio = tower.maxHp > 0 ? tower.hp / tower.maxHp : 0;
      const texture = getDefenseTowerTexture(visualState, tower.owner === "enemy" ? "enemy" : "player");
      tower.sprite
        .setTexture(texture)
        .setPosition(pos.x, pos.y + STRUCTURE_SOCKET_ATTACH_Y)
        .setOrigin(STRUCTURE_GROUND_ORIGIN.x, STRUCTURE_GROUND_ORIGIN.y)
        .setDisplaySize(towerWidth, towerHeight)
        .setDepth(this.getGroundDepth(pos.y))
        .setAlpha(1)
        .clearTint();
      const towerTop = pos.y - towerHeight * tower.sprite.originY;
      const hpWidth = this.isPrototypeV2() ? this.cssPxToWorld(this.scaleVisualConfig.towerHpWidthCssPx) : 60;
      const hpHeight = this.isPrototypeV2() ? this.cssPxToWorld(this.scaleVisualConfig.towerHpHeightCssPx) : 7;
      const hpY = this.isPrototypeV2() ? towerTop - this.cssPxToWorld(8) : pos.y - 158;
      tower.hpBg.setPosition(pos.x, hpY).setSize(hpWidth, hpHeight).setDepth(this.getGroundDepth(pos.y, 5)).setVisible(tower.built);
      tower.hpFill
        .setPosition(pos.x - hpWidth / 2, hpY)
        .setSize(hpWidth * Phaser.Math.Clamp(hpRatio, 0, 1), hpHeight)
        .setFillStyle(ownerColor, 1)
        .setDepth(this.getGroundDepth(pos.y, 6))
        .setVisible(tower.built);
      tower.selectionHitZone
        .setPosition(pos.x, pos.y)
        .setOrigin(0.5, tower.sprite.originY)
        .setSize(Math.max(towerWidth, this.cssPxToWorld(96)), Math.max(towerHeight, this.cssPxToWorld(120)))
        .setDepth(this.getGroundDepth(pos.y, -1));
      tower.label.setPosition(pos.x, this.isPrototypeV2() ? towerTop - this.cssPxToWorld(30) : pos.y - 190);
      tower.label.setText(`방어 타워 ${tower.id + 1}${selected ? " · 선택" : ""}`);
      tower.ownerText.setPosition(pos.x, pos.y + (this.isPrototypeV2() ? this.cssPxToWorld(18) : 34));
      tower.statusText
        .setPosition(pos.x, pos.y + (this.isPrototypeV2() ? this.cssPxToWorld(36) : 52))
        .setText(tower.buildRemainingSec > 0 ? `재건 ${Math.ceil(tower.buildRemainingSec)}초` : tower.built ? "가동 중" : tower.owner === "neutral" ? "중립 폐허" : "재건 가능");
      tower.label.setVisible(selected);
      tower.ownerText
        .setText(tower.owner === "player" ? "아군 타워" : tower.owner === "enemy" ? "적 타워" : "중립 타워 거점")
        .setVisible(selected);
      tower.statusText.setVisible(selected);
      tower.groundPresentation?.shadow.setVisible(this.terrainMode === "prototype" && tower.built);
      tower.groundPresentationV2?.shadow.setVisible(this.terrainMode === "prototype-v2" && tower.built);
      tower.groundPresentationWorld?.shadow.setVisible(this.terrainMode === "world-surface" && tower.built);
      if (this.isPrototypeV2()) {
        this.styleV2WorldText(tower.label, this.scaleVisualConfig.towerFontCssPx, true);
        this.styleV2WorldText(tower.ownerText, this.scaleVisualConfig.auxiliaryFontCssPx, true);
        this.styleV2WorldText(tower.statusText, this.scaleVisualConfig.auxiliaryFontCssPx, true);
      }
    });
  }

  private getDefenseTowerVisualState(tower: DefenseTowerState): DefenseTowerVisualState {
    if (tower.buildRemainingSec > 0) return "construction";
    if (!tower.built) return "ruins";
    const hpRatio = tower.maxHp > 0 ? tower.hp / tower.maxHp : 0;
    return hpRatio > 0.66 ? "full" : hpRatio > 0.33 ? "damaged" : "critical";
  }

  private getAttackBuffMultiplier(unit: LaneUnit): number {
    return this.capturePoints.some((point) =>
      point.owner === unit.team
      && point.buildingId === "supply_depot"
      && point.laneId === unit.laneId
      && progressBetween(point.progress, unit.progress) <= CAPTURE_RADIUS_PROGRESS,
    )
      ? SUPPLY_DEPOT_ATTACK_BUFF_MULTIPLIER
      : 1;
  }

  private initializeCaptureBuildingState(point: CapturePointState): void {
    point.attackTimerSec = 0.25;
    point.incomeTimerSec = 4;
    point.supplyTimerSec = 0.4;
    if (point.buildingId === "supply_depot") {
      const profile = getSupportResourceProfile(point.owner === "enemy" ? this.enemy.ageId : this.player.ageId);
      point.manaMax = profile.manaMax * 3;
      point.manaCurrent = point.manaMax;
      point.manaRegenPerSec = profile.manaRegenPerSec * 1.5;
      return;
    }
    point.manaCurrent = 0;
    point.manaMax = 0;
    point.manaRegenPerSec = 0;
  }

  private resetCaptureBuildingState(point: CapturePointState): void {
    point.attackTimerSec = 0;
    point.incomeTimerSec = 0;
    point.supplyTimerSec = 0;
    point.manaCurrent = 0;
    point.manaMax = 0;
    point.manaRegenPerSec = 0;
  }

  private getUnitProjectileAnchor(unit: LaneUnit): Phaser.Math.Vector2 {
    const visibleHeight = unit.sprite.displayHeight
      * (resolveUnitFramePresentation(unit.unitId, 1, 1, unit.currentTextureKey).referenceVisibleHeight
        / resolveUnitFramePresentation(unit.unitId, 1, 1, unit.currentTextureKey).spriteHeight);
    return new Phaser.Math.Vector2(
      unit.sprite.x,
      unit.sprite.y - (this.terrainPrototypeEnabled ? visibleHeight * 0.58 : 10),
    );
  }

  private getTowerProjectileAnchor(point: DefenseTowerState, launch: boolean): Phaser.Math.Vector2 {
    const visibleHeightRatio = getDefenseTowerVisibleHeightRatio(this.getDefenseTowerVisualState(point));
    return new Phaser.Math.Vector2(
      point.sprite.x,
      point.sprite.y - (
        this.terrainPrototypeEnabled
          ? point.sprite.displayHeight * visibleHeightRatio * (launch ? 0.72 : 0.48)
          : launch ? 18 : 12
      ),
    );
  }

  private getCapturePointProjectileAnchor(point: CapturePointState, launch: boolean): Phaser.Math.Vector2 {
    const visibleHeightRatio = point.buildingId === "defense_tower"
      ? getDefenseTowerVisibleHeightRatio("full")
      : CAPTURE_MARKER_VISIBLE_HEIGHT_RATIO;
    return new Phaser.Math.Vector2(
      point.marker.x,
      point.marker.y - (
        this.terrainPrototypeEnabled
          ? point.marker.displayHeight * visibleHeightRatio * (launch ? 0.72 : 0.48)
          : launch ? 18 : 12
      ),
    );
  }

  private launchProjectile(
    start: Phaser.Math.Vector2,
    end: Phaser.Math.Vector2,
    textureKey: string,
    onHit: () => void,
    durationScale = 1,
  ): void {
    const cssSize = textureKey === "projectile-arrow"
      ? { width: 26, height: 9 }
      : textureKey === "projectile-shot"
        ? { width: 14, height: 14 }
        : { width: 18, height: 18 };
    launchLaneProjectile({
      scene: this,
      start,
      end,
      textureKey,
      depth: DEPTH_UNIT + Math.max(start.y, end.y) * 0.1 + 6,
      durationScale,
      displaySize: this.isPrototypeV2()
        ? { width: this.cssPxToWorld(cssSize.width), height: this.cssPxToWorld(cssSize.height) }
        : undefined,
      onCreated: (created) => {
        this.activeProjectiles.add(created);
        this.uiCamera?.ignore(created);
      },
      onDestroyed: (destroyed) => this.activeProjectiles.delete(destroyed),
      onHit,
    });
  }

  private applyDamageToUnit(target: LaneUnit, damage: number, color: string, label?: string): void {
    if (!this.units.includes(target)) return;
    target.hp -= damage;
    this.playWorldSfx(
      "sfx.combat.projectileHit",
      target.sprite.x,
      target.sprite.y,
      `impact:projectile:${target.id}:${Math.round(this.elapsedSec * 1000)}`,
    );
    target.sprite.setTint(0xffc49b);
    this.time.delayedCall(80, () => {
      if (!target.sprite.active) return;
      target.sprite.clearTint();
    });
    const impact = this.add.circle(target.sprite.x, target.sprite.y - 2, 10 + Math.min(10, damage), 0xffffff, 0.24)
      .setDepth(target.sprite.depth - 1);
    this.uiCamera?.ignore(impact);
    this.tweens.add({
      targets: impact,
      scaleX: 1.6,
      scaleY: 1.6,
      alpha: 0,
      duration: 160,
      onComplete: () => impact.destroy(),
    });
    this.spawnToast(label ?? `${damage}`, target.sprite.x, target.sprite.y - 26, color);
    if (target.hp <= 0) this.killUnit(target);
  }

  private applyDamageToTower(point: DefenseTowerState, damage: number, attackerTeam: TeamId): void {
    if (!point.built) return;
    const mitigatedDamage = Math.max(1, Math.round(damage - point.defense));
    point.hp = Math.max(0, point.hp - mitigatedDamage);
    this.playWorldSfx(
      "sfx.combat.towerHit",
      point.sprite.x,
      point.sprite.y,
      `impact:tower:${point.id}:${Math.round(this.elapsedSec * 1000)}`,
    );
    this.tweens.add({
      targets: point.sprite,
      alpha: 0.45,
      duration: 70,
      yoyo: true,
    });
    this.spawnToast(`${mitigatedDamage}`, point.sprite.x, point.sprite.y - 58, attackerTeam === "player" ? "#ffd67a" : "#ff8f8f");
    if (point.hp <= 0) {
      point.built = false;
      point.owner = "neutral";
      point.control = 0;
      point.attackTimerSec = 0;
      point.buildRemainingSec = 0;
      this.audio.playSfx("sfx.fortress.destroyed", { eventKey: `tower:${point.id}:destroyed` });
      if (attackerTeam === "player") this.hud.setInfo("적 타워를 파괴했습니다");
    }
  }

  private checkBasePressure(_deltaSec: number): void {
    const playerThreat = this.units.filter((unit) => unit.team === "enemy" && unit.progress <= 0.04);
    const enemyThreat = this.units.filter((unit) => unit.team === "player" && unit.progress >= 0.96);

    playerThreat.forEach((unit) => this.tryAttackBase(unit, this.player));
    enemyThreat.forEach((unit) => this.tryAttackBase(unit, this.enemy));

    if (this.player.baseHp <= 0) this.scene.start("gameover", { win: false, squadSize: 0, summary: "아군 본진이 붕괴했습니다." });
    if (this.enemy.baseHp <= 0) this.scene.start("gameover", { win: true, squadSize: 0, summary: "적 본진을 돌파했습니다." });
  }

  private tryAttackBase(unit: LaneUnit, targetTeam: TeamState): void {
    if (unit.attackTimerSec > 0) return;
    unit.attackTimerSec = unit.attackCooldownSec;
    const targetProgress = targetTeam.id === "player" ? 0 : 1;
    const target = this.getBaseAnchor(targetTeam.id, unit.laneId, targetProgress);
    const damage = Math.max(1, Math.round(5.8 * unit.attackCooldownSec * (1 - unit.attrition)));
    const applyDamage = () => {
      targetTeam.baseHp = Math.max(0, targetTeam.baseHp - damage);
      this.playWorldSfx(
        "sfx.combat.towerHit",
        target.x,
        target.y,
        `impact:base:${targetTeam.id}:${unit.id}:${Math.round(this.elapsedSec * 1000)}`,
      );
      this.spawnToast(`${damage}`, target.x, target.y - 88, unit.team === "player" ? "#8fd2ff" : "#ffb4b4");
    };

    if (this.isRangedUnit(unit)) {
      const start = this.getUnitProjectileAnchor(unit);
      const end = target.clone().add(new Phaser.Math.Vector2(0, -96));
      this.startRangedAttack(unit, target.x, target.y, "structure", () => {
        this.launchProjectile(start, end, getProjectileKeyForUnit(unit.unitId), applyDamage, 1.05);
      });
    } else {
      this.startMeleeAttack(unit, target.x, target.y, "structure", applyDamage);
    }
  }

  private killUnit(unit: LaneUnit): void {
    if (!this.units.includes(unit)) return;
    this.playWorldSfx(
      "sfx.combat.unitDeath",
      unit.sprite.x,
      unit.sprite.y,
      `death:${unit.id}`,
    );
    this.units = this.units.filter((entry) => entry.id !== unit.id);
    this.destroyUnitPresentation(unit);

    if (unit.team === "enemy") {
      const reward = this.rollKillResourceReward(this.enemy.ageId);
      this.applyKillResourceReward(this.player, reward, 108, 156);
    } else {
      this.applyKillResourceReward(this.enemy, this.rollKillResourceReward(this.player.ageId));
    }
  }

  private rollKillResourceReward(ageId: AgeId): { gold: number; wood: number; food: number } {
    const total = Math.round(getAgeBalance(ageId).killGoldBase);
    const reward = { gold: 1, wood: 1, food: 1 };
    for (let remaining = Math.max(0, total - 3); remaining > 0; remaining -= 1) {
      const nextKey = Phaser.Utils.Array.GetRandom(["gold", "wood", "food"] as const);
      reward[nextKey] += 1;
    }
    return reward;
  }

  private applyKillResourceReward(
    team: TeamState,
    reward: { gold: number; wood: number; food: number },
    toastX?: number,
    toastY?: number,
  ): void {
    team.resources.gold += reward.gold;
    team.resources.wood += reward.wood;
    team.resources.food += reward.food;
    if (team.id === "player" && toastX !== undefined && toastY !== undefined) {
      this.spawnToast(`+${reward.gold}G +${reward.wood}W +${reward.food}F`, toastX, toastY, "#f4d35e");
    }
  }

  private trySpawnWave(team: TeamState, forced: boolean): boolean {
    const plan = createWaveDeploymentPlan(team, PLAYER_OPPONENT_COUNT);
    if (!plan.canDeploy) {
      if (team.id === "player") this.hud.setInfo("식량 부족으로 웨이브 출전 실패");
      if (team.id === "player") this.audio.playSfx("sfx.state.resourceShortage", { eventKey: "wave:food-shortage" });
      resetWaveClock(team);
      return false;
    }

    if (forced) {
      commitForcedWaveDeployment(team, plan.foodCost);
    } else {
      commitWaveDeployment(team, plan.foodCost);
    }
    this.spawnWaveUnits(team, plan.roster);

    if (team.id === "player") this.hud.setInfo(forced ? "즉시 웨이브를 투입했습니다" : "정규 웨이브가 출전했습니다");
    if (team.id === "player") {
      this.audio.playSfx("sfx.wave.start", { eventKey: `wave:start:${Math.round(this.elapsedSec * 10)}` });
      this.audio.setDirectorState("battle-low");
      this.audioWiring.recordCombatEvent(this.elapsedSec);
    }
    return true;
  }

  private deployOpeningWave(team: TeamState): void {
    this.spawnWaveUnits(team, getWaveRoster(team.ageId), team.id === "player" ? 0.12 : 0.88);
    resetWaveClock(team);
    if (team.id === "player") {
      this.audio.playSfx("sfx.wave.start", { eventKey: "wave:opening" });
      this.audio.setDirectorState("battle-low");
      this.audioWiring.recordCombatEvent(this.elapsedSec);
    }
  }

  private setupVisualValidationScenario(): void {
    this.units.forEach((unit) => this.destroyUnitPresentation(unit));
    this.units = [];

    const buildable = this.capturePoints[0];
    buildable.owner = "player";
    buildable.control = 1;
    buildable.buildingId = undefined;
    buildable.buildingLevel = 0;

    const enemyPoint = this.capturePoints[1];
    enemyPoint.owner = "enemy";
    enemyPoint.control = -1;
    this.defenseTowers.forEach((tower) => {
      tower.built = true;
      tower.buildRemainingSec = 0;
      tower.hp = tower.maxHp;
    });

    const units: Array<[TeamId, "battle" | "support", BattleUnitId | SupportUnitId, number, number]> = [
      ["player", "battle", "stone_axeman", 0.572, -3],
      ["player", "battle", "stone_axeman", 0.574, 0],
      ["player", "battle", "stone_axeman", 0.571, 3],
      ["player", "battle", "stone_slinger", 0.545, -4],
      ["player", "battle", "stone_slinger", 0.548, 4],
      ["player", "support", "supply_wagon", 0.532, 0],
      ["enemy", "battle", "stone_axeman", 0.594, -3],
      ["enemy", "battle", "stone_axeman", 0.592, 0],
      ["enemy", "battle", "stone_axeman", 0.595, 3],
      ["enemy", "battle", "stone_slinger", 0.621, -4],
      ["enemy", "battle", "stone_slinger", 0.618, 4],
      ["enemy", "support", "supply_wagon", 0.632, 0],
    ];
    units.forEach(([team, role, unitId, progress, laneRow]) => {
      this.spawnLaneUnit(team, role, unitId, progress, laneRow, this.primaryLaneSpec.id);
    });
    this.units.forEach((unit, index) => {
      unit.attackTimerSec = index % 3 === 0 ? 0.05 : 0.28 + (index % 4) * 0.08;
    });
    this.resetValidationDirectionShowcase();
    this.selectCapturePoint(buildable.id);
    this.focusCentralCapture();
  }

  private resetValidationDirectionShowcase(): void {
    if (!this.visualValidationScenario) return;
    const offsets = [
      { progress: -0.012, row: -2.2 },
      { progress: -0.012, row: 2.2 },
      { progress: 0.012, row: -2.2 },
      { progress: 0.012, row: 2.2 },
    ];
    this.units.slice(0, 4).forEach((unit, index) => {
      unit.attackAnimTime = 0;
      unit.attackFacingLockSec = 0;
      unit.attackTimerSec = 10;
      unit.visualProgress = Phaser.Math.Clamp(unit.progress + offsets[index].progress, 0.01, 0.99);
      unit.visualLaneRow = Phaser.Math.Clamp(unit.laneRow + offsets[index].row, -5, 5);
      const visual = this.progressToScreen(unit.visualProgress, unit.visualLaneRow, unit.laneId);
      unit.lastPresentationX = visual.x;
      unit.lastPresentationY = visual.y;
    });
  }

  private destroyUnitPresentation(unit: LaneUnit): void {
    unit.sprite.destroy();
    unit.shadow.destroy();
    unit.selectionRing.destroy();
    unit.hpBg.destroy();
    unit.hpFill.destroy();
    unit.manaBg.destroy();
    unit.manaFill.destroy();
    unit.label.destroy();
  }

  private setUnitPresentationVisible(unit: LaneUnit, visible: boolean): void {
    unit.sprite.setVisible(visible);
    unit.shadow.setVisible(visible);
    unit.selectionRing.setVisible(visible && (unit.selected || unit.hovered));
    unit.hpBg.setVisible(visible);
    unit.hpFill.setVisible(visible);
    unit.manaBg.setVisible(visible && unit.role === "support");
    unit.manaFill.setVisible(visible && unit.role === "support");
    unit.label.setVisible(visible && this.shouldShowV2UnitLabel(unit));
  }

  private spawnWaveUnits(team: TeamState, roster = getWaveRoster(team.ageId), overrideSpawnProgress?: number): void {
    const productionAgeId = team.selectedProductionAgeId;
    const battleRows = [-3, 0, 3];
    const laneIds = this.mapSpec.lanes.map((lane) => lane.id);
    const spawnProgress = overrideSpawnProgress ?? (team.id === "player" ? 0.06 : 0.94);
    laneIds.forEach((laneId) => {
      let laneIndex = 0;
      roster.battleline.forEach((entry) => {
        for (let i = 0; i < entry.count; i++) {
          this.spawnLaneUnit(
            team.id,
            "battle",
            entry.unitId,
            spawnProgress,
            battleRows[laneIndex % battleRows.length],
            laneId,
            productionAgeId,
          );
          laneIndex += 1;
        }
      });
      roster.support.forEach((entry) => {
        for (let i = 0; i < entry.count; i++) {
          this.spawnLaneUnit(
            team.id,
            "support",
            entry.unitId,
            team.id === "player" ? spawnProgress - 0.02 : spawnProgress + 0.02,
            0,
            laneId,
            productionAgeId,
          );
        }
      });
    });
  }

  private spawnLaneUnit(
    team: TeamId,
    role: "battle" | "support",
    unitId: BattleUnitId | SupportUnitId,
    progress: number,
    laneRow: number,
    laneId = this.primaryLaneSpec.id,
    productionAgeId = team === "player" ? this.player.selectedProductionAgeId : this.enemy.selectedProductionAgeId,
  ): void {
    const researchState = team === "player" ? this.playerResearchState : this.enemyResearchState;
    const stats = resolveSpawnUnitStats(unitId, productionAgeId, researchState);
    const pos = this.progressToScreen(progress, laneRow, laneId);
    const displaySize = role === "support" ? 86 : 76;
    const initialFacingDirection: UnitFacingDirection = team === "player" ? "e" : "w";
    const animationPrefix = deriveAnimationPrefix(stats.textureKey);
    const initialTextureKey = resolveAnimationTextureFromPrefix(unitId, animationPrefix, false, 0, 0, initialFacingDirection)
      ?? resolveUnitAnimationTexture(unitId, false, 0, 0, initialFacingDirection)
      ?? stats.textureKey;
    const shadow = this.add.ellipse(pos.x, pos.y + 22, role === "support" ? 56 : 46, role === "support" ? 20 : 16, 0x000000, 0.2)
      .setDepth(this.getGroundDepth(pos.y, -1));
    const selectionRing = this.add.ellipse(pos.x, pos.y, 48, 18, 0x72c8ff, 0.12)
      .setStrokeStyle(3, team === "player" ? 0x8bd7ff : 0xffa0a0, 0.9)
      .setDepth(this.getGroundDepth(pos.y, -2))
      .setVisible(false);
    const sprite = this.add.image(
      pos.x,
      pos.y,
      resolveTeamUnitTextureKey(initialTextureKey, team),
    ).setDepth(this.getGroundDepth(pos.y));
    const frameAspect = sprite.frame.realHeight > 0
      ? sprite.frame.realWidth / sprite.frame.realHeight
      : 1;
    const targetVisibleWorldHeight = this.isPrototypeV2()
      ? this.cssPxToWorld(role === "support" ? this.scaleVisualConfig.supportUnitCssHeight : this.scaleVisualConfig.normalUnitCssHeight)
      : role === "support" ? 118 : 112;
    const idleFramePresentation = resolveUnitFramePresentation(
      unitId,
      targetVisibleWorldHeight,
      frameAspect,
      initialTextureKey,
    );
    sprite.setDisplaySize(idleFramePresentation.spriteWidth, idleFramePresentation.spriteHeight);
    const hpBg = this.add.rectangle(pos.x, pos.y - 44, 34, 5, 0x132033, 0.92).setDepth(sprite.depth + 1);
    const hpFill = this.add.rectangle(pos.x - 17, pos.y - 44, 34, 5, team === "player" ? 0x62d4a3 : 0xf06f6f, 1).setOrigin(0, 0.5).setDepth(sprite.depth + 2);
    const manaBg = this.add.rectangle(pos.x, pos.y - 38, 34, 4, 0x101a2b, 0.92).setDepth(sprite.depth + 1).setVisible(role === "support");
    const manaFill = this.add.rectangle(pos.x - 17, pos.y - 38, 34, 4, 0x57a8ff, 1).setOrigin(0, 0.5).setDepth(sprite.depth + 2).setVisible(role === "support");
    const label = this.add.text(pos.x, pos.y - 58, stats.label, {
      fontFamily: "sans-serif",
      fontSize: "10px",
      color: team === "player" ? "#dbf0ff" : "#ffd9d9",
      stroke: "#132033",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(sprite.depth + 3);
    this.uiCamera?.ignore([shadow, selectionRing, sprite, hpBg, hpFill, manaBg, manaFill, label]);

    const supportProfile = getSupportResourceProfile(productionAgeId);

    const unit: LaneUnit = {
      id: nextUnitId++,
      team,
      role,
      unitId,
      laneId,
      progress,
      laneRow,
      visualProgress: progress,
      visualLaneRow: laneRow,
      maxHp: stats.hp,
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      range: stats.range,
      speed: stats.speed,
      attackCooldownSec: stats.attackCooldownSec,
      attackTimerSec: stats.attackCooldownSec * Phaser.Math.FloatBetween(0.4, 0.95),
      attackAnimTime: 0,
      attackFacingLockSec: 0,
      combatFacingHoldSec: 0,
      attackTargetKind: "unit",
      attackSequence: 0,
      healPower: role === "support" ? supportProfile.healPower : stats.healPower ?? 0,
      manaCurrent: role === "support" ? supportProfile.manaMax : 0,
      manaMax: role === "support" ? supportProfile.manaMax : 0,
      manaRegenPerSec: role === "support" ? supportProfile.manaRegenPerSec : 0,
      healManaCost: role === "support" ? supportProfile.healManaCost : 0,
      attrition: 0,
      displaySize,
      bobPhase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      animationPrefix,
      currentTextureKey: initialTextureKey,
      travelFacingX: team === "player" ? 1 : -1,
      travelFacingDirection: initialFacingDirection,
      combatFacingX: team === "player" ? 1 : -1,
      combatFacingDirection: initialFacingDirection,
      lastPresentationX: pos.x,
      lastPresentationY: pos.y,
      motionX: 0,
      motionY: 0,
      walkCyclePhase: Phaser.Math.FloatBetween(0, 1),
      visualOffsetX: 0,
      visualLift: 0,
      visualRotationRad: 0,
      visualSpriteWidth: idleFramePresentation.spriteWidth,
      visualSpriteHeight: idleFramePresentation.spriteHeight,
      sprite,
      shadow,
      selectionRing,
      hpBg,
      hpFill,
      manaBg,
      manaFill,
      label,
      hovered: false,
      selected: false,
    };
    sprite
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        unit.hovered = true;
        this.syncUnitPresentation(unit);
        this.refreshUnitOverlayDensity();
      })
      .on("pointerout", () => {
        unit.hovered = false;
        this.syncUnitPresentation(unit);
        this.refreshUnitOverlayDensity();
      })
      .on("pointerdown", () => {
        this.units.forEach((entry) => {
          entry.selected = entry.id === unit.id ? !entry.selected : false;
          this.syncUnitPresentation(entry);
        });
        this.refreshUnitOverlayDensity();
      });
    this.units.push(unit);
    this.syncUnitPresentation(unit);
  }

  private playImpactFeedback(attacker: LaneUnit, target: LaneUnit, damage: number): void {
    target.sprite.setTint(0xffc49b);
    this.time.delayedCall(80, () => {
      if (!target.sprite.active) return;
      target.sprite.clearTint();
    });

    const impact = this.add.circle(target.sprite.x, target.sprite.y - 2, 10 + Math.min(10, damage), attacker.team === "player" ? 0xffd36a : 0xff8b8b, 0.28)
      .setDepth(target.sprite.depth - 1);
    this.uiCamera?.ignore(impact);
    this.tweens.add({
      targets: impact,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: 180,
      onComplete: () => impact.destroy(),
    });

    const view = this.cameras.main.worldView;
    if (view.contains(target.sprite.x, target.sprite.y)) {
      this.cameras.main.shake(40, Math.min(0.0028, 0.0004 + damage * 0.00008));
    }
  }

  private syncUnitVisual(unit: LaneUnit, deltaSec: number): void {
    const progressCatchup = 1 - Math.exp(-18 * deltaSec);
    const rowCatchup = 1 - Math.exp(-14 * deltaSec);
    const progressDelta = progressBetween(unit.progress, unit.visualProgress);
    const rowDelta = Math.abs(unit.laneRow - unit.visualLaneRow);
    if (progressDelta > 0.00006 || rowDelta > 0.015) {
      unit.walkCyclePhase = (unit.walkCyclePhase + deltaSec * (1.7 + unit.speed * 0.55)) % 1;
    }
    unit.visualProgress = Phaser.Math.Linear(unit.visualProgress, unit.progress, progressCatchup);
    unit.visualLaneRow = Phaser.Math.Linear(unit.visualLaneRow, unit.laneRow, rowCatchup);
    this.syncUnitPresentation(unit);
  }

  private shouldShowV2UnitLabel(unit: LaneUnit): boolean {
    return unit.selected || unit.hovered;
  }

  private refreshUnitOverlayDensity(): void {
    const visibleUnits = this.units.filter((unit) => unit.sprite.visible);
    const canvasScale = this.getCanvasCssScale();
    const decisions = this.unitOverlayDensityEnabled
      ? resolveUnitOverlayDensity(visibleUnits.map((unit) => ({
        id: unit.id,
        team: unit.team,
        screenX: unit.sprite.x * this.cameras.main.zoom * canvasScale,
        screenY: unit.sprite.y * this.cameras.main.zoom * canvasScale,
        hp: unit.hp,
        maxHp: unit.maxHp,
        priority: unit.selected || unit.hovered,
      })))
      : new Map();
    this.unitOverlayModes.clear();

    visibleUnits.forEach((unit) => {
      const decision = decisions.get(unit.id);
      const mode: UnitOverlayMode = decision?.mode ?? "detail";
      this.unitOverlayModes.set(unit.id, mode);
      const aggregateRatio = decision?.hpRatio ?? (unit.maxHp > 0 ? unit.hp / unit.maxHp : 0);
      const summary = mode === "summary";
      const hidden = mode === "hidden";
      const baseWidth = this.isPrototypeV2()
        ? this.cssPxToWorld(this.scaleVisualConfig.unitHpWidthCssPx)
        : 34;
      const width = summary ? baseWidth * 1.35 : baseWidth;
      const hpVisible = !hidden;

      unit.hpBg
        .setVisible(hpVisible)
        .setAlpha(mode === "compact" ? 0.7 : 0.94)
        .setSize(width, unit.hpBg.height);
      unit.hpFill
        .setVisible(hpVisible)
        .setAlpha(mode === "compact" ? 0.82 : 1)
        .setPosition(unit.hpBg.x - width / 2, unit.hpFill.y)
        .setSize(width * Math.max(0, aggregateRatio), unit.hpFill.height);

      const showResource = unit.role === "support" && !hidden && !summary;
      unit.manaBg.setVisible(showResource);
      unit.manaFill.setVisible(showResource);

      if (summary) {
        unit.label.setVisible(false);
      } else {
        unit.label
          .setText(this.isPrototypeV2() ? `${UNIT_STATS[unit.unitId].label} Lv.1` : UNIT_STATS[unit.unitId].label)
          .setVisible(!hidden && this.shouldShowV2UnitLabel(unit));
      }
    });
  }

  private syncUnitPresentation(unit: LaneUnit): void {
    const rawPos = this.progressToScreen(unit.visualProgress, unit.visualLaneRow, unit.laneId);
    const pos = rawPos;
    const moving = progressBetween(unit.progress, unit.visualProgress) > 0.00012 || Math.abs(unit.motionX) > 0.22;
    const usingCombatFacing = unit.attackFacingLockSec > 0 || unit.combatFacingHoldSec > 0;
    const locomotionFacingX = unit.travelFacingX;
    const locomotionFacingDirection = unit.travelFacingDirection;
    const presentationFacingX = usingCombatFacing ? unit.combatFacingX : locomotionFacingX;
    const presentationFacingDirection: UnitFacingDirection = unit.role === "support"
      ? (locomotionFacingX >= 0 ? "e" : "w")
      : (usingCombatFacing ? unit.combatFacingDirection : locomotionFacingDirection);
    const attackDurationSec = this.getUnitAttackTiming(unit, unit.attackTargetKind).durationSec;
    const attackProgress = unit.attackAnimTime > 0
      ? 1 - unit.attackAnimTime / attackDurationSec
      : 0;
    const walkCycleProgress = unit.walkCyclePhase;
    const gait = walkCycleProgress * Math.PI * 2 + unit.bobPhase;
    const desiredTexture = unit.presentationOverrideTexture ?? resolveAnimationTextureFromPrefix(
      unit.unitId,
      unit.animationPrefix,
      moving,
      walkCycleProgress,
      attackProgress,
      presentationFacingDirection,
    ) ?? resolveUnitAnimationTexture(
      unit.unitId,
      moving,
      walkCycleProgress,
      attackProgress,
      presentationFacingDirection,
    ) ?? UNIT_STATS[unit.unitId].textureKey;
    if (desiredTexture !== unit.currentTextureKey) {
      unit.currentTextureKey = desiredTexture;
      unit.sprite.setTexture(resolveTeamUnitTextureKey(desiredTexture, unit.team));
    }
    unit.motionX = pos.x - unit.lastPresentationX;
    unit.motionY = pos.y - unit.lastPresentationY;
    unit.lastPresentationX = pos.x;
    unit.lastPresentationY = pos.y;

    const mechanized = isMechanizedUnit(unit.unitId);
    const rawWalkMotion = moving && !mechanized
      ? resolveWalkMotion(walkCycleProgress, locomotionFacingX)
      : { swayX: 0, lift: 0, rotationRad: 0 };
    const walkMotion = unit.role === "support"
      ? { ...rawWalkMotion, rotationRad: 0 }
      : rawWalkMotion;
    const bob = mechanized
      ? 0
      : moving ? Math.sin(gait) * 0.72 + walkMotion.lift : Math.sin(this.elapsedSec * 4 + unit.bobPhase) * 0.35;
    const targetAttackMotion = mechanized ? { offsetX: 0, lift: 0, rotationRad: 0 } : resolveAttackMotion({
      role: unit.role,
      melee: this.isMeleeUnit(unit),
      ranged: this.isRangedUnit(unit),
      targetKind: unit.attackTargetKind,
      progress: attackProgress,
      facing: presentationFacingX,
    });
    const legacyScale = unit.role === "support" ? 1.08 : 1;
    const frameAspect = unit.sprite.frame.realHeight > 0
      ? unit.sprite.frame.realWidth / unit.sprite.frame.realHeight
      : 1;
    const targetVisibleCssHeight = unit.role === "support"
      ? this.scaleVisualConfig.supportUnitCssHeight
      : this.scaleVisualConfig.normalUnitCssHeight;
    const targetVisibleWorldHeight = this.isPrototypeV2()
      ? this.cssPxToWorld(targetVisibleCssHeight)
      : unit.role === "support" ? 118 : 112;
    const idleTextureKey = resolveAnimationTextureFromPrefix(
      unit.unitId,
      unit.animationPrefix,
      false,
      0,
      0,
      presentationFacingDirection,
    ) ?? resolveUnitAnimationTexture(
      unit.unitId,
      false,
      0,
      0,
      presentationFacingDirection,
    ) ?? UNIT_STATS[unit.unitId].textureKey;
    const idleFramePresentation = resolveUnitFramePresentation(
      unit.unitId,
      targetVisibleWorldHeight,
      frameAspect,
      idleTextureKey,
    );
    const framePresentation = resolveUnitFramePresentation(
      unit.unitId,
      targetVisibleWorldHeight,
      frameAspect,
      desiredTexture,
    );
    const isMeleePose = this.isMeleeUnit(unit);
    const widthAllowance = unit.unitId === "pikeman"
      ? 2.8
      : isMeleePose ? 1.6 : unit.role === "support" ? 1.2 : 1.35;
    const widthFrameScale = Math.min(
      1,
      (idleFramePresentation.spriteWidth * widthAllowance) / Math.max(1, framePresentation.spriteWidth),
    );
    const heightFrameScale = 1;
    const cappedFrameWidth = framePresentation.spriteWidth * widthFrameScale;
    const cappedFrameHeight = framePresentation.spriteHeight * heightFrameScale;
    const unconstrainedSpriteWidth = this.terrainPrototypeEnabled
      ? cappedFrameWidth
      : unit.displaySize * legacyScale * widthFrameScale;
    const maxPoseWidth = idleFramePresentation.spriteWidth * widthAllowance;
    const spriteWidth = Math.min(unconstrainedSpriteWidth, maxPoseWidth);
    const spriteHeight = this.terrainPrototypeEnabled
      ? cappedFrameHeight
      : unit.displaySize * legacyScale * heightFrameScale;
    unit.visualOffsetX = Phaser.Math.Linear(unit.visualOffsetX, targetAttackMotion.offsetX, 0.22);
    unit.visualLift = Phaser.Math.Linear(unit.visualLift, targetAttackMotion.lift, 0.2);
    unit.visualRotationRad = Phaser.Math.Linear(
      unit.visualRotationRad,
      unit.role === "support" ? 0 : targetAttackMotion.rotationRad,
      0.18,
    );
    // Interpolating dimensions across differently shaped texture canvases
    // squashes the whole character during pose changes. Motion offsets are
    // smoothed separately; frame geometry must retain its authored aspect.
    unit.visualSpriteWidth = spriteWidth;
    unit.visualSpriteHeight = spriteHeight;
    const attackOffsetX = unit.visualOffsetX + walkMotion.swayX;
    const attackLift = unit.visualLift;
    const originX = this.isPrototypeV2() ? framePresentation.originX : 0.5;
    const originY = this.isPrototypeV2()
      ? framePresentation.originY
      : this.terrainPrototypeEnabled ? 0.88 : 0.5;
    const v2HpWidth = this.isPrototypeV2()
      ? this.cssPxToWorld(this.scaleVisualConfig.unitHpWidthCssPx)
      : 34;
    const v2HpHeight = this.isPrototypeV2()
      ? this.cssPxToWorld(this.scaleVisualConfig.unitHpHeightCssPx)
      : 5;
    const v2VerticalGap = this.isPrototypeV2()
      ? this.cssPxToWorld(7)
      : 10;
    const visibleSpriteHeight = this.isPrototypeV2()
      ? framePresentation.referenceVisibleHeight
      : spriteHeight * originY;
    const hpY = this.terrainPrototypeEnabled
      ? pos.y - visibleSpriteHeight - v2VerticalGap - bob - attackLift
      : pos.y - 44 - bob - attackLift;
    const labelY = this.isPrototypeV2()
      ? hpY - this.cssPxToWorld(16)
      : this.terrainPrototypeEnabled ? hpY - 14 : pos.y - 58 - bob - attackLift;
    const shadowWidth = this.terrainPrototypeEnabled
      ? Math.max(38, idleFramePresentation.spriteWidth * 0.88)
      : unit.role === "support" ? 56 : 46;
    const shadowHeight = this.terrainPrototypeEnabled
      ? unit.role === "support" ? 15 : 12
      : unit.role === "support" ? 20 : 16;

    unit.shadow
      .setPosition(
        pos.x + (this.terrainPrototypeEnabled ? 2 : 0),
        pos.y + (this.terrainPrototypeEnabled ? 2 : 24),
      )
      .setSize(shadowWidth, shadowHeight)
      .setRotation(this.terrainPrototypeEnabled ? -0.08 : 0)
      .setFillStyle(0x061016, this.terrainPrototypeEnabled ? 0.3 : 0.2)
      .setScale(moving ? 0.96 : 1, moving ? 0.94 : 1)
      .setDepth(this.getGroundDepth(pos.y, -1));
    const ringWidth = unit.role === "support"
      ? Math.max(42, idleFramePresentation.spriteWidth * 0.72)
      : Math.max(40, idleFramePresentation.spriteWidth * 0.8);
    const ringHeight = unit.role === "support"
      ? Math.max(14, shadowHeight * 1.08)
      : Math.max(14, shadowHeight * 1.18);

    unit.selectionRing
      .setPosition(pos.x, pos.y + 3)
      .setSize(ringWidth, ringHeight)
      .setDepth(this.getGroundDepth(pos.y, -2))
      .setVisible(this.isPrototypeV2() && (unit.selected || unit.hovered));
    const flipX = shouldFlipUnitFrame(unit.unitId, presentationFacingX, presentationFacingDirection);

    unit.sprite
      .setPosition(pos.x + attackOffsetX, pos.y - bob - attackLift)
      .setOrigin(originX, originY)
      .setRotation(unit.visualRotationRad + walkMotion.rotationRad)
      .setFlipX(flipX)
      .setDisplaySize(unit.visualSpriteWidth, unit.visualSpriteHeight)
      .setDepth(this.getGroundDepth(pos.y));
    unit.hpBg
      .setPosition(pos.x, hpY)
      .setSize(v2HpWidth, v2HpHeight)
      .setDepth(this.getGroundDepth(pos.y, 5));
    unit.hpFill
      .setPosition(pos.x - v2HpWidth / 2, hpY)
      .setSize(v2HpWidth * Math.max(0, unit.hp / unit.maxHp), v2HpHeight)
      .setDepth(this.getGroundDepth(pos.y, 6));
    const manaY = hpY + v2HpHeight + this.cssPxToWorld(3);
    unit.manaBg
      .setPosition(pos.x, manaY)
      .setSize(v2HpWidth, Math.max(2, v2HpHeight * 0.72))
      .setDepth(this.getGroundDepth(pos.y, 5))
      .setVisible(unit.role === "support");
    unit.manaFill
      .setPosition(pos.x - v2HpWidth / 2, manaY)
      .setSize(v2HpWidth * (unit.manaMax > 0 ? unit.manaCurrent / unit.manaMax : 0), Math.max(2, v2HpHeight * 0.72))
      .setDepth(this.getGroundDepth(pos.y, 6))
      .setVisible(unit.role === "support");
    unit.label
      .setText(this.isPrototypeV2() ? `${UNIT_STATS[unit.unitId].label} Lv.1` : UNIT_STATS[unit.unitId].label)
      .setPosition(pos.x, labelY)
      .setDepth(this.getGroundDepth(pos.y, 7));
    if (this.isPrototypeV2()) {
      const unitFontCssPx = unit.selected || unit.hovered
        ? this.scaleVisualConfig.selectedUnitFontCssPx
        : this.scaleVisualConfig.unitFontCssPx;
      this.styleV2WorldText(
        unit.label,
        unitFontCssPx,
        true,
      );
      unit.label.setVisible(this.shouldShowV2UnitLabel(unit));
    } else {
      unit.label
        .setVisible(this.shouldShowV2UnitLabel(unit))
        .setScale(1)
        .setStroke("#132033", 3)
        .setShadow(0, 0, "#000000", 0, false, false)
        .setBackgroundColor("rgba(0, 0, 0, 0)")
        .setPadding(0);
    }
  }

  private shiftWorker(role: WorkerRole, delta: 1 | -1): void {
    if (role === "idle" || role === "research") {
      this.audio.playSfx("sfx.ui.cancel", { eventKey: `worker:${role}:${delta}` });
      return;
    }
    if (delta > 0) {
      if (this.player.workers.idle <= 0) {
        this.audio.playSfx("sfx.ui.hireFail", { eventKey: `worker:${role}:no-idle` });
        return;
      }
      this.player.workers.idle -= 1;
      this.player.workers[role] += 1;
    } else {
      if (this.player.workers[role] <= 0) {
        this.audio.playSfx("sfx.ui.cancel", { eventKey: `worker:${role}:empty` });
        return;
      }
      this.player.workers[role] -= 1;
      this.player.workers.idle += 1;
    }
    this.audio.playSfx("sfx.ui.confirm", { eventKey: `worker:${role}:${delta}:${this.player.workers[role]}` });
  }

  private hireWorker(): void {
    if (!this.devModeEnabled && !canAfford(this.player.resources, BASE_WORKER_COST)) {
      this.hud.setInfo("일꾼 고용 실패: 금/목재/식량 부족");
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: "hire:worker:shortage" });
      return;
    }
    if (!this.devModeEnabled) payCost(this.player.resources, BASE_WORKER_COST);
    this.player.workers.idle += 1;
    this.hud.setInfo("일꾼 1명을 고용했습니다");
    this.audio.playSfx("sfx.ui.hireSuccess", { eventKey: `hire:worker:${this.player.workers.idle}` });
  }

  private hireResearchWorker(): void {
    const cost = getResearchWorkerDirectCost(this.player.ageId);
    if (this.devModeEnabled || canAfford(this.player.resources, cost)) {
      if (!this.devModeEnabled) payCost(this.player.resources, cost);
      this.player.workers.research += 1;
      this.hud.setInfo("연구 일꾼 1명이 즉시 연구에 배치되었습니다");
      this.audio.playSfx("sfx.ui.hireSuccess", { eventKey: `hire:research:direct:${this.player.workers.research}` });
      return;
    }

    this.hud.setInfo("연구 일꾼 고용 자원 부족");
    this.audio.playSfx("sfx.ui.hireFail", { eventKey: "hire:research:failed" });
  }

  private tryUseInstantWaveToken(team: TeamState): void {
    const eligibility = getInstantWaveEligibility(team);
    if (eligibility === "no-token") {
      if (team.id === "player") this.hud.setInfo("즉시 웨이브 토큰이 없습니다");
      if (team.id === "player") this.audio.playSfx("sfx.ui.hireFail", { eventKey: "wave:instant:no-token" });
      return;
    }
    if (eligibility === "cooldown") {
      if (team.id === "player") this.hud.setInfo("직전 웨이브 후 5초 뒤 사용 가능");
      if (team.id === "player") this.audio.playSfx("sfx.ui.cancel", { eventKey: "wave:instant:cooldown" });
      return;
    }
    if (this.trySpawnWave(team, true)) team.instantWaveTokens -= 1;
  }

  private tryAgeUpPlayer(): void {
    const idx = AGES.findIndex((age) => age.id === this.player.ageId);
    if (idx >= AGES.length - 1) {
      this.hud.setInfo("이미 최종 시대입니다");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: "age:max" });
      return;
    }
    const cost = getAgeUpCost(idx);
    if (!this.devModeEnabled && !canAfford(this.player.resources, cost)) {
      this.hud.setInfo(`시대 업 실패: ${this.formatResourceShortage(cost)}`);
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: "age:shortage" });
      return;
    }
    if (!this.devModeEnabled) payCost(this.player.resources, cost);
    this.advanceAge(this.player);
    this.hud.setInfo(`${getAge(this.player.ageId).label} 도달`);
    this.audio.playSfx("sfx.ui.confirm", { eventKey: `age:${this.player.ageId}` });
  }

  private advanceAge(team: TeamState): void {
    const previousAgeId = team.ageId;
    if (!advanceTeamAge(team)) return;
    this.applyTowerResearchCarryover(team, previousAgeId, team.ageId);
    if (getAge(team.ageId).immediateWaveTokenGranted) this.grantInstantWaveToken(team);
    if (team.id === "player") {
      this.syncGameplayMusicTheme();
      this.refreshUi();
    }
  }

  private applyTowerResearchCarryover(team: TeamState, previousAgeId: AgeId, nextAgeId: AgeId): void {
    const researchState = this.getResearchStateForTeam(team.id);
    const nextLevels = { ...getAppliedResearchLevels(researchState, nextAgeId, TOWER_RESEARCH_SUBJECT_ID) };
    let changed = false;
    if (shouldGrantTowerResearchCarryover(previousAgeId, nextAgeId, researchState, "attack") && nextLevels.attackLevel < 1) {
      nextLevels.attackLevel = 1;
      changed = true;
    }
    if (shouldGrantTowerResearchCarryover(previousAgeId, nextAgeId, researchState, "defense") && nextLevels.defenseLevel < 1) {
      nextLevels.defenseLevel = 1;
      changed = true;
    }
    if (!changed) return;
    researchState.applied[nextAgeId] = {
      ...(researchState.applied[nextAgeId] ?? {}),
      [TOWER_RESEARCH_SUBJECT_ID]: nextLevels,
    };
    if (researchState.draft[nextAgeId]?.[TOWER_RESEARCH_SUBJECT_ID]) {
      delete researchState.draft[nextAgeId]?.[TOWER_RESEARCH_SUBJECT_ID];
    }
  }

  private getResearchStateForTeam(teamId: TeamId): TeamResearchState {
    return teamId === "player" ? this.playerResearchState : this.enemyResearchState;
  }

  private getTowerResearchState(owner: TeamId | "neutral"): TeamResearchState | undefined {
    if (owner === "neutral") return undefined;
    return this.getResearchStateForTeam(owner);
  }

  private grantInstantWaveToken(team: TeamState): void {
    team.instantWaveTokens += 1;
  }

  private refreshUi(): void {
    const selected = this.capturePoints.find((point) => point.id === this.selectedCapturePointId);
    const selectedTower = this.defenseTowers.find((tower) => tower.id === this.selectedDefenseTowerId);
    const snapshot = createLaneBattleHudSnapshot({
      player: this.player,
      enemy: this.enemy,
      playerUnitCount: this.units.filter((unit) => unit.team === "player").length,
      enemyUnitCount: this.units.filter((unit) => unit.team === "enemy").length,
      playerBaseMaxHp: PLAYER_BASE_HP,
      enemyBaseMaxHp: ENEMY_BASE_HP,
      opponentCount: PLAYER_OPPONENT_COUNT,
      selectedCapturePoint: selected,
      selectedDefenseTower: selectedTower,
    });
    const selectedActions = this.getSelectedCaptureActions();
    this.hud.apply(snapshot, selectedActions);
    this.hud.setDevMode(this.devModeEnabled);
    if (this.selectedMainBaseTeam === "player") {
      this.baseResearchPanel.applySnapshot(createBaseResearchPanelSnapshot({
        team: this.player,
        researchState: this.playerResearchState,
        viewedAgeId: this.player.selectedProductionAgeId,
        freeApply: this.devModeEnabled,
      }));
    } else {
      this.baseResearchPanel.setVisible(false);
    }
    this.refreshHudActionLabels();
  }

  private refreshHudActionLabels(): void {
    this.hud.setStrategicActionLabel("hire-worker", `일꾼 고용\n${this.formatCostShort(BASE_WORKER_COST)}`);
    this.hud.setStrategicActionLabel("hire-research-worker", `연구 일꾼\n${this.formatCostShort(getResearchWorkerDirectCost(this.player.ageId))}`);
    const ageIndex = AGES.findIndex((age) => age.id === this.player.ageId);
    const ageUpCost = ageIndex >= AGES.length - 1 ? null : getAgeUpCost(ageIndex);
    this.hud.setStrategicActionLabel(
      "age-up",
      ageIndex >= AGES.length - 1
        ? "시대 업\n최종 시대"
        : `시대 업\n${this.formatCostShort(ageUpCost ?? {})}`,
    );
    this.hud.setStrategicActionEnabled("age-up", this.devModeEnabled || (ageUpCost ? canAfford(this.player.resources, ageUpCost) : true));
    this.hud.setStrategicActionLabel("use-instant-wave", `즉시 웨이브\n토큰 ${this.player.instantWaveTokens}`);

    this.hud.setCaptureActionLabel("rebuild-defense-tower", `타워 재건\n${this.formatCostShort(getDefenseTowerBuildCost(this.player.ageId))}`);
    this.hud.setCaptureActionLabel("build-defense-tower", `타워\n${this.formatCostShort(getBuildingCost("defense_tower", this.player.ageId))}`);
    this.hud.setCaptureActionLabel("build-supply-depot", `병참\n${this.formatCostShort(getBuildingCost("supply_depot", this.player.ageId))}`);
    this.hud.setCaptureActionLabel("build-mint", `조달소\n${this.formatCostShort(getBuildingCost("mint", this.player.ageId))}`);
    this.hud.setCaptureActionLabel("dismantle", `폐기\n${DISMANTLE_COST_GOLD}G`);
  }

  private toggleDevMode(): void {
    this.devModeEnabled = !this.devModeEnabled;
    this.hud.setInfo(this.devModeEnabled ? "DEV 모드 활성화" : "DEV 모드 비활성화");
    this.audio.playSfx(this.devModeEnabled ? "sfx.ui.confirm" : "sfx.ui.cancel", {
      eventKey: `dev-mode:${this.devModeEnabled ? "on" : "off"}`,
    });
    this.refreshUi();
  }

  private grantDevResearchPoints(amount = 25): void {
    if (!this.devModeEnabled) {
      this.hud.setInfo("DEV 모드에서만 연구 포인트를 추가할 수 있습니다");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: "dev-research:disabled" });
      return;
    }
    this.player.resources.research += amount;
    this.hud.setInfo(`연구 포인트 +${amount}`);
    this.audio.playSfx("sfx.ui.confirm", { eventKey: `dev-research:${amount}` });
    this.refreshUi();
  }

  private formatCostShort(cost: Partial<Record<"gold" | "wood" | "food" | "metal" | "research", number>>): string {
    const parts: string[] = [];
    if (cost.gold) parts.push(`${Math.round(cost.gold)}G`);
    if (cost.wood) parts.push(`${Math.round(cost.wood)}W`);
    if (cost.food) parts.push(`${Math.round(cost.food)}F`);
    if (cost.metal) parts.push(`${Math.round(cost.metal)}M`);
    if (cost.research) parts.push(`${Math.round(cost.research)}R`);
    return parts.join(" ");
  }

  private formatResourceShortage(cost: Partial<Record<"gold" | "wood" | "food" | "metal" | "research", number>>): string {
    const labels = {
      gold: "금",
      wood: "목재",
      food: "식량",
      metal: "금속",
      research: "연구",
    } as const;
    const shortages = (Object.entries(cost) as Array<["gold" | "wood" | "food" | "metal" | "research", number | undefined]>)
      .map(([resourceId, required]) => {
        const missing = Math.max(0, Math.ceil((required ?? 0) - this.player.resources[resourceId]));
        return missing > 0 ? `${labels[resourceId]} ${missing}` : null;
      })
      .filter((value): value is string => value !== null);
    return shortages.length > 0 ? shortages.join(", ") + " 부족" : "자원 부족";
  }

  private publishDebug(): void {
    (window as unknown as { __gameDebug: unknown }).__gameDebug = this.createVerificationSnapshot();
  }

  private createVerificationSnapshot(): LaneBattleDebugSnapshot {
    return {
      phase: "lane-siege",
      elapsedSec: this.elapsedSec,
      player: {
        ageId: this.player.ageId,
        selectedProductionAgeId: this.player.selectedProductionAgeId,
        resources: this.player.resources,
        workers: this.player.workers,
        baseHp: this.player.baseHp,
        nextWaveInSec: this.player.nextWaveInSec,
      },
      enemy: {
        ageId: this.enemy.ageId,
        selectedProductionAgeId: this.enemy.selectedProductionAgeId,
        resources: this.enemy.resources,
        workers: this.enemy.workers,
        baseHp: this.enemy.baseHp,
        nextWaveInSec: this.enemy.nextWaveInSec,
      },
      units: this.units.map((unit) => ({
        id: unit.id,
        team: unit.team,
        unitId: unit.unitId,
        role: unit.role,
        laneId: unit.laneId,
        progress: unit.progress,
        laneRow: unit.laneRow,
        hp: unit.hp,
        maxHp: unit.maxHp,
        facingX: unit.travelFacingX,
        facingDirection: unit.travelFacingDirection,
        travelFacingX: unit.travelFacingX,
        travelFacingDirection: unit.travelFacingDirection,
        combatFacingX: unit.combatFacingX,
        combatFacingDirection: unit.combatFacingDirection,
        flipX: unit.sprite.flipX,
        tint: unit.sprite.tintTopLeft,
        motion: { x: unit.motionX, y: unit.motionY },
        pose: unit.currentTextureKey,
        renderTexture: unit.sprite.texture.key,
        attackAnimTime: unit.attackAnimTime,
        attackFacingLockSec: unit.attackFacingLockSec,
        combatFacingHoldSec: unit.combatFacingHoldSec,
        attackTargetKind: unit.attackTargetKind,
        manaCurrent: unit.manaCurrent,
        manaMax: unit.manaMax,
        manaRegenPerSec: unit.manaRegenPerSec,
        healManaCost: unit.healManaCost,
        healPower: unit.healPower,
        presentation: {
          x: unit.sprite.x,
          y: unit.sprite.y,
          originX: unit.sprite.originX,
          originY: unit.sprite.originY,
          rotationRad: unit.sprite.rotation,
          spriteDisplayWidth: unit.sprite.displayWidth,
          spriteDisplayHeight: unit.sprite.displayHeight,
        },
        overlay: {
          mode: this.unitOverlayModes.get(unit.id) ?? "detail",
          hpVisible: unit.hpBg.visible,
          manaVisible: unit.manaBg.visible,
          labelVisible: unit.label.visible,
          labelText: unit.label.text,
        },
        attackTiming: this.getUnitAttackTiming(unit, unit.attackTargetKind),
      })),
      battlefield: {
        capturePoints: this.battlefield.capturePoints,
        controlPoints: this.capturePoints.map((point) => ({
          id: point.id,
          laneId: point.laneId,
          pointType: point.definition.pointType,
          allowedBuildingTypes: point.definition.allowedBuildingTypes,
          owner: point.owner,
          control: point.control,
          progress: point.progress,
          worldX: point.core.x,
          worldY: point.core.y,
          labelWorldX: point.label.x,
          labelWorldY: point.label.y,
          markerTexture: point.marker.texture.key,
          buildingId: point.buildingId ?? null,
          buildingLevel: point.buildingLevel,
          availableActions: getCapturePointActions(point.definition, point),
        })),
        defenseTowers: this.defenseTowers.map((tower) => ({
          id: tower.id,
          laneId: tower.laneId,
          owner: tower.owner,
          linkedCapturePointId: tower.definition.linkedCapturePointId,
          progress: tower.progress,
          built: tower.built,
          hp: tower.hp,
          maxHp: tower.maxHp,
          buildRemainingSec: tower.buildRemainingSec,
        })),
        laneStart: { x: this.laneStart.x, y: this.laneStart.y },
        laneEnd: { x: this.laneEnd.x, y: this.laneEnd.y },
        lanes: this.mapSpec.lanes.map((lane) => ({
          id: lane.id,
          role: lane.role,
          start: lane.path[0]?.position ?? { x: 0, y: 0 },
          end: lane.path[lane.path.length - 1]?.position ?? { x: 0, y: 0 },
        })),
      },
      ui: {
        ageLabel: this.hud.getAgeLabelText(),
        playerSelectedProductionAgeId: this.player.selectedProductionAgeId,
        selectedMainBaseTeam: this.selectedMainBaseTeam,
        selectedCapturePointId: this.selectedCapturePointId,
        selectedDefenseTowerId: this.selectedDefenseTowerId,
        visibleCaptureActions: this.hud.getVisibleCaptureActions(),
        hudVisible: this.uiCamera.visible,
        composition: this.hud.getCompositionMetrics(),
        unitOverlayDensityEnabled: this.unitOverlayDensityEnabled,
        unitOverlayModes: Object.fromEntries(this.units.map((unit) => [
          unit.id,
          this.unitOverlayModes.get(unit.id) ?? "detail",
        ])),
      },
      activeProjectiles: [...this.activeProjectiles].map((projectile) => ({
        textureKey: projectile.name,
        x: projectile.x,
        y: projectile.y,
      })),
      engagement: {
        uniqueAttackers: this.engagedUnitIds.size,
        battleUnits: this.units.filter((unit) => unit.role === "battle").length,
        currentlyAnimating: this.units.filter((unit) => unit.attackAnimTime > 0).length,
      },
      towerAttackPatterns: {
        stone: createTowerAttackPattern("stone"),
        bronze: createTowerAttackPattern("bronze"),
      },
      verification: {
        seed: this.verificationSeed,
        terrainMode: this.terrainMode,
        prototypePreset: this.prototypePresetId,
        scalePreset: this.scalePresetId,
        visualValidationScenario: this.visualValidationScenario,
        camera: {
          scrollX: this.cameras.main.scrollX,
          scrollY: this.cameras.main.scrollY,
          zoom: this.cameras.main.zoom,
          centerX: this.cameras.main.midPoint.x,
          centerY: this.cameras.main.midPoint.y,
        },
        rules: {
          worldWidth: WORLD_W,
          worldHeight: WORLD_H,
          cameraZoom: FIELD_CAMERA_ZOOM,
          waveIntervalSec: WAVE_INTERVAL_SEC,
          unitProgressSpeed: UNIT_PROGRESS_SPEED,
          rangeToProgress: RANGE_TO_PROGRESS,
          friendlyGap: FRIENDLY_GAP,
          engageGap: ENGAGE_GAP,
          captureRadiusProgress: CAPTURE_RADIUS_PROGRESS,
          captureRatePerSec: CAPTURE_RATE_PER_SEC,
          playerBaseHp: PLAYER_BASE_HP,
          enemyBaseHp: ENEMY_BASE_HP,
          laneRowSpacing: LANE_ROW_SPACING,
        },
        terrain: {
          mapSpecId: this.mapSpec.id,
          patchCount: this.mapSpec.terrainPatches.length,
          cellCount: this.mapSpec.terrainPatches.reduce(
            (total, patch) => total + patch.cells.length,
            0,
          ),
          structureSocketCount: this.mapSpec.structureSockets.length,
          propGrounding: this.mapSpec.terrainProps.map((prop) => ({
            id: prop.id,
            textureKey: prop.textureKey,
            groundOriginY: prop.groundOriginY,
            shadow: prop.shadow,
          })),
        },
        presentation: {
          scalePreset: this.scalePresetId,
          canvasCssScale: this.getCanvasCssScale(),
          devicePixelRatio: window.devicePixelRatio,
          configuredVisibleCssHeights: {
            normalUnit: this.scaleVisualConfig.normalUnitCssHeight,
            supportUnit: this.scaleVisualConfig.supportUnitCssHeight,
            largeUnit: this.scaleVisualConfig.largeUnitCssHeight,
            captureTower: this.scaleVisualConfig.captureTowerCssHeight,
            fixedFortress: this.scaleVisualConfig.fixedFortressCssHeight,
          },
          configuredFontCssPx: {
            unit: this.scaleVisualConfig.unitFontCssPx,
            selectedUnit: this.scaleVisualConfig.selectedUnitFontCssPx,
            auxiliary: this.scaleVisualConfig.auxiliaryFontCssPx,
            tower: this.scaleVisualConfig.towerFontCssPx,
            fixedFortress: this.scaleVisualConfig.fixedFortressFontCssPx,
          },
          sampledUnits: this.units.slice(0, 8).map((unit) => ({
            id: unit.id,
            unitId: unit.unitId,
            pose: unit.currentTextureKey,
            worldWidth: unit.sprite.displayWidth,
            worldHeight: unit.sprite.displayHeight,
            canvasScreenWidth: unit.sprite.displayWidth * this.cameras.main.zoom,
            canvasScreenHeight: unit.sprite.displayHeight * this.cameras.main.zoom,
            cssFrameWidth: unit.sprite.displayWidth * this.cameras.main.zoom * this.getCanvasCssScale(),
            cssFrameHeight: unit.sprite.displayHeight * this.cameras.main.zoom * this.getCanvasCssScale(),
            cssVisibleHeight: unit.sprite.displayHeight
              * (resolveUnitFramePresentation(unit.unitId, 1, 1, unit.currentTextureKey).referenceVisibleHeight
                / resolveUnitFramePresentation(unit.unitId, 1, 1, unit.currentTextureKey).spriteHeight)
              * this.cameras.main.zoom
              * this.getCanvasCssScale(),
            originX: unit.sprite.originX,
            originY: unit.sprite.originY,
            hpWorldWidth: unit.hpBg.width,
            hpWorldHeight: unit.hpBg.height,
            hpCssWidth: unit.hpBg.width * this.cameras.main.zoom * this.getCanvasCssScale(),
            hpCssHeight: unit.hpBg.height * this.cameras.main.zoom * this.getCanvasCssScale(),
            manaCurrent: unit.manaCurrent,
            manaMax: unit.manaMax,
            manaRegenPerSec: unit.manaRegenPerSec,
            healManaCost: unit.healManaCost,
            labelCssFontSize: Number.parseFloat(String(unit.label.style.fontSize))
              * this.cameras.main.zoom
              * this.getCanvasCssScale(),
            labelResolution: unit.label.style.resolution,
            labelScale: unit.label.scaleX,
            labelVisible: unit.label.visible,
            travelFacingX: unit.travelFacingX,
            combatFacingX: unit.combatFacingX,
            flipX: unit.sprite.flipX,
            motion: { x: unit.motionX, y: unit.motionY },
          })),
          captureTowers: this.defenseTowers.map((point) => ({
            id: point.id,
            pointType: "defense-tower",
            textureKey: point.sprite.texture.key,
            worldX: point.sprite.x,
            worldY: point.sprite.y,
            cssFrameHeight: point.sprite.displayHeight
              * this.cameras.main.zoom
              * this.getCanvasCssScale(),
            cssVisibleHeight: point.sprite.displayHeight
              * getDefenseTowerVisibleHeightRatio(this.getDefenseTowerVisualState(point))
              * this.cameras.main.zoom
              * this.getCanvasCssScale(),
            originY: point.sprite.originY,
          })),
          centralTower: (() => {
            const point = this.defenseTowers[1];
            return point ? {
              pointType: "defense-tower",
              worldWidth: point.sprite.displayWidth,
              worldHeight: point.sprite.displayHeight,
              cssFrameWidth: point.sprite.displayWidth * this.cameras.main.zoom * this.getCanvasCssScale(),
              cssFrameHeight: point.sprite.displayHeight * this.cameras.main.zoom * this.getCanvasCssScale(),
              cssVisibleHeight: point.sprite.displayHeight
                * getDefenseTowerVisibleHeightRatio(this.getDefenseTowerVisualState(point))
                * this.cameras.main.zoom
                * this.getCanvasCssScale(),
              originY: point.sprite.originY,
              hpWorldWidth: point.hpBg.width,
              hpWorldHeight: point.hpBg.height,
              hpCssWidth: point.hpBg.width * this.cameras.main.zoom * this.getCanvasCssScale(),
              hpCssHeight: point.hpBg.height * this.cameras.main.zoom * this.getCanvasCssScale(),
              labelCssFontSize: Number.parseFloat(String(point.label.style.fontSize))
                * this.cameras.main.zoom
                * this.getCanvasCssScale(),
              labelResolution: point.label.style.resolution,
              labelScale: point.label.scaleX,
              availableActions: point.owner === "player" && !point.built ? ["rebuild-defense-tower"] : [],
            } : null;
          })(),
        },
        unitStats: Object.fromEntries(Object.entries(UNIT_STATS).map(([id, stats]) => [
          id,
          {
            hp: stats.hp,
            attack: stats.attack,
            defense: stats.defense,
            range: stats.range,
            speed: stats.speed,
            attackCooldownSec: stats.attackCooldownSec,
            healPower: stats.healPower ?? 0,
          },
        ])),
      },
    };
  }

  private getBaseAnchor(teamId: TeamId, laneId: string, fallbackProgress: number): Phaser.Math.Vector2 {
    const lanePath = this.lanePaths.get(laneId);
    if (lanePath?.length) {
      return this.progressToScreen(teamId === "player" ? 0 : 1, 0, laneId);
    }
    return this.progressToScreen(fallbackProgress, 0, this.primaryLaneSpec.id);
  }

  private progressToScreen(progress: number, laneRow: number, laneId = this.primaryLaneSpec.id): Phaser.Math.Vector2 {
    const lanePath = this.lanePaths.get(laneId) ?? this.lanePath;
    const clampedProgress = Phaser.Math.Clamp(progress, 0, 1);
    const endIndex = Math.max(
      1,
      lanePath.findIndex((node) => node.progress >= clampedProgress),
    );
    const startNode = lanePath[endIndex - 1];
    const endNode = lanePath[endIndex] ?? lanePath[lanePath.length - 1];
    const segmentSpan = Math.max(0.0001, endNode.progress - startNode.progress);
    const segmentProgress = (clampedProgress - startNode.progress) / segmentSpan;
    const segmentDir = endNode.position.clone().subtract(startNode.position).normalize();
    const segmentPerp = new Phaser.Math.Vector2(-segmentDir.y, segmentDir.x);

    return startNode.position
      .clone()
      .lerp(endNode.position, segmentProgress)
      .add(segmentPerp.scale(laneRow * LANE_ROW_SPACING));
  }

  private getGroundDepth(groundY: number, offset = 0): number {
    return DEPTH_UNIT + groundY * 0.1 + offset;
  }

  private spawnToast(text: string, x: number, y: number, color: string): void {
    const toast = this.add.text(x, y, text, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color,
      stroke: "#132033",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH_UI + 8);
    this.uiCamera?.ignore(toast);
    this.tweens.add({
      targets: toast,
      y: y - 18,
      alpha: 0,
      duration: 650,
      onComplete: () => toast.destroy(),
    });
  }
}
