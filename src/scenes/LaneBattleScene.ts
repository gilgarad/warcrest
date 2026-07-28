import Phaser from "phaser";
import { AGES, getAge } from "../data/ages";
import {
  BASE_WORKER_COST,
  AI_INSTANT_WAVE_MIN_REMAINING_SEC,
  getAgeBalance,
  RESEARCH_WORKER_CONVERSION,
  RESEARCH_WORKER_DIRECT_COST,
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
  getDefenseTowerSocketId,
  LANE_BATTLEFIELD_MAP_SPEC,
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
  CAPTURE_POINT_DEFINITIONS,
  getCapturePointActions,
  type CapturePointAction,
  type CapturePointDefinition,
} from "../data/capturePointDefinitions";
import {
  DEFENSE_TOWER_DEFINITIONS,
  type DefenseTowerAction,
  type DefenseTowerDefinition,
} from "../data/defenseTowerDefinitions";
import {
  BattlefieldPrototypeRenderer,
  PROTOTYPE_TERRAIN_ASSETS,
  type StructureGroundPresentation,
} from "../gfx/battlefieldPrototypeRenderer";
import { BattlefieldWorldRenderer } from "../gfx/battlefieldWorldRenderer";
import { generateBattlefield, type BattlefieldResult } from "../systems/battlefieldGenerator";
import { getAudioSystem } from "../systems/audio";
import { LaneBattleAudioWiring } from "../systems/audio/laneBattleAudioWiring";
import { LaneBattleHudView } from "../ui/LaneBattleHudView";
import { createLaneBattleHudSnapshot } from "../ui/laneBattleHudModel";
import {
  UNIT_ANIMATION_ASSETS,
  getUnitAnimationDefinition,
  resolveUnitAnimationTexture,
} from "../presentation/units/unitAnimationRegistry";
import {
  getUnitScaleFactor,
  resolveUnitFramePresentation,
} from "../presentation/units/unitPresentation";
import {
  UNIT_STATS,
  getProjectileKeyForUnit,
} from "../systems/lane-units/unitStats";
import { createTowerAttackPattern } from "../systems/lane-combat/towerAttack";
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
  convertWorkersToResearch,
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
  resolveCapturedBuilding,
  type BuildingDefinition,
  type BuildingId,
} from "../systems/lane-capture/captureRules";
import {
  DEFENSE_TOWER_BUILD_DURATION_SEC,
  getDefenseTowerBuildCost,
  getDefenseTowerMaxHp,
} from "../systems/lane-capture/defenseTowerRules";

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
const UNIT_PROGRESS_SPEED = 0.02;
const RANGE_TO_PROGRESS = 0.013;
const FRIENDLY_GAP = 0.011;
const ENGAGE_GAP = 0.022;
const FIELD_CAMERA_ZOOM = 0.46;
const TOWER_W = 148;
const TOWER_H = 176;
const BASE_W = 340;
const BASE_H = 300;
const CENTRAL_CAPTURE_PROGRESS = 0.588;
const DEFAULT_VERIFICATION_SEED = "warcrest-central-v1";
const QUERY_PARAMS = new URLSearchParams(window.location.search);
const FACING_DEAD_ZONE_WORLD_PX = 0.35;
const ATTACK_VISUAL_DURATION_SEC = 0.48;
const TOWER_IMAGE_GROUND_ORIGIN_Y = 1128 / 1254;
const TOWER_IMAGE_VISIBLE_HEIGHT_RATIO = 1036 / 1254;

type UnitTextureKey = string;

interface LaneUnit {
  id: number;
  team: TeamId;
  role: "battle" | "support";
  unitId: BattleUnitId | SupportUnitId;
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
  currentTextureKey: string;
  presentationOverrideTexture?: string;
  facingX: -1 | 1;
  lastPresentationX: number;
  lastPresentationY: number;
  motionX: number;
  motionY: number;
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
  progress: number;
  owner: TeamId | "neutral";
  control: number;
  buildingId?: BuildingId;
  buildingLevel: number;
  incomeTimerSec: number;
  supplyTimerSec: number;
  ring: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  ownerText: Phaser.GameObjects.Text;
  buildingText: Phaser.GameObjects.Text;
}

interface DefenseTowerState {
  id: number;
  definition: DefenseTowerDefinition;
  progress: number;
  owner: TeamId;
  attackTimerSec: number;
  buildRemainingSec: number;
  built: boolean;
  maxHp: number;
  hp: number;
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
function progressBetween(a: number, b: number): number {
  return Math.abs(a - b);
}

export class LaneBattleScene extends Phaser.Scene {
  private battlefield!: BattlefieldResult;
  private units: LaneUnit[] = [];
  private capturePoints: CapturePointState[] = [];
  private defenseTowers: DefenseTowerState[] = [];
  private selectedCapturePointId: number | null = null;
  private selectedDefenseTowerId: number | null = null;
  private player!: TeamState;
  private enemy!: TeamState;
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
  private readonly lanePath: LanePathNode[] = LANE_BATTLEFIELD_MAP_SPEC.lanePath.map((node) => ({
    progress: node.progress,
    position: new Phaser.Math.Vector2(node.position.x, node.position.y),
  }));
  private readonly laneStart = this.lanePath[0].position.clone();
  private readonly laneEnd = this.lanePath[this.lanePath.length - 1].position.clone();
  private isDraggingField = false;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private readonly worldObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly uiObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly activeProjectiles = new Set<Phaser.GameObjects.Image>();
  private readonly engagedUnitIds = new Set<number>();
  private readonly audio = getAudioSystem();
  private readonly audioWiring = new LaneBattleAudioWiring(this.audio);
  private hud!: LaneBattleHudView;
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
    this.load.image("lane-battlefield-bg", "/assets/battle/lane-battlefield-object-base-v4.png");
    this.load.image("lane-battlefield-bg-v2", "/assets/battle/lane-battlefield-object-base-v4-prototype-v2.png");
    this.load.image("war-table-hud", "/assets/battle/war-table-hud.png");
    this.load.image("base-player", "/assets/battlefield-objects/base-player.png");
    this.load.image("base-enemy", "/assets/battlefield-objects/base-enemy.png");
    this.load.image("tower-full", "/assets/battlefield-objects/tower-full.png");
    this.load.image("tower-damaged", "/assets/battlefield-objects/tower-damaged.png");
    this.load.image("tower-critical", "/assets/battlefield-objects/tower-critical.png");
    this.load.image("tower-ruin-asset", "/assets/battlefield-objects/tower-ruin.png");
    this.load.image("tower-build", "/assets/battlefield-objects/tower-build.png");
    this.load.image("fixed-fortress-v1", "/assets/battlefield-objects/fixed-fortress-v1.png");
    this.load.image("rock-cluster", "/assets/battlefield-objects/rock-cluster.png");
    this.load.image("tree-cluster", "/assets/battlefield-objects/tree-cluster.png");
    this.load.image("stone-slinger-unit", "/assets/lane-units/stone-slinger-unit.png");
    this.load.image("stone-axeman-unit", "/assets/lane-units/stone-axeman-unit.png");
    this.load.image("stone-supply-unit", "/assets/lane-units/stone-supply-unit.png");
    UNIT_ANIMATION_ASSETS.forEach((asset) => this.load.image(asset.key, asset.path));
    PROTOTYPE_TERRAIN_ASSETS.forEach((asset) => this.load.image(asset.key, asset.path));
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

    this.createUnitTokenTextures();
    this.createUiIconTextures();

    this.player = createTeamState("player", makeResourceMap(60, 40, 18, 18), PLAYER_BASE_HP);
    this.enemy = createTeamState("enemy", makeResourceMap(60, 40, 18, 18), ENEMY_BASE_HP);

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
    this.tickCapturePoints(deltaSec);
    this.updateAudioState();
    this.refreshUi();
    this.publishDebug();
    this.updateAudioDebugOverlay();
  }

  private createUnitTokenTextures(): void {
    if (this.textures.exists("token-axe")) return;

    const defs: Array<{ key: UnitTextureKey; draw: (g: Phaser.GameObjects.Graphics) => void }> = [
      {
        key: "token-axe",
        draw: (g) => {
          g.fillStyle(0xffffff, 1).fillCircle(24, 24, 12);
          g.fillTriangle(15, 14, 33, 24, 15, 34);
        },
      },
      {
        key: "token-spear",
        draw: (g) => {
          g.fillStyle(0xffffff, 1).fillRoundedRect(13, 14, 22, 20, 7);
          g.lineStyle(4, 0xffffff, 1).beginPath().moveTo(24, 10).lineTo(24, 36).strokePath();
        },
      },
      {
        key: "token-ranged",
        draw: (g) => {
          g.fillStyle(0xffffff, 1).fillCircle(24, 24, 11);
          g.fillTriangle(12, 24, 34, 14, 34, 34);
        },
      },
      {
        key: "token-elite",
        draw: (g) => {
          g.fillStyle(0xffffff, 1).fillCircle(24, 24, 13);
          g.fillStyle(0xffffff, 1).fillTriangle(24, 7, 14, 24, 34, 24);
          g.fillRect(21, 24, 6, 11);
        },
      },
      {
        key: "token-support",
        draw: (g) => {
          g.fillStyle(0xffffff, 1).fillRoundedRect(12, 16, 24, 16, 5);
          g.fillCircle(16, 34, 4);
          g.fillCircle(32, 34, 4);
          g.lineStyle(3, 0xffffff, 1).beginPath().moveTo(24, 10).lineTo(24, 24).moveTo(17, 17).lineTo(31, 17).strokePath();
        },
      },
    ];

    defs.forEach(({ key, draw }) => {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, 48, 48);
      g.destroy();
    });
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

    const control = {
      setEnabled: (enabled: boolean) => this.setTerrainMode(enabled ? "prototype" : "legacy", false),
      toggle: () => this.setTerrainMode(this.terrainMode === "legacy" ? "prototype" : "legacy", false),
      setMode: (mode: TerrainRenderMode) => this.setTerrainMode(mode, false),
      focusCentral: () => this.focusCentralCapture(),
      focusProgress: (progress: number) => {
        const focus = this.progressToScreen(Phaser.Math.Clamp(progress, 0, 1), 0);
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
        const focus = this.progressToScreen(point.progress, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshCapturePointVisuals();
        this.refreshUi();
        this.publishDebug();
      },
      setAttackVisualPhase: (
        unitId: BattleUnitId | SupportUnitId,
        team: TeamId,
        phase: number,
      ) => {
        const unit = this.units.find((entry) => entry.unitId === unitId && entry.team === team);
        if (!unit) return;
        unit.attackAnimTime = ATTACK_VISUAL_DURATION_SEC * (1 - Phaser.Math.Clamp(phase, 0, 1));
        unit.attackFacingLockSec = unit.attackAnimTime;
        this.syncUnitPresentation(unit);
        this.publishDebug();
      },
      prepareUnitPoseGallery: (unitId: BattleUnitId | SupportUnitId) => {
        const definition = getUnitAnimationDefinition(unitId);
        if (!definition) return;
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        const textures = [
          definition.idle,
          definition.walkA,
          definition.walkB,
          definition.attack[definition.attack.length - 1] ?? definition.idle,
        ];
        textures.forEach((texture, index) => {
          this.spawnLaneUnit(
            "player",
            unitId === "supply_wagon" ? "support" : "battle",
            unitId,
            0.46 + index * 0.027,
            (index - 1.5) * 1.8,
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
      prepareBronzeWaveProbe: () => {
        this.units.forEach((unit) => this.destroyUnitPresentation(unit));
        this.units = [];
        this.player.ageId = "bronze";
        this.spawnWaveUnits(this.player, getWaveRoster("bronze"), 0.5);
        this.units.forEach((unit) => {
          unit.attackTimerSec = 10;
          this.syncUnitPresentation(unit);
        });
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.publishDebug();
      },
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
        this.spawnLaneUnit("enemy", "battle", "stone_axeman", tower.progress + 0.065, 0);
        this.tickWatchtower(tower, 0);
        this.activeProjectiles.forEach((projectile) => setLaneProjectileProgress(projectile, 0.45));
        const focus = this.progressToScreen(tower.progress, 0);
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
        this.spawnLaneUnit("player", "battle", unitId, point.progress - offset, 0);
        const unit = this.units[0];
        unit.attackTimerSec = 0;
        const focus = this.progressToScreen(point.progress - 0.018, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.refreshCapturePointVisuals();
        this.publishDebug();
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
        this.publishDebug();
      },
      stepOccupancyProbe: (deltaSec: number, steps: number) => {
        const step = Phaser.Math.Clamp(deltaSec, 0, 0.1);
        const count = Phaser.Math.Clamp(Math.floor(steps), 0, 600);
        for (let index = 0; index < count; index += 1) {
          this.tickCombat(step);
        }
        this.units.forEach((unit) => this.syncUnitPresentation(unit));
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
        unit.facingX = direction === 1 ? -1 : 1;
        const start = this.progressToScreen(unit.visualProgress, unit.visualLaneRow);
        unit.lastPresentationX = start.x;
        unit.lastPresentationY = start.y;
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.syncUnitPresentation(unit);
        this.publishDebug();
      },
      stepDirectionProbe: () => {
        const unit = this.units.find((entry) => entry.unitId === "stone_axeman" && entry.team === "player" && entry.sprite.visible);
        if (!unit) return;
        this.syncUnitVisual(unit);
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
        const support = this.units.find((unit) => unit.unitId === "supply_wagon" && unit.team === "player");
        if (!support) return;
        const allies = this.units.filter((unit) => unit.team === "player" && unit.role === "battle").slice(0, 3);
        support.progress = 0.5;
        support.laneRow = 0;
        support.visualProgress = 0.5;
        support.visualLaneRow = 0;
        support.manaCurrent = support.manaMax;
        support.attackTimerSec = 0;
        allies.forEach((ally, index) => {
          ally.progress = 0.5 + (index - 1) * 0.008;
          ally.laneRow = (index - 1) * 1.6;
          ally.visualProgress = ally.progress;
          ally.visualLaneRow = ally.laneRow;
          ally.hp = Math.max(1, ally.maxHp - 12);
        });
        this.units.forEach((unit) => this.setUnitPresentationVisible(unit, unit === support || allies.includes(unit)));
        [...allies, support].forEach((unit) => this.syncUnitPresentation(unit));
        const focus = this.progressToScreen(0.5, 0);
        this.cameras.main.centerOn(focus.x, focus.y);
        this.publishDebug();
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
      LANE_BATTLEFIELD_MAP_SPEC,
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
      LANE_BATTLEFIELD_MAP_SPEC,
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

    this.capturePoints = CAPTURE_POINT_DEFINITIONS.map((definition) => {
      const { id: index, progress } = definition;
      const pos = this.progressToScreen(progress, 0);
      const ring = this.add.circle(pos.x, pos.y, 34, 0xf3cc6a, 0.2)
        .setDepth(this.getGroundDepth(pos.y, -6))
        .setStrokeStyle(4, 0xf8e2a5, 0.55);
      const core = this.add.circle(pos.x, pos.y, 14, 0xf8e2a5, 0.78)
        .setDepth(this.getGroundDepth(pos.y, -5));
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
      label.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));

      return {
        id: index,
        definition,
        progress,
        owner: "neutral",
        control: 0,
        buildingId: undefined,
        buildingLevel: 0,
        incomeTimerSec: 0,
        supplyTimerSec: 0,
        ring,
        core,
        label,
        ownerText,
        buildingText,
      };
    });

    this.defenseTowers = DEFENSE_TOWER_DEFINITIONS.map((definition) => {
      const pos = this.progressToScreen(definition.progress, 0);
      const sprite = this.add.image(pos.x, pos.y, "tower-full")
        .setDisplaySize(TOWER_W, TOWER_H)
        .setOrigin(0.5, TOWER_IMAGE_GROUND_ORIGIN_Y)
        .setDepth(this.getGroundDepth(pos.y));
      const selectionHitZone = this.add.zone(pos.x, pos.y, TOWER_W, TOWER_H)
        .setOrigin(0.5, TOWER_IMAGE_GROUND_ORIGIN_Y)
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
      return {
        id: definition.id,
        definition,
        progress: definition.progress,
        owner: definition.owner,
        attackTimerSec: 0,
        buildRemainingSec: 0,
        built: true,
        maxHp,
        hp: maxHp,
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

    const playerBase = this.progressToScreen(0, 0);
    const enemyBase = this.progressToScreen(1, 0);
    this.add.image(playerBase.x, playerBase.y, "base-player")
      .setDisplaySize(BASE_W, BASE_H)
      .setOrigin(0.5, 0.84)
      .setDepth(this.getGroundDepth(playerBase.y));
    this.add.image(enemyBase.x, enemyBase.y, "base-enemy")
      .setDisplaySize(BASE_W, BASE_H)
      .setOrigin(0.5, 0.84)
      .setDepth(this.getGroundDepth(enemyBase.y));
    this.add.text(playerBase.x - 8, playerBase.y - 274, "아군 본진", {
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      color: "#dceeff",
      stroke: "#16202a",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(this.getGroundDepth(playerBase.y, 4));
    this.add.text(enemyBase.x + 4, enemyBase.y - 274, "적 본진", {
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      color: "#ffe1e1",
      stroke: "#2a1616",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(this.getGroundDepth(enemyBase.y, 4));
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
        buildSupplyDepot: () => this.tryBuildAtSelectedPoint("supply_depot"),
        buildMint: () => this.tryBuildAtSelectedPoint("mint"),
        dismantle: () => this.tryDismantleSelectedPoint(),
        onAudioSettingsVisibilityChange: (visible) => {
          this.audioSettingsOpen = visible;
        },
      },
      CANVAS_W,
      CANVAS_H,
      DEPTH_UI,
      QUERY_PARAMS.get("audioDebug") === "1",
    );
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
        if (unit.attackTimerSec <= 0) {
          unit.attackTimerSec = unit.attackCooldownSec;
          this.playWorldSfx(
            this.isRangedUnit(unit) ? "sfx.combat.rangedFire" : "sfx.combat.meleeAttack",
            unit.sprite.x,
            unit.sprite.y,
            `attack:${unit.id}:tower:${enemyTower.id}:${Math.round(this.elapsedSec * 1000)}`,
          );
          const damageBase = unit.attack * (1 - unit.attrition);
          const damage = Math.max(1, Math.round(damageBase));
          if (this.isRangedUnit(unit)) {
            const start = this.getUnitProjectileAnchor(unit);
            const end = this.getTowerProjectileAnchor(enemyTower, false);
            this.startRangedAttack(unit, enemyTower.sprite.x, "structure", () => {
              this.launchProjectile(start, end, getProjectileKeyForUnit(unit.unitId), () => this.applyDamageToTower(enemyTower, damage, unit.team), 1.02);
            });
          } else {
            this.startMeleeAttack(unit, enemyTower.sprite.x, "structure", () => {
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
      if (unit.attackTimerSec <= 0) {
        unit.attackTimerSec = unit.attackCooldownSec;
        this.playWorldSfx(
          this.isRangedUnit(unit) ? "sfx.combat.rangedFire" : "sfx.combat.meleeAttack",
          unit.sprite.x,
          unit.sprite.y,
          `attack:${unit.id}:unit:${nearest.id}:${Math.round(this.elapsedSec * 1000)}`,
        );
        const damageBase = unit.attack * (1 - unit.attrition);
        const damage = Math.max(1, Math.round(damageBase - nearest.defense * 0.35));
        if (this.isRangedUnit(unit)) {
          const start = this.getUnitProjectileAnchor(unit);
          const end = this.getUnitProjectileAnchor(nearest);
          this.startRangedAttack(unit, nearest.sprite.x, "unit", () => {
            if (!this.units.includes(nearest)) return;
            this.launchProjectile(start, end, getProjectileKeyForUnit(unit.unitId), () => this.applyDamageToUnit(nearest, damage, unit.team === "player" ? "#ffd67a" : "#ff8f8f"), 1.04);
          });
        } else {
          this.startMeleeAttack(unit, nearest.sprite.x, "unit", () => {
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

    this.units.forEach((unit) => this.syncUnitVisual(unit));
    this.checkBasePressure(deltaSec);
  }

  private tickSupport(unit: LaneUnit, deltaSec: number): void {
    const allies = this.units.filter((other) => other.team === unit.team && other.role === "battle");
    const injured = allies
      .filter((ally) => ally.hp < ally.maxHp && this.unitDistance(unit, ally) <= unit.range * RANGE_TO_PROGRESS)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (injured.length > 0 && unit.attackTimerSec <= 0 && unit.manaCurrent >= unit.healManaCost) {
      unit.attackTimerSec = unit.attackCooldownSec;
      unit.manaCurrent -= unit.healManaCost;
      this.beginAttackPresentation(unit, injured[0].sprite.x, "unit");
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
      if (totalHealed > 0) {
        this.playWorldSfx(
          "sfx.support.heal",
          unit.sprite.x,
          unit.sprite.y,
          `support-heal:${unit.id}:${Math.round(this.elapsedSec * 1000)}`,
        );
        this.spawnToast(`치유 ${totalHealed}`, unit.sprite.x, unit.sprite.y - 44, "#92f1a5");
      }
      return;
    }

    const allyFront = allies.sort((a, b) => (unit.team === "player" ? b.progress - a.progress : a.progress - b.progress))[0];
    if (allyFront) {
      const desired = unit.team === "player" ? allyFront.progress - 0.06 : allyFront.progress + 0.06;
      if ((unit.team === "player" && unit.progress < desired) || (unit.team === "enemy" && unit.progress > desired)) {
        this.advanceUnit(unit, deltaSec);
      }
    } else {
      this.advanceUnit(unit, deltaSec);
    }
  }

  private beginAttackPresentation(unit: LaneUnit, targetX: number, targetKind: AttackTargetKind): void {
    unit.attackAnimTime = ATTACK_VISUAL_DURATION_SEC;
    unit.attackFacingLockSec = ATTACK_VISUAL_DURATION_SEC;
    unit.attackTargetKind = targetKind;
    this.engagedUnitIds.add(unit.id);
    const deltaX = targetX - unit.sprite.x;
    if (Math.abs(deltaX) > FACING_DEAD_ZONE_WORLD_PX) unit.facingX = deltaX >= 0 ? 1 : -1;
  }

  private startMeleeAttack(
    unit: LaneUnit,
    targetX: number,
    targetKind: AttackTargetKind,
    onContact: () => void,
  ): void {
    this.beginAttackPresentation(unit, targetX, targetKind);
    const sequence = ++unit.attackSequence;
    this.time.delayedCall(ATTACK_VISUAL_DURATION_SEC * 500, () => {
      if (!this.units.includes(unit) || unit.attackSequence !== sequence) return;
      onContact();
    });
  }

  private startRangedAttack(
    unit: LaneUnit,
    targetX: number,
    targetKind: AttackTargetKind,
    onRelease: () => void,
  ): void {
    this.beginAttackPresentation(unit, targetX, targetKind);
    const sequence = ++unit.attackSequence;
    this.time.delayedCall(ATTACK_VISUAL_DURATION_SEC * 280, () => {
      if (!this.units.includes(unit) || unit.attackSequence !== sequence) return;
      onRelease();
    });
  }

  private advanceUnit(unit: LaneUnit, deltaSec: number, combatTarget?: LaneUnit): void {
    const dir = unit.team === "player" ? 1 : -1;
    if (combatTarget && this.isMeleeUnit(unit)) {
      const slot = this.findCombatSlot(unit, combatTarget);
      if (slot) {
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
      .filter((other) => other.id !== unit.id && other.team === unit.team && Math.abs(other.laneRow - unit.laneRow) < 0.5)
      .filter((other) => (unit.team === "player" ? other.progress > unit.progress : other.progress < unit.progress))
      .sort((a, b) => progressBetween(a.progress, unit.progress) - progressBetween(b.progress, unit.progress))[0];

    if (friendAhead) {
      const nextGap = progressBetween(friendAhead.progress, desired);
      if (nextGap < FRIENDLY_GAP) {
        if (!this.tryShiftLane(unit, enemyAhead)) {
          const packedDesired = unit.team === "player"
            ? Math.min(desired, friendAhead.progress - 0.006)
            : Math.max(desired, friendAhead.progress + 0.006);
          unit.progress = Phaser.Math.Clamp(packedDesired, 0.01, 0.99);
          this.keepUnitInPlayableLane(unit);
          return;
        }
      }
    }

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
    return !this.units.some((other) => other.id !== unit.id && other.team === unit.team && Math.abs(other.laneRow - laneRow) < COMBAT_ROW_CLEARANCE && progressBetween(other.progress, unit.progress) < FRIENDLY_GAP);
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
      progressBetween(other.progress, slot.progress) < COMBAT_PROGRESS_CLEARANCE &&
      Math.abs(other.laneRow - slot.laneRow) < COMBAT_ROW_CLEARANCE,
    );
  }

  private moveToward(current: number, target: number, maxDelta: number): number {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + Math.sign(target - current) * maxDelta;
  }

  private findNearestEnemy(unit: LaneUnit): LaneUnit | undefined {
    return this.units
      .filter((other) => other.team !== unit.team)
      .sort((a, b) => this.unitDistance(unit, a) - this.unitDistance(unit, b))[0];
  }

  private findNearestEnemyTower(unit: LaneUnit): DefenseTowerState | undefined {
    return this.defenseTowers
      .filter((tower) => tower.owner !== unit.team && tower.built)
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
      const nearbyPlayer = this.units.filter((unit) => unit.team === "player" && progressBetween(unit.progress, point.progress) <= CAPTURE_RADIUS_PROGRESS).length;
      const nearbyEnemy = this.units.filter((unit) => unit.team === "enemy" && progressBetween(unit.progress, point.progress) <= CAPTURE_RADIUS_PROGRESS).length;
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
        tower.maxHp = getDefenseTowerMaxHp(tower.owner === "player" ? this.player.ageId : this.enemy.ageId);
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
    if (!tower.built) return;
    tower.attackTimerSec -= deltaSec;
    if (tower.attackTimerSec > 0) return;
    const spec = createTowerAttackPattern(tower.owner === "player" ? this.player.ageId : this.enemy.ageId);
    const target = this.units
      .filter((unit) => unit.team !== tower.owner && progressBetween(unit.progress, tower.progress) <= spec.rangeProgress)
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

  private tickSupplyDepot(point: CapturePointState, deltaSec: number): void {
    point.supplyTimerSec -= deltaSec;
    if (point.owner === "neutral" || point.supplyTimerSec > 0) return;
    const ally = this.units
      .filter((unit) => unit.team === point.owner && progressBetween(unit.progress, point.progress) <= CAPTURE_RADIUS_PROGRESS)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!ally) return;
    point.supplyTimerSec = 1.5;
    ally.hp = Math.min(ally.maxHp, ally.hp + 4 + point.buildingLevel * 2);
    ally.attrition = Math.max(0, ally.attrition - (0.05 + point.buildingLevel * 0.02));
    this.spawnToast("보급", ally.sprite.x, ally.sprite.y - 28, "#92f1a5");
  }

  private tickMint(point: CapturePointState, deltaSec: number): void {
    point.incomeTimerSec -= deltaSec;
    if (point.owner === "neutral" || point.incomeTimerSec > 0) return;
    point.incomeTimerSec = 4;
    const team = point.owner === "player" ? this.player : this.enemy;
    const gain = 1 + point.buildingLevel;
    team.resources.gold += gain;
    if (point.owner === "player") this.spawnToast(`+${gain}G`, point.core.x, point.core.y - 28, "#f4d35e");
  }

  private selectCapturePoint(id: number): void {
    this.selectedCapturePointId = id;
    this.selectedDefenseTowerId = null;
    this.audio.playSfx("sfx.ui.buildSelect", { eventKey: `capture:select:${id}` });
    this.refreshCapturePointVisuals();
    this.refreshUi();
  }

  private selectDefenseTower(id: number): void {
    this.selectedDefenseTowerId = id;
    this.selectedCapturePointId = null;
    this.audio.playSfx("sfx.ui.buildSelect", { eventKey: `tower:select:${id}` });
    this.refreshCapturePointVisuals();
    this.refreshDefenseTowerVisuals();
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
    if (!canAfford(this.player.resources, building.cost)) {
      this.hud.setInfo(`${building.label} 건설 자원 부족`);
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: `build:${point.id}:shortage:${buildingId}` });
      return;
    }
    payCost(this.player.resources, building.cost);
    point.buildingId = buildingId;
    point.buildingLevel = 1;
    point.incomeTimerSec = 4;
    point.supplyTimerSec = 0.4;
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
    if (!canAfford(this.enemy.resources, choice.cost)) return;
    payCost(this.enemy.resources, choice.cost);
    target.buildingId = choice.id;
    target.buildingLevel = 1;
    target.incomeTimerSec = 4;
    target.supplyTimerSec = 0.4;
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
      const rawPos = this.progressToScreen(point.progress, 0);
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
      point.ownerText.setText(point.owner === "player" ? "아군 점령" : point.owner === "enemy" ? "적 점령" : "중립");
      point.ownerText.setColor(point.owner === "player" ? "#cfeeff" : point.owner === "enemy" ? "#ffd8d8" : "#eadfb3");
      const labelY = pos.y - (this.isPrototypeV2() ? this.cssPxToWorld(36) : 40);
      const ownerY = pos.y + (this.isPrototypeV2() ? this.cssPxToWorld(18) : 28);
      const buildingY = pos.y + (this.isPrototypeV2() ? this.cssPxToWorld(36) : 46);
      point.label
        .setText(`건설 거점 ${point.id + 1}`)
        .setPosition(pos.x, labelY)
        .setDepth(this.getGroundDepth(pos.y, 7));
      point.ownerText.setPosition(pos.x, ownerY).setDepth(this.getGroundDepth(pos.y, 7));
      point.buildingText.setPosition(pos.x, buildingY).setDepth(this.getGroundDepth(pos.y, 7));
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
      const ownerColor = tower.owner === "player" ? 0x61c3ff : 0xff7f7f;
      const rawPos = this.progressToScreen(tower.progress, 0);
      const pos = this.isPrototypeV2() ? this.snapWorldPointToCanvasPixel(rawPos.x, rawPos.y) : rawPos;
      const selectedScale = this.isPrototypeV2() ? 1 : selected ? 1.04 : 1;
      const towerHeight = this.isPrototypeV2()
        ? this.cssPxToWorld(this.scaleVisualConfig.captureTowerCssHeight / TOWER_IMAGE_VISIBLE_HEIGHT_RATIO) * selectedScale
        : TOWER_H * selectedScale;
      const towerWidth = this.isPrototypeV2()
        ? towerHeight * (tower.sprite.frame.realWidth / tower.sprite.frame.realHeight)
        : TOWER_W * selectedScale;
      const hpRatio = tower.maxHp > 0 ? tower.hp / tower.maxHp : 0;
      const texture = tower.buildRemainingSec > 0
        ? "tower-build"
        : !tower.built
          ? "tower-ruin-asset"
          : hpRatio > 0.66 ? "tower-full" : hpRatio > 0.33 ? "tower-damaged" : "tower-critical";
      tower.sprite
        .setTexture(texture)
        .setPosition(pos.x, pos.y)
        .setOrigin(0.5, TOWER_IMAGE_GROUND_ORIGIN_Y)
        .setDisplaySize(towerWidth, towerHeight)
        .setDepth(this.getGroundDepth(pos.y))
        .setAlpha(tower.buildRemainingSec > 0 ? 0.45 : 1)
        .clearTint();
      if (tower.owner === "enemy" && tower.built) tower.sprite.setTint(0xffd0d0);
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
        .setText(tower.buildRemainingSec > 0 ? `재건 ${Math.ceil(tower.buildRemainingSec)}초` : tower.built ? "가동 중" : "파괴됨");
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
    return new Phaser.Math.Vector2(
      point.sprite.x,
      point.sprite.y - (
        this.terrainPrototypeEnabled
          ? point.sprite.displayHeight * TOWER_IMAGE_VISIBLE_HEIGHT_RATIO * (launch ? 0.72 : 0.48)
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
    point.hp = Math.max(0, point.hp - damage);
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
    this.spawnToast(`${damage}`, point.sprite.x, point.sprite.y - 58, attackerTeam === "player" ? "#ffd67a" : "#ff8f8f");
    if (point.hp <= 0) {
      point.built = false;
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
    const target = this.progressToScreen(targetProgress, 0);
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
      this.startRangedAttack(unit, target.x, "structure", () => {
        this.launchProjectile(start, end, getProjectileKeyForUnit(unit.unitId), applyDamage, 1.05);
      });
    } else {
      this.startMeleeAttack(unit, target.x, "structure", applyDamage);
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
      const gain = Math.round(getAgeBalance(this.enemy.ageId).killGoldBase);
      this.player.resources.gold += gain;
      this.spawnToast(`+${gain}G`, 108, 156, "#f4d35e");
    } else {
      this.enemy.resources.gold += Math.round(getAgeBalance(this.player.ageId).killGoldBase);
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

    commitWaveDeployment(team, plan.foodCost);
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
      this.spawnLaneUnit(team, role, unitId, progress, laneRow);
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
      const visual = this.progressToScreen(unit.visualProgress, unit.visualLaneRow);
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
    const battleRows = [-3, 0, 3];
    const spawnProgress = overrideSpawnProgress ?? (team.id === "player" ? 0.06 : 0.94);
    let index = 0;
    roster.battleline.forEach((entry) => {
      for (let i = 0; i < entry.count; i++) {
        this.spawnLaneUnit(team.id, "battle", entry.unitId, spawnProgress, battleRows[index % battleRows.length]);
        index += 1;
      }
    });
    roster.support.forEach((entry) => {
      for (let i = 0; i < entry.count; i++) {
        this.spawnLaneUnit(team.id, "support", entry.unitId, team.id === "player" ? spawnProgress - 0.02 : spawnProgress + 0.02, 0);
      }
    });
  }

  private spawnLaneUnit(team: TeamId, role: "battle" | "support", unitId: BattleUnitId | SupportUnitId, progress: number, laneRow: number): void {
    const stats = UNIT_STATS[unitId];
    const teamAgeId = team === "player" ? this.player.ageId : this.enemy.ageId;
    const pos = this.progressToScreen(progress, laneRow);
    const displaySize = role === "support" ? 86 : 76;
    const initialTextureKey = resolveUnitAnimationTexture(unitId, false, 0, 0) ?? stats.textureKey;
    const shadow = this.add.ellipse(pos.x, pos.y + 22, role === "support" ? 56 : 46, role === "support" ? 20 : 16, 0x000000, 0.2)
      .setDepth(this.getGroundDepth(pos.y, -1));
    const selectionRing = this.add.ellipse(pos.x, pos.y, 62, 24, 0x72c8ff, 0.12)
      .setStrokeStyle(3, team === "player" ? 0x8bd7ff : 0xffa0a0, 0.9)
      .setDepth(this.getGroundDepth(pos.y, -2))
      .setVisible(false);
    const sprite = this.add.image(pos.x, pos.y, initialTextureKey).setDepth(this.getGroundDepth(pos.y));
    sprite.setDisplaySize(displaySize, displaySize);
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

    const supportProfile = getSupportResourceProfile(teamAgeId);

    const unit: LaneUnit = {
      id: nextUnitId++,
      team,
      role,
      unitId,
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
      currentTextureKey: initialTextureKey,
      facingX: team === "player" ? 1 : -1,
      lastPresentationX: pos.x,
      lastPresentationY: pos.y,
      motionX: 0,
      motionY: 0,
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
      })
      .on("pointerout", () => {
        unit.hovered = false;
        this.syncUnitPresentation(unit);
      })
      .on("pointerdown", () => {
        this.units.forEach((entry) => {
          entry.selected = entry.id === unit.id ? !entry.selected : false;
          this.syncUnitPresentation(entry);
        });
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

  private syncUnitVisual(unit: LaneUnit): void {
    unit.visualProgress = Phaser.Math.Linear(unit.visualProgress, unit.progress, 0.22);
    unit.visualLaneRow = Phaser.Math.Linear(unit.visualLaneRow, unit.laneRow, 0.18);
    this.syncUnitPresentation(unit);
  }

  private shouldShowV2UnitLabel(unit: LaneUnit): boolean {
    const policy = this.scaleVisualConfig.unitLabelPolicy;
    if (policy === "always") return true;
    if (unit.selected || unit.hovered) return true;
    if (policy !== "priority" || unit.role !== "support") return false;

    const unitPos = this.progressToScreen(unit.visualProgress, unit.visualLaneRow);
    return !this.units.some((other) => {
      if (other.id >= unit.id || other.team !== unit.team || other.role !== "support") return false;
      const otherPos = this.progressToScreen(other.visualProgress, other.visualLaneRow);
      const screenDistance = Phaser.Math.Distance.Between(unitPos.x, unitPos.y, otherPos.x, otherPos.y)
        * this.cameras.main.zoom;
      return screenDistance < 86;
    });
  }

  private syncUnitPresentation(unit: LaneUnit): void {
    const rawPos = this.progressToScreen(unit.visualProgress, unit.visualLaneRow);
    const pos = this.isPrototypeV2()
      ? this.snapWorldPointToCanvasPixel(rawPos.x, rawPos.y)
      : rawPos;
    const moving = progressBetween(unit.progress, unit.visualProgress) > 0.0008;
    const attackProgress = unit.attackAnimTime > 0
      ? 1 - unit.attackAnimTime / ATTACK_VISUAL_DURATION_SEC
      : 0;
    const gait = this.elapsedSec * 10 + unit.bobPhase;
    const desiredTexture = unit.presentationOverrideTexture ?? resolveUnitAnimationTexture(
      unit.unitId,
      moving,
      Math.sin(this.elapsedSec * 9 + unit.bobPhase),
      attackProgress,
    ) ?? UNIT_STATS[unit.unitId].textureKey;
    if (desiredTexture !== unit.currentTextureKey) {
      unit.currentTextureKey = desiredTexture;
      unit.sprite.setTexture(desiredTexture);
    }
    unit.motionX = pos.x - unit.lastPresentationX;
    unit.motionY = pos.y - unit.lastPresentationY;
    if (
      unit.attackFacingLockSec <= 0
      && Math.abs(unit.motionX) > FACING_DEAD_ZONE_WORLD_PX
    ) {
      unit.facingX = unit.motionX >= 0 ? 1 : -1;
    }
    unit.lastPresentationX = pos.x;
    unit.lastPresentationY = pos.y;

    const bob = moving ? Math.sin(gait) * 1.1 : Math.sin(this.elapsedSec * 4 + unit.bobPhase) * 0.35;
    const attackMotion = resolveAttackMotion({
      role: unit.role,
      melee: this.isMeleeUnit(unit),
      ranged: this.isRangedUnit(unit),
      targetKind: unit.attackTargetKind,
      progress: attackProgress,
      facing: unit.facingX,
    });
    const attackOffsetX = attackMotion.offsetX;
    const attackLift = attackMotion.lift;
    const legacyScale = unit.role === "support" ? 1.08 : 1;
    const frameAspect = unit.sprite.frame.realHeight > 0
      ? unit.sprite.frame.realWidth / unit.sprite.frame.realHeight
      : 1;
    const targetVisibleCssHeight = unit.role === "support"
      ? this.scaleVisualConfig.supportUnitCssHeight
      : unit.unitId === "knight"
        ? this.scaleVisualConfig.largeUnitCssHeight
        : this.scaleVisualConfig.normalUnitCssHeight * getUnitScaleFactor(unit.unitId);
    const targetVisibleWorldHeight = this.isPrototypeV2()
      ? this.cssPxToWorld(targetVisibleCssHeight)
      : unit.role === "support" ? 118 : 112;
    const framePresentation = resolveUnitFramePresentation(
      unit.unitId,
      targetVisibleWorldHeight,
      frameAspect,
      desiredTexture,
    );
    const spriteWidth = this.terrainPrototypeEnabled
      ? framePresentation.spriteWidth
      : unit.displaySize * legacyScale;
    const spriteHeight = this.terrainPrototypeEnabled
      ? framePresentation.spriteHeight
      : unit.displaySize * legacyScale;
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
      ? Math.max(38, spriteWidth * 0.88)
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
    unit.selectionRing
      .setPosition(pos.x, pos.y + 3)
      .setSize(Math.max(52, spriteWidth * 1.08), Math.max(20, shadowHeight * 1.45))
      .setDepth(this.getGroundDepth(pos.y, -2))
      .setVisible(this.isPrototypeV2() && (unit.selected || unit.hovered));
    unit.sprite
      .setPosition(pos.x + attackOffsetX, pos.y - bob - attackLift)
      .setOrigin(originX, originY)
      .setRotation(attackMotion.rotationRad)
      .setFlipX(unit.facingX < 0)
      .setDisplaySize(spriteWidth, spriteHeight)
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
        .setVisible(true)
        .setScale(1)
        .setStroke("#132033", 3)
        .setShadow(0, 0, "#000000", 0, false, false)
        .setBackgroundColor("rgba(0, 0, 0, 0)")
        .setPadding(0);
    }
  }

  private shiftWorker(role: WorkerRole, delta: 1 | -1): void {
    if (role === "idle") {
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
    if (!canAfford(this.player.resources, BASE_WORKER_COST)) {
      this.hud.setInfo("일꾼 고용 실패: 금/목재/식량 부족");
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: "hire:worker:shortage" });
      return;
    }
    payCost(this.player.resources, BASE_WORKER_COST);
    this.player.workers.idle += 1;
    this.hud.setInfo("일꾼 1명을 고용했습니다");
    this.audio.playSfx("sfx.ui.hireSuccess", { eventKey: `hire:worker:${this.player.workers.idle}` });
  }

  private hireResearchWorker(): void {
    if (canAfford(this.player.resources, RESEARCH_WORKER_DIRECT_COST)) {
      payCost(this.player.resources, RESEARCH_WORKER_DIRECT_COST);
      this.player.workers.research += 1;
      this.hud.setInfo("연구 일꾼을 직접 고용했습니다");
      this.audio.playSfx("sfx.ui.hireSuccess", { eventKey: `hire:research:direct:${this.player.workers.research}` });
      return;
    }

    if (convertWorkersToResearch(
      this.player.workers,
      RESEARCH_WORKER_CONVERSION.workerCount,
      RESEARCH_WORKER_CONVERSION.resultCount,
    )) {
      this.hud.setInfo("일반 일꾼 10명을 연구 일꾼으로 전환했습니다");
      this.audio.playSfx("sfx.ui.hireSuccess", { eventKey: `hire:research:convert:${this.player.workers.research}` });
      return;
    }

    this.hud.setInfo("연구 일꾼 조건 미달");
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
      if (team.id === "player") this.hud.setInfo("직전 웨이브 후 10초 뒤 사용 가능");
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
    if (!canAfford(this.player.resources, cost)) {
      this.hud.setInfo("시대 업 실패: 금/목재/금속 부족");
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: "age:shortage" });
      return;
    }
    payCost(this.player.resources, cost);
    this.advanceAge(this.player);
    this.hud.setInfo(`${getAge(this.player.ageId).label} 도달`);
    this.audio.playSfx("sfx.ui.confirm", { eventKey: `age:${this.player.ageId}` });
  }

  private advanceAge(team: TeamState): void {
    if (!advanceTeamAge(team)) return;
    if (getAge(team.ageId).immediateWaveTokenGranted) this.grantInstantWaveToken(team);
    if (team.id === "player") this.refreshUi();
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
  }

  private publishDebug(): void {
    (window as unknown as { __gameDebug: unknown }).__gameDebug = this.createVerificationSnapshot();
  }

  private createVerificationSnapshot(): Record<string, unknown> {
    return {
      phase: "lane-siege",
      elapsedSec: this.elapsedSec,
      player: {
        ageId: this.player.ageId,
        resources: this.player.resources,
        workers: this.player.workers,
        baseHp: this.player.baseHp,
        nextWaveInSec: this.player.nextWaveInSec,
      },
      enemy: {
        ageId: this.enemy.ageId,
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
        progress: unit.progress,
        laneRow: unit.laneRow,
        hp: unit.hp,
        maxHp: unit.maxHp,
        facingX: unit.facingX,
        flipX: unit.sprite.flipX,
        tint: unit.sprite.tintTopLeft,
        motion: { x: unit.motionX, y: unit.motionY },
        pose: unit.currentTextureKey,
        attackAnimTime: unit.attackAnimTime,
        attackTargetKind: unit.attackTargetKind,
        manaCurrent: unit.manaCurrent,
        manaMax: unit.manaMax,
        manaRegenPerSec: unit.manaRegenPerSec,
        healManaCost: unit.healManaCost,
        healPower: unit.healPower,
      })),
      battlefield: {
        capturePoints: this.battlefield.capturePoints,
        controlPoints: this.capturePoints.map((point) => ({
          id: point.id,
          pointType: point.definition.pointType,
          allowedBuildingTypes: point.definition.allowedBuildingTypes,
          owner: point.owner,
          control: point.control,
          progress: point.progress,
          worldX: point.core.x,
          worldY: point.core.y,
          labelWorldX: point.label.x,
          labelWorldY: point.label.y,
          buildingId: point.buildingId ?? null,
          availableActions: getCapturePointActions(point.definition, point),
        })),
        defenseTowers: this.defenseTowers.map((tower) => ({
          id: tower.id,
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
      },
      ui: {
        selectedCapturePointId: this.selectedCapturePointId,
        selectedDefenseTowerId: this.selectedDefenseTowerId,
        visibleCaptureActions: this.hud.getVisibleCaptureActions(),
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
          mapSpecId: LANE_BATTLEFIELD_MAP_SPEC.id,
          patchCount: LANE_BATTLEFIELD_MAP_SPEC.terrainPatches.length,
          cellCount: LANE_BATTLEFIELD_MAP_SPEC.terrainPatches.reduce(
            (total, patch) => total + patch.cells.length,
            0,
          ),
          structureSocketCount: LANE_BATTLEFIELD_MAP_SPEC.structureSockets.length,
          propGrounding: LANE_BATTLEFIELD_MAP_SPEC.terrainProps.map((prop) => ({
            id: prop.id,
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
            facingX: unit.facingX,
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
              * TOWER_IMAGE_VISIBLE_HEIGHT_RATIO
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
                * TOWER_IMAGE_VISIBLE_HEIGHT_RATIO
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

  private progressToScreen(progress: number, laneRow: number): Phaser.Math.Vector2 {
    const clampedProgress = Phaser.Math.Clamp(progress, 0, 1);
    const endIndex = Math.max(
      1,
      this.lanePath.findIndex((node) => node.progress >= clampedProgress),
    );
    const startNode = this.lanePath[endIndex - 1];
    const endNode = this.lanePath[endIndex] ?? this.lanePath[this.lanePath.length - 1];
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
