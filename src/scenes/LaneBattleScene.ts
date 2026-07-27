import Phaser from "phaser";
import { AGES, getAge, type AgeId } from "../data/ages";
import {
  BASE_FOOD_REGEN_PER_SEC,
  BASE_RESOURCE_TICK_SEC,
  BASE_WORKER_COST,
  getAgeBalance,
  getOpponentScale,
  INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC,
  MVP_ACTIVE_RESOURCE_IDS,
  RESEARCH_WORKER_CONVERSION,
  RESEARCH_WORKER_DIRECT_COST,
  WAVE_INTERVAL_SEC,
  type ResourceCost,
} from "../data/balance";
import { getResource, type ResourceId } from "../data/resources";
import { getWaveRoster, type BattleUnitId, type SupportUnitId } from "../data/unitRosters";
import { LANE_BATTLEFIELD_MAP_SPEC } from "../data/battlefieldMaps";
import {
  getPrototypeScaleConfig,
  getPrototypeVisualConfig,
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
  type CaptureBuildingId,
  type CapturePointAction,
  type CapturePointDefinition,
} from "../data/capturePointDefinitions";
import {
  BattlefieldPrototypeRenderer,
  PROTOTYPE_TERRAIN_ASSETS,
  type StructureGroundPresentation,
} from "../gfx/battlefieldPrototypeRenderer";
import { generateBattlefield, type BattlefieldResult } from "../systems/battlefieldGenerator";
import {
  BattleAudioStateMachine,
  calculateSpatialAudio,
  getAudioSystem,
} from "../systems/audio";
import { AudioSettingsPanel } from "../ui/AudioSettingsPanel";

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
const LANE_ROW_SPACING = 42;
const UNIT_PROGRESS_SPEED = 0.02;
const RANGE_TO_PROGRESS = 0.013;
const FRIENDLY_GAP = 0.013;
const ENGAGE_GAP = 0.022;
const DISMANTLE_COST_GOLD = 8;
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
const UNIT_IMAGE_GROUND_ORIGIN_Y = 0.86;

interface SpriteOpaqueMetrics {
  visibleHeightRatio: number;
  groundOriginY: number;
}

const UNIT_POSE_OPAQUE_METRICS: Record<string, SpriteOpaqueMetrics> = {
  "stone-axeman-attack": { visibleHeightRatio: 673 / 887, groundOriginY: 759 / 887 },
  "stone-axeman-idle": { visibleHeightRatio: 600 / 887, groundOriginY: 755 / 887 },
  "stone-axeman-walk-a": { visibleHeightRatio: 593 / 887, groundOriginY: 755 / 887 },
  "stone-axeman-walk-b": { visibleHeightRatio: 588 / 887, groundOriginY: 759 / 887 },
  "stone-slinger-attack": { visibleHeightRatio: 571 / 887, groundOriginY: 739 / 887 },
  "stone-slinger-idle": { visibleHeightRatio: 620 / 887, groundOriginY: 743 / 887 },
  "stone-slinger-walk-a": { visibleHeightRatio: 587 / 887, groundOriginY: 743 / 887 },
  "stone-slinger-walk-b": { visibleHeightRatio: 568 / 887, groundOriginY: 741 / 887 },
  "stone-supply-attack": { visibleHeightRatio: 513 / 793, groundOriginY: 683 / 793 },
  "stone-supply-idle": { visibleHeightRatio: 601 / 793, groundOriginY: 688 / 793 },
  "stone-supply-walk-a": { visibleHeightRatio: 577 / 793, groundOriginY: 678 / 793 },
  "stone-supply-walk-b": { visibleHeightRatio: 559 / 793, groundOriginY: 683 / 793 },
};

type TeamId = "player" | "enemy";
type WorkerRole = "gold" | "wood" | "food" | "metal" | "research" | "idle";
type WorkerResourceId = "gold" | "wood" | "food" | "metal";
type UnitTextureKey = string;
type BuildingId = CaptureBuildingId;

interface TeamState {
  id: TeamId;
  baseHp: number;
  ageId: AgeId;
  resources: Record<ResourceId, number>;
  workers: Record<WorkerRole, number>;
  instantWaveTokens: number;
  nextWaveInSec: number;
  lastWaveElapsedSec: number;
  pendingBonusWaves: number;
}

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
  healPower: number;
  attrition: number;
  displaySize: number;
  bobPhase: number;
  currentTextureKey: string;
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
  label: Phaser.GameObjects.Text;
  hovered: boolean;
  selected: boolean;
}

interface WorkerUiRow {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  plus: Phaser.GameObjects.Arc;
  minus: Phaser.GameObjects.Arc;
}

interface ActionButton {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

interface UnitStatDef {
  hp: number;
  attack: number;
  defense: number;
  range: number;
  speed: number;
  attackCooldownSec: number;
  healPower?: number;
  label: string;
  textureKey: UnitTextureKey;
  tint: number;
}

interface CombatSlot {
  progress: number;
  laneRow: number;
}

interface TowerAttackSpec {
  projectileKey: string;
  damage: number;
  rangeProgress: number;
  cooldownSec: number;
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
  buildingId?: Exclude<BuildingId, "watchtower">;
  buildingLevel: number;
  incomeTimerSec: number;
  towerTimerSec: number;
  towerBuildRemainingSec: number;
  towerBuilt: boolean;
  towerMaxHp: number;
  towerHp: number;
  supplyTimerSec: number;
  ring: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Arc;
  towerSprite: Phaser.GameObjects.Image;
  towerHpBg: Phaser.GameObjects.Rectangle;
  towerHpFill: Phaser.GameObjects.Rectangle;
  groundPresentation?: StructureGroundPresentation;
  groundPresentationV2?: StructureGroundPresentation;
  label: Phaser.GameObjects.Text;
  ownerText: Phaser.GameObjects.Text;
  buildingText: Phaser.GameObjects.Text;
}

interface BuildingDef {
  id: BuildingId;
  label: string;
  shortLabel: string;
  cost: ResourceCost;
  description: string;
}

let nextUnitId = 1;

const CAPTURE_RADIUS_PROGRESS = 0.06;
const CAPTURE_RATE_PER_SEC = 0.36;
const BUILDINGS: BuildingDef[] = [
  {
    id: "watchtower",
    label: "요새",
    shortLabel: "요새",
    cost: { gold: 10, wood: 10 },
    description: "파괴된 타워 재건축",
  },
  {
    id: "supply_depot",
    label: "병참",
    shortLabel: "병참",
    cost: { gold: 18, wood: 12, food: 10 },
    description: "근처 아군 치유와 보급",
  },
  {
    id: "mint",
    label: "조달소",
    shortLabel: "조달",
    cost: { gold: 16, wood: 10, metal: 8 },
    description: "주기적으로 금 수급",
  },
];

const UNIT_STATS: Record<BattleUnitId | SupportUnitId, UnitStatDef> = {
  stone_slinger: { hp: 26, attack: 7, defense: 2, range: 4.5, speed: 1.05, attackCooldownSec: 1.3, label: "투석", textureKey: "stone-slinger-unit", tint: 0xd4b27c },
  stone_axeman: { hp: 34, attack: 9, defense: 3, range: 1.5, speed: 1.1, attackCooldownSec: 1.0, label: "도끼", textureKey: "stone-axeman-unit", tint: 0xa7b1be },
  bronze_swordsman: { hp: 42, attack: 12, defense: 5, range: 1.5, speed: 1.1, attackCooldownSec: 0.95, label: "청동검", textureKey: "token-axe", tint: 0xe1af64 },
  bronze_spearman: { hp: 38, attack: 11, defense: 5, range: 2.2, speed: 1.0, attackCooldownSec: 1.05, label: "청동창", textureKey: "token-spear", tint: 0xd1c28f },
  archer: { hp: 30, attack: 13, defense: 3, range: 5.2, speed: 1.15, attackCooldownSec: 2.0, label: "활", textureKey: "token-ranged", tint: 0x90c6ff },
  iron_swordsman: { hp: 54, attack: 16, defense: 8, range: 1.6, speed: 1.12, attackCooldownSec: 0.9, label: "철검", textureKey: "token-axe", tint: 0xdfe7f4 },
  iron_spearman: { hp: 50, attack: 15, defense: 7, range: 2.4, speed: 1.06, attackCooldownSec: 1.0, label: "철창", textureKey: "token-spear", tint: 0xa7c8dd },
  musketeer: { hp: 36, attack: 21, defense: 4, range: 6.4, speed: 1.0, attackCooldownSec: 2.1, label: "머스킷", textureKey: "token-ranged", tint: 0xc09aff },
  knight: { hp: 72, attack: 22, defense: 10, range: 1.8, speed: 1.35, attackCooldownSec: 1.45, label: "기사", textureKey: "token-elite", tint: 0xffe1a1 },
  supply_wagon: { hp: 54, attack: 0, defense: 3, range: 4.4, speed: 0.98, attackCooldownSec: 1.2, healPower: 10, label: "보급", textureKey: "stone-supply-unit", tint: 0x89da93 },
};

function makeResourceMap(gold: number, wood: number, food: number, metal: number): Record<ResourceId, number> {
  return { gold, wood, food, metal, gunpowder: 0, fuel: 0 };
}

function canAfford(resources: Record<ResourceId, number>, cost: ResourceCost): boolean {
  return Object.entries(cost).every(([key, value]) => resources[key as ResourceId] >= value);
}

function payCost(resources: Record<ResourceId, number>, cost: ResourceCost): void {
  Object.entries(cost).forEach(([key, value]) => {
    resources[key as ResourceId] -= value;
  });
}

function progressBetween(a: number, b: number): number {
  return Math.abs(a - b);
}

export class LaneBattleScene extends Phaser.Scene {
  private battlefield!: BattlefieldResult;
  private units: LaneUnit[] = [];
  private capturePoints: CapturePointState[] = [];
  private selectedCapturePointId: number | null = null;
  private player!: TeamState;
  private enemy!: TeamState;
  private elapsedSec = 0;
  private workerAccumulator = new Map<string, number>();
  private terrainPrototype!: BattlefieldPrototypeRenderer;
  private terrainPrototypeV2!: BattlefieldPrototypeRenderer;
  private originalBackground!: Phaser.GameObjects.Image;
  private prototypeV2Background!: Phaser.GameObjects.Image;
  private terrainMode: TerrainRenderMode = parseTerrainRenderMode(QUERY_PARAMS.get("terrain"));
  private terrainPrototypeEnabled = this.terrainMode !== "legacy";
  private readonly prototypePresetId: PrototypePresetId = parsePrototypePreset(QUERY_PARAMS.get("preset"));
  private readonly prototypeVisualConfig: PrototypeVisualConfig = getPrototypeVisualConfig(this.prototypePresetId);
  private readonly scalePresetId: ScalePresetId = parseScalePreset(QUERY_PARAMS.get("scale"));
  private readonly scaleVisualConfig: PrototypeScaleConfig = getPrototypeScaleConfig(this.scalePresetId);
  private readonly verificationSeed = QUERY_PARAMS.get("seed") ?? DEFAULT_VERIFICATION_SEED;
  private readonly visualValidationScenario = QUERY_PARAMS.get("scenario") === "visual-validation";
  private readonly laneStart = new Phaser.Math.Vector2(1240, 3130);
  private readonly laneEnd = new Phaser.Math.Vector2(5995, 580);
  private readonly lanePath: LanePathNode[] = [
    { progress: 0, position: new Phaser.Math.Vector2(1240, 3130) },
    { progress: 0.375, position: new Phaser.Math.Vector2(3080, 2280) },
    { progress: 0.588, position: new Phaser.Math.Vector2(4095, 1740) },
    { progress: 0.767, position: new Phaser.Math.Vector2(4960, 1305) },
    { progress: 1, position: new Phaser.Math.Vector2(5995, 580) },
  ];
  private isDraggingField = false;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private readonly worldObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly uiObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly activeProjectiles = new Set<Phaser.GameObjects.Image>();
  private readonly audio = getAudioSystem();
  private readonly battleAudioState = new BattleAudioStateMachine();
  private readonly combatAudioEventTimes: number[] = [];
  private audioSettingsPanel!: AudioSettingsPanel;
  private audioSettingsOpen = false;
  private audioDebugText?: Phaser.GameObjects.Text;
  private nextAudioStateCheckSec = 0;
  private readonly laneObstacles: LaneObstacle[] = [
    { textureKey: "rock-cluster", progress: 0.20, laneRow: -10.2, radiusProgress: 0.03, radiusRows: 1.2, width: 176, height: 132 },
    { textureKey: "tree-cluster", progress: 0.32, laneRow: 10.4, radiusProgress: 0.035, radiusRows: 1.4, width: 144, height: 190 },
    { textureKey: "rock-cluster", progress: 0.51, laneRow: -10.1, radiusProgress: 0.03, radiusRows: 1.2, width: 166, height: 124 },
    { textureKey: "tree-cluster", progress: 0.69, laneRow: 10.3, radiusProgress: 0.035, radiusRows: 1.4, width: 138, height: 184 },
    { textureKey: "rock-cluster", progress: 0.87, laneRow: -10.2, radiusProgress: 0.028, radiusRows: 1.1, width: 154, height: 116 },
  ];

  private resourceTexts = new Map<ResourceId, Phaser.GameObjects.Text>();
  private workerRows = new Map<WorkerRole, WorkerUiRow>();
  private ageText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private baseText!: Phaser.GameObjects.Text;
  private tokensText!: Phaser.GameObjects.Text;
  private rosterText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private playerBaseBar!: Phaser.GameObjects.Rectangle;
  private enemyBaseBar!: Phaser.GameObjects.Rectangle;
  private capturePanelTitle!: Phaser.GameObjects.Text;
  private capturePanelBody!: Phaser.GameObjects.Text;
  private captureActionButtons = new Map<CapturePointAction, ActionButton>();

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
    this.load.image("rock-cluster", "/assets/battlefield-objects/rock-cluster.png");
    this.load.image("tree-cluster", "/assets/battlefield-objects/tree-cluster.png");
    this.load.image("stone-slinger-unit", "/assets/lane-units/stone-slinger-unit.png");
    this.load.image("stone-axeman-unit", "/assets/lane-units/stone-axeman-unit.png");
    this.load.image("stone-supply-unit", "/assets/lane-units/stone-supply-unit.png");
    this.load.image("stone-slinger-idle", "/assets/lane-poses/frames/stone-slinger-idle.png");
    this.load.image("stone-slinger-walk-a", "/assets/lane-poses/frames/stone-slinger-walk-a.png");
    this.load.image("stone-slinger-walk-b", "/assets/lane-poses/frames/stone-slinger-walk-b.png");
    this.load.image("stone-slinger-attack", "/assets/lane-poses/frames/stone-slinger-attack.png");
    this.load.image("stone-axeman-idle", "/assets/lane-poses/frames/stone-axeman-idle.png");
    this.load.image("stone-axeman-walk-a", "/assets/lane-poses/frames/stone-axeman-walk-a.png");
    this.load.image("stone-axeman-walk-b", "/assets/lane-poses/frames/stone-axeman-walk-b.png");
    this.load.image("stone-axeman-attack", "/assets/lane-poses/frames/stone-axeman-attack.png");
    this.load.image("stone-supply-idle", "/assets/lane-poses/frames/stone-supply-idle.png");
    this.load.image("stone-supply-walk-a", "/assets/lane-poses/frames/stone-supply-walk-a.png");
    this.load.image("stone-supply-walk-b", "/assets/lane-poses/frames/stone-supply-walk-b.png");
    this.load.image("stone-supply-attack", "/assets/lane-poses/frames/stone-supply-attack.png");
    PROTOTYPE_TERRAIN_ASSETS.forEach((asset) => this.load.image(asset.key, asset.path));
  }

  create(): void {
    Phaser.Math.RND.sow([this.verificationSeed]);
    void this.audio.initialize();
    this.audio.resetDirector("preparation");
    this.battleAudioState.reset();
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

    this.player = this.createTeamState("player", makeResourceMap(60, 40, 18, 18));
    this.enemy = this.createTeamState("enemy", makeResourceMap(60, 40, 18, 18));

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

  private createTeamState(id: TeamId, resources: Record<ResourceId, number>): TeamState {
    return {
      id,
      baseHp: id === "player" ? PLAYER_BASE_HP : ENEMY_BASE_HP,
      ageId: "stone",
      resources,
      workers: {
        gold: 1,
        wood: 1,
        food: 1,
        metal: 1,
        research: 0,
        idle: 0,
      },
      instantWaveTokens: 0,
      nextWaveInSec: WAVE_INTERVAL_SEC,
      lastWaveElapsedSec: -100,
      pendingBonusWaves: 0,
    };
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
        draw: (g) => g.fillStyle(0x9e8c76, 1).fillCircle(10, 10, 7),
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
    this.input.keyboard?.on("keydown-T", () => {
      const modes: TerrainRenderMode[] = ["legacy", "prototype", "prototype-v2"];
      const currentIndex = modes.indexOf(this.terrainMode);
      this.setTerrainMode(modes[(currentIndex + 1) % modes.length], true);
    });

    const control = {
      setEnabled: (enabled: boolean) => this.setTerrainMode(enabled ? "prototype" : "legacy", false),
      toggle: () => this.setTerrainMode(this.terrainMode === "legacy" ? "prototype" : "legacy", false),
      setMode: (mode: TerrainRenderMode) => this.setTerrainMode(mode, false),
      focusCentral: () => this.focusCentralCapture(),
      setPaused: (paused: boolean) => {
        if (paused) {
          this.scene.pause();
        } else {
          this.scene.resume();
        }
      },
      openAudioSettings: () => this.audioSettingsPanel.open(),
      forceGameOver: (win: boolean) => this.scene.start("gameover", {
        win,
        squadSize: this.units.filter((unit) => unit.team === "player").length,
        summary: win ? "오디오 통합 승리 검증" : "오디오 통합 패배 검증",
      }),
      snapshot: () => this.createVerificationSnapshot(),
      selectCapturePoint: (id: number) => this.selectCapturePoint(id),
      setCentralFortressHpRatio: (ratio: number) => {
        const fortress = this.capturePoints.find((point) => point.definition.pointType === "fixed-fortress");
        if (!fortress) return;
        fortress.towerBuilt = ratio > 0;
        fortress.towerBuildRemainingSec = 0;
        fortress.towerHp = fortress.towerMaxHp * Phaser.Math.Clamp(ratio, 0, 1);
        this.selectCapturePoint(fortress.id);
        this.refreshUi();
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
      },
      resetDirectionShowcase: () => this.resetValidationDirectionShowcase(),
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
    };
    (window as unknown as { __terrainPrototypeControl: typeof control }).__terrainPrototypeControl = control;
    this.setTerrainMode(this.terrainMode, false);
  }

  private setTerrainMode(mode: TerrainRenderMode, announce: boolean): void {
    this.terrainMode = mode;
    this.terrainPrototypeEnabled = mode !== "legacy";
    this.terrainPrototype.setEnabled(mode === "prototype");
    this.terrainPrototypeV2.setEnabled(mode === "prototype-v2");
    this.originalBackground.setVisible(mode !== "prototype-v2");
    this.prototypeV2Background.setVisible(mode === "prototype-v2");

    this.capturePoints.forEach((point) => {
      const isPrototypePoint = point.id === 1;
      const isV1 = mode === "prototype" && isPrototypePoint;
      const isV2 = mode === "prototype-v2" && isPrototypePoint;
      point.ring
        .setScale(isV1 ? 1.42 : 1, isV1 ? 0.68 : 1)
        .setVisible(!isV2 || this.selectedCapturePointId === point.id);
      point.core
        .setScale(isV1 ? 1.18 : 1, isV1 ? 0.72 : 1)
        .setVisible(!isV2 && point.towerBuilt);
      point.groundPresentation?.shadow.setVisible(isV1 && point.towerBuilt);
      point.groundPresentationV2?.shadow.setVisible(isV2 && point.towerBuilt);
    });
    this.units.forEach((unit) => this.syncUnitPresentation(unit));
    this.refreshCapturePointVisuals();

    if (announce) {
      const label = mode === "legacy"
        ? "기존 전장 렌더링"
        : mode === "prototype"
          ? "중앙 지형 프로토타입 V1"
          : `중앙 지형 프로토타입 V2 · ${this.prototypePresetId}/${this.scalePresetId}`;
      this.infoText.setText(`${label} 표시`);
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
      LANE_BATTLEFIELD_MAP_SPEC,
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
      this.add.image(pos.x, pos.y, obstacle.textureKey)
        .setDisplaySize(obstacle.width, obstacle.height)
        .setOrigin(0.5, 0.86)
        .setAlpha(obstacle.alpha ?? 1)
        .setDepth(this.getGroundDepth(pos.y));
    });

    this.capturePoints = CAPTURE_POINT_DEFINITIONS.map((definition) => {
      const { id: index, progress } = definition;
      const pos = this.progressToScreen(progress, 0);
      const groundPresentation = index === 1
        ? this.terrainPrototype.getSocketPresentation("central-capture-tower")
        : undefined;
      const groundPresentationV2 = index === 1
        ? this.terrainPrototypeV2.getSocketPresentation("central-capture-tower")
        : undefined;
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
      const towerSprite = this.add.image(pos.x, pos.y, "tower-full")
        .setDisplaySize(TOWER_W, TOWER_H)
        .setOrigin(0.5, TOWER_IMAGE_GROUND_ORIGIN_Y)
        .setDepth(this.getGroundDepth(pos.y));
      const towerHpBg = this.add.rectangle(pos.x, pos.y - 158, 60, 7, 0x132033, 0.92)
        .setDepth(towerSprite.depth + 1)
        .setVisible(false);
      const towerHpFill = this.add.rectangle(pos.x - 30, pos.y - 158, 60, 7, 0xf3cc6a, 1)
        .setOrigin(0, 0.5)
        .setDepth(towerSprite.depth + 2)
        .setVisible(false);

      ring.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));
      core.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));
      label.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));
      towerSprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));

      return {
        id: index,
        definition,
        progress,
        owner: "neutral",
        control: 0,
        buildingId: undefined,
        buildingLevel: 0,
        incomeTimerSec: 0,
        towerTimerSec: 0,
        towerBuildRemainingSec: 0,
        towerBuilt: definition.initialBuilding !== null,
        towerMaxHp: this.getTowerMaxHp("stone"),
        towerHp: this.getTowerMaxHp("stone"),
        supplyTimerSec: 0,
        ring,
        core,
        towerSprite,
        towerHpBg,
        towerHpFill,
        groundPresentation,
        groundPresentationV2,
        label,
        ownerText,
        buildingText,
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
    const hudScale = CANVAS_W / 1672;
    this.add.image(0, 0, "war-table-hud")
      .setOrigin(0, 0)
      .setScale(hudScale)
      .setCrop(0, 0, 1672, 188)
      .setDepth(DEPTH_UI)
      .setScrollFactor(0);
    this.add.image(0, CANVAS_H - 278 * hudScale, "war-table-hud")
      .setOrigin(0, 0)
      .setScale(hudScale)
      .setCrop(0, 663, 1672, 278)
      .setDepth(DEPTH_UI)
      .setScrollFactor(0);

    this.add.rectangle(150, 126, 230, 112, 0x07111a, 0.76)
      .setStrokeStyle(2, 0x7ea0c9, 0.26)
      .setDepth(DEPTH_UI + 1)
      .setScrollFactor(0);

    this.add.text(42, 78, "전선 지휘", {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#eaf3ff",
      stroke: "#182535",
      strokeThickness: 4,
    }).setDepth(DEPTH_UI + 2).setScrollFactor(0);
    this.ageText = this.add.text(42, 108, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#d6e3f1" }).setDepth(DEPTH_UI + 2).setScrollFactor(0);
    this.waveText = this.add.text(42, 128, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#d6e3f1" }).setDepth(DEPTH_UI + 2).setScrollFactor(0);
    this.baseText = this.add.text(42, 148, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#d6e3f1" }).setDepth(DEPTH_UI + 2).setScrollFactor(0);
    this.tokensText = this.add.text(42, 168, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#f3d27a" }).setDepth(DEPTH_UI + 2).setScrollFactor(0);

    const resourceXs = [360, 680, 1080, 1400];
    MVP_ACTIVE_RESOURCE_IDS.forEach((resourceId, index) => {
      const icon = this.add.image(resourceXs[index], 34, this.getResourceIconKey(resourceId)).setDisplaySize(26, 26).setDepth(DEPTH_UI + 2).setScrollFactor(0);
      this.add.text(resourceXs[index], 10, getResource(resourceId).label, { fontFamily: "sans-serif", fontSize: "11px", color: "#97abd0" })
        .setDepth(DEPTH_UI + 2)
        .setScrollFactor(0)
        .setOrigin(0.5, 0);
      const text = this.add.text(resourceXs[index], 48, "", {
        fontFamily: "Georgia, serif",
        fontSize: "22px",
        color: "#f5fbff",
      }).setDepth(DEPTH_UI + 2).setScrollFactor(0).setOrigin(0.5, 0);
      this.resourceTexts.set(resourceId, text);
      this.uiObjects.push(icon);
    });

    this.add.text(84, 640, "일꾼 배치", { fontFamily: "Georgia, serif", fontSize: "22px", color: "#f4e6c5" })
      .setDepth(DEPTH_UI + 2)
      .setScrollFactor(0);

    let workerY = 676;
    (["gold", "wood", "food", "metal", "research", "idle"] as WorkerRole[]).forEach((role) => {
      const row = this.createWorkerRow(role, workerY);
      this.workerRows.set(role, row);
      workerY += 28;
    });

    this.createActionButton(430, 668, 190, 42, "일꾼 고용", () => this.hireWorker());
    this.createActionButton(430, 722, 190, 42, "연구 일꾼", () => this.hireResearchWorker());
    this.createActionButton(1100, 668, 220, 42, "즉시 웨이브", () => this.tryUseInstantWaveToken(this.player));
    this.createActionButton(1100, 722, 220, 42, "시대 업", () => this.tryAgeUpPlayer());

    this.rosterText = this.add.text(790, 650, "", {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#d8e7f6",
      lineSpacing: 4,
    }).setDepth(DEPTH_UI + 2).setScrollFactor(0);
    this.capturePanelTitle = this.add.text(790, 744, "", {
      fontFamily: "Georgia, serif",
      fontSize: "18px",
      color: "#f4e6c5",
    }).setDepth(DEPTH_UI + 2).setScrollFactor(0).setOrigin(0.5, 0.5);
    this.capturePanelBody = this.add.text(790, 784, "", {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#d8e7f6",
      align: "center",
      lineSpacing: 3,
    }).setDepth(DEPTH_UI + 2).setScrollFactor(0).setOrigin(0.5, 0.5);

    this.infoText = this.add.text(790, 842, "", {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#a8bdd7",
    }).setDepth(DEPTH_UI + 2).setScrollFactor(0).setOrigin(0.5, 0.5);

    this.captureActionButtons.set(
      "build-watchtower",
      this.createActionButton(882, 670, 150, 34, "요새", () => this.tryBuildAtSelectedPoint("watchtower")),
    );
    this.captureActionButtons.set(
      "build-supply-depot",
      this.createActionButton(882, 712, 150, 34, "병참", () => this.tryBuildAtSelectedPoint("supply_depot")),
    );
    this.captureActionButtons.set(
      "build-mint",
      this.createActionButton(882, 754, 150, 34, "조달소", () => this.tryBuildAtSelectedPoint("mint")),
    );
    this.captureActionButtons.set(
      "dismantle",
      this.createActionButton(882, 796, 150, 30, "폐기", () => this.tryDismantleSelectedPoint()),
    );
    this.captureActionButtons.set(
      "repair-fortress",
      this.createActionButton(882, 670, 150, 34, "요새 수리", () => this.tryMaintainSelectedFortress()),
    );
    this.captureActionButtons.set(
      "rebuild-fortress",
      this.createActionButton(882, 670, 150, 34, "요새 재건", () => this.tryMaintainSelectedFortress()),
    );

    this.playerBaseBar = this.add.rectangle(160, 228, 220, 12, 0x4fc1ff, 1).setOrigin(0, 0.5).setDepth(DEPTH_UI + 2);
    this.enemyBaseBar = this.add.rectangle(1218, 228, 220, 12, 0xff7373, 1).setOrigin(0, 0.5).setDepth(DEPTH_UI + 2);
    this.add.rectangle(160, 228, 220, 12, 0, 0).setOrigin(0, 0.5).setStrokeStyle(2, 0xd6e3f1, 0.4).setDepth(DEPTH_UI + 1);
    this.add.rectangle(1218, 228, 220, 12, 0, 0).setOrigin(0, 0.5).setStrokeStyle(2, 0xd6e3f1, 0.4).setDepth(DEPTH_UI + 1);
    this.add.text(160, 204, "아군 본진", { fontFamily: "sans-serif", fontSize: "12px", color: "#c7e5ff" }).setDepth(DEPTH_UI + 2);
    this.add.text(1218, 204, "적 본진", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffd0d0" }).setDepth(DEPTH_UI + 2);

    this.audioSettingsPanel = new AudioSettingsPanel(this, {
      depth: DEPTH_UI + 60,
      onVisibilityChange: (visible) => {
        this.audioSettingsOpen = visible;
      },
    });
    if (QUERY_PARAMS.get("audioDebug") === "1") {
      this.audioDebugText = this.add.text(1160, 116, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#d9f2ff",
        backgroundColor: "rgba(4, 13, 22, 0.84)",
        padding: { x: 9, y: 7 },
        lineSpacing: 2,
      }).setDepth(DEPTH_UI + 50).setScrollFactor(0);
    }
  }

  private createWorkerRow(role: WorkerRole, y: number): WorkerUiRow {
    const icon = this.add.image(72, y + 10, this.getWorkerIconKey(role)).setDisplaySize(22, 22).setDepth(DEPTH_UI + 2).setScrollFactor(0);
    const label = this.add.text(92, y, this.getWorkerRoleLabel(role), {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#e6dcc5",
    }).setDepth(DEPTH_UI + 2).setScrollFactor(0);
    const value = this.add.text(198, y, "0", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#fff6dd",
    }).setDepth(DEPTH_UI + 2).setScrollFactor(0).setOrigin(1, 0);
    const minus = this.add.circle(224, y + 10, 10, 0x283a55, 0.95).setStrokeStyle(1, 0x7ea0c9).setDepth(DEPTH_UI + 2).setScrollFactor(0);
    const plus = this.add.circle(252, y + 10, 10, 0x283a55, 0.95).setStrokeStyle(1, 0x7ea0c9).setDepth(DEPTH_UI + 2).setScrollFactor(0);
    this.add.text(minus.x, minus.y - 1, "-", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5).setDepth(DEPTH_UI + 3).setScrollFactor(0);
    this.add.text(plus.x, plus.y - 1, "+", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5).setDepth(DEPTH_UI + 3).setScrollFactor(0);

    minus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.shiftWorker(role, -1));
    plus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.shiftWorker(role, 1));
    return { icon, label, value, plus, minus };
  }

  private createActionButton(x: number, y: number, w: number, h: number, label: string, onClick: () => void): ActionButton {
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x1d2d47, 0.95)
      .setStrokeStyle(2, 0xd6b979, 0.65)
      .setDepth(DEPTH_UI + 2)
      .setScrollFactor(0);
    const text = this.add.text(rect.x, rect.y, label, {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#f3f7fb",
    }).setOrigin(0.5).setDepth(DEPTH_UI + 3).setScrollFactor(0);

    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerover", () => {
      rect.setFillStyle(0x274165, 0.98);
      this.audio.playSfx("sfx.ui.hover", { eventKey: `button:hover:${label}` });
    });
    rect.on("pointerout", () => rect.setFillStyle(0x1d2d47, 0.95));
    rect.on("pointerdown", () => {
      rect.setFillStyle(0x37567f, 1);
      this.time.delayedCall(100, () => rect.setFillStyle(0x1d2d47, 0.95));
      onClick();
    });

    return { rect, text };
  }

  private setCaptureActionButtonVisible(button: ActionButton, visible: boolean): void {
    button.rect.setVisible(visible);
    button.text.setVisible(visible);
    if (visible) {
      button.rect.setInteractive({ useHandCursor: true });
      button.text.disableInteractive();
    } else {
      button.rect.disableInteractive();
      button.text.disableInteractive();
    }
  }

  private getSelectedCaptureActions(): CapturePointAction[] {
    const point = this.capturePoints.find((entry) => entry.id === this.selectedCapturePointId);
    return point ? getCapturePointActions(point.definition, point) : [];
  }

  private updateAudioState(): void {
    if (this.elapsedSec < this.nextAudioStateCheckSec) return;
    this.nextAudioStateCheckSec = this.elapsedSec + 0.45;
    const nowMs = this.elapsedSec * 1000;
    while (this.combatAudioEventTimes[0] !== undefined && this.combatAudioEventTimes[0] < nowMs - 3000) {
      this.combatAudioEventTimes.shift();
    }
    const engagedUnits = this.units.filter((unit) => {
      const nearest = this.findNearestEnemy(unit);
      if (!nearest) return false;
      const engagementDistance = Math.max(ENGAGE_GAP * 2.6, unit.range * RANGE_TO_PROGRESS * 1.35);
      return this.unitDistance(unit, nearest) <= engagementDistance;
    }).length;
    const fixedFortress = this.capturePoints.find((point) =>
      point.definition.pointType === "fixed-fortress" && point.owner === "player",
    );
    const decision = this.battleAudioState.update({
      nowMs,
      engagedUnits,
      activeProjectiles: this.activeProjectiles.size,
      recentAttackEvents: this.combatAudioEventTimes.length,
      playerBaseHpRatio: this.player.baseHp / PLAYER_BASE_HP,
      playerFortressHpRatio: fixedFortress
        ? fixedFortress.towerBuilt ? fixedFortress.towerHp / fixedFortress.towerMaxHp : 0
        : 1,
    });

    if (this.audio.getState().bgmState !== "fortress-under-attack") {
      this.audio.setDirectorState(decision.state);
    }
    if (decision.triggerFortressWarning) {
      this.audio.playSfx("sfx.fortress.warning", { eventKey: "fortress:danger-entry" });
      this.audio.triggerFortressWarning(decision.state);
    }
  }

  private playWorldSfx(
    assetId: string,
    x: number,
    y: number,
    eventKey: string,
    highFrequency = true,
  ): void {
    const camera = this.cameras.main;
    const mix = calculateSpatialAudio(
      { x, y },
      {
        centerX: camera.midPoint.x,
        centerY: camera.midPoint.y,
        width: camera.width,
        height: camera.height,
        zoom: camera.zoom,
      },
    );
    this.audio.playSfx(assetId, {
      eventKey,
      highFrequency,
      volumeMultiplier: mix.audible ? mix.volumeMultiplier : 0,
      pan: mix.pan,
    });
    if (highFrequency) this.combatAudioEventTimes.push(this.elapsedSec * 1000);
  }

  private updateAudioDebugOverlay(): void {
    if (!this.audioDebugText) return;
    const state = this.audio.getState();
    this.audioDebugText.setText([
      `AUDIO ${state.contextState} ${state.unlocked ? "unlocked" : "locked"}`,
      `state ${state.bgmState ?? "-"} | ${state.currentBgmId ?? "queued"}`,
      `voices bgm ${state.activeBgmVoices} / sfx ${state.activeSfxVoices}`,
      `vol ${state.settings.masterVolume.toFixed(2)} · ${state.settings.bgmVolume.toFixed(2)} · ${state.settings.sfxVolume.toFixed(2)}`,
      `mute ${state.settings.mute} | combat ${state.settings.combatSfxMode}`,
      `fallback ${state.missingAssetFallback} | skipped ${state.skippedEventCount}`,
      ...state.recentEvents.slice(-4).map((event) => `${event.id.replace("sfx.", "")} ${event.result}`),
    ]);
  }

  private getResourceIconKey(resourceId: ResourceId): string {
    switch (resourceId) {
      case "gold":
        return "icon-gold";
      case "wood":
        return "icon-wood";
      case "food":
        return "icon-food";
      case "metal":
        return "icon-metal";
      default:
        return "icon-gold";
    }
  }

  private getWorkerIconKey(role: WorkerRole): string {
    if (role === "research") return "icon-research";
    if (role === "idle") return "icon-idle";
    return "icon-worker";
  }

  private tickEconomy(deltaSec: number): void {
    this.player.resources.food += BASE_FOOD_REGEN_PER_SEC * deltaSec;
    this.enemy.resources.food += BASE_FOOD_REGEN_PER_SEC * deltaSec;
    this.tickResourceWorker(this.player, "gold", deltaSec, BASE_RESOURCE_TICK_SEC);
    this.tickResourceWorker(this.player, "wood", deltaSec, BASE_RESOURCE_TICK_SEC);
    this.tickResourceWorker(this.player, "metal", deltaSec, BASE_RESOURCE_TICK_SEC);
    this.tickResourceWorker(this.player, "food", deltaSec, getAgeBalance(this.player.ageId).foodWorkerIntervalSec);

    this.tickResourceWorker(this.enemy, "gold", deltaSec, BASE_RESOURCE_TICK_SEC);
    this.tickResourceWorker(this.enemy, "wood", deltaSec, BASE_RESOURCE_TICK_SEC);
    this.tickResourceWorker(this.enemy, "metal", deltaSec, BASE_RESOURCE_TICK_SEC);
    this.tickResourceWorker(this.enemy, "food", deltaSec, getAgeBalance(this.enemy.ageId).foodWorkerIntervalSec);
  }

  private tickResourceWorker(team: TeamState, resourceId: WorkerResourceId, deltaSec: number, intervalSec: number): void {
    const key = `${team.id}:${resourceId}`;
    const workers = team.workers[resourceId];
    if (workers <= 0) return;
    const next = (this.workerAccumulator.get(key) ?? 0) + deltaSec;
    const producedPerWorker = Math.floor(next / intervalSec);
    if (producedPerWorker > 0) team.resources[resourceId] += producedPerWorker * workers;
    this.workerAccumulator.set(key, next % intervalSec);
  }

  private tickAi(deltaSec: number): void {
    this.enemy.nextWaveInSec -= deltaSec;
    this.enemy.lastWaveElapsedSec += deltaSec;
    if (this.shouldAiAgeUp()) this.advanceAge(this.enemy);
    if (this.enemy.instantWaveTokens > 0 && this.enemy.lastWaveElapsedSec >= INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC && this.enemy.nextWaveInSec > 22) {
      this.tryUseInstantWaveToken(this.enemy);
    }
  }

  private shouldAiAgeUp(): boolean {
    const idx = AGES.findIndex((age) => age.id === this.enemy.ageId);
    if (idx >= AGES.length - 1) return false;
    const thresholds = [0, 55, 120, 190, 280];
    const nextCost = this.getAgeUpCost(idx);
    return this.elapsedSec >= thresholds[idx + 1] && canAfford(this.enemy.resources, nextCost);
  }

  private tickWaves(deltaSec: number): void {
    const previousPlayerWaveSec = this.player.nextWaveInSec;
    this.player.nextWaveInSec -= deltaSec;
    this.player.lastWaveElapsedSec += deltaSec;
    if (previousPlayerWaveSec > 10 && this.player.nextWaveInSec <= 10) {
      this.audio.playSfx("sfx.wave.prepare", { eventKey: `wave:prepare:${Math.floor(this.elapsedSec)}` });
    }
    if (this.player.nextWaveInSec <= 0) this.trySpawnWave(this.player, false);
    if (this.enemy.nextWaveInSec <= 0) this.trySpawnWave(this.enemy, false);
  }

  private tickCombat(deltaSec: number): void {
    const playerHasSupply = this.units.some((unit) => unit.team === "player" && unit.role === "support");
    const enemyHasSupply = this.units.some((unit) => unit.team === "enemy" && unit.role === "support");

    this.units.forEach((unit) => {
      if (unit.team === "player" && unit.role === "battle") unit.attrition = Phaser.Math.Clamp(unit.attrition + (playerHasSupply ? -0.18 : 0.12) * deltaSec, 0, 0.7);
      if (unit.team === "enemy" && unit.role === "battle") unit.attrition = Phaser.Math.Clamp(unit.attrition + (enemyHasSupply ? -0.18 : 0.12) * deltaSec, 0, 0.7);
    });

    const deaths = new Set<LaneUnit>();
    this.units.forEach((unit) => {
      unit.attackAnimTime = Math.max(0, unit.attackAnimTime - deltaSec);
      unit.attackFacingLockSec = Math.max(0, unit.attackFacingLockSec - deltaSec);
      unit.attackTimerSec -= deltaSec;
      if (unit.role === "support") {
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
          this.beginAttackPresentation(unit, enemyTower.towerSprite.x);
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
            this.launchProjectile(start, end, this.getProjectileKeyForUnit(unit.unitId), () => this.applyDamageToTower(enemyTower, damage, unit.team), 1.02);
          } else {
            this.applyDamageToTower(enemyTower, damage, unit.team);
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
        this.beginAttackPresentation(unit, nearest.sprite.x);
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
          this.launchProjectile(start, end, this.getProjectileKeyForUnit(unit.unitId), () => this.applyDamageToUnit(nearest, damage, unit.team === "player" ? "#ffd67a" : "#ff8f8f"), 1.04);
        } else {
          nearest.hp -= damage;
          this.playWorldSfx(
            "sfx.combat.meleeHit",
            nearest.sprite.x,
            nearest.sprite.y,
            `impact:melee:${unit.id}:${nearest.id}:${Math.round(this.elapsedSec * 1000)}`,
          );
          this.playImpactFeedback(unit, nearest, damage);
          this.spawnToast(`${damage}`, nearest.sprite.x, nearest.sprite.y - 26, unit.team === "player" ? "#ffd67a" : "#ff8f8f");
          if (nearest.hp <= 0) deaths.add(nearest);
        }
      }
    });

    deaths.forEach((unit) => this.killUnit(unit));
    this.units.forEach((unit) => this.syncUnitVisual(unit));
    this.checkBasePressure(deltaSec);
  }

  private tickSupport(unit: LaneUnit, deltaSec: number): void {
    const allies = this.units.filter((other) => other.team === unit.team && other.role === "battle");
    const injured = allies
      .filter((ally) => ally.hp < ally.maxHp && this.unitDistance(unit, ally) <= unit.range * RANGE_TO_PROGRESS)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (injured.length > 0 && unit.attackTimerSec <= 0) {
      unit.attackTimerSec = unit.attackCooldownSec;
      this.beginAttackPresentation(unit, injured[0].sprite.x);
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

  private beginAttackPresentation(unit: LaneUnit, targetX: number): void {
    unit.attackAnimTime = ATTACK_VISUAL_DURATION_SEC;
    unit.attackFacingLockSec = ATTACK_VISUAL_DURATION_SEC;
    const deltaX = targetX - unit.sprite.x;
    if (Math.abs(deltaX) > FACING_DEAD_ZONE_WORLD_PX) unit.facingX = deltaX >= 0 ? 1 : -1;
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
    const targetRow = enemy.laneRow > unit.laneRow ? unit.laneRow + 1 : unit.laneRow - 1;
    if (this.isLaneRowFree(unit, targetRow)) unit.laneRow = Phaser.Math.Clamp(targetRow, -4, 4);
  }

  private tryShiftLane(unit: LaneUnit, enemy?: LaneUnit): boolean {
    const candidates = [0, -1, 1, -2, 2, -3, 3, -4, 4]
      .map((delta) => Phaser.Math.Clamp(Math.round(unit.laneRow + delta), -4, 4))
      .filter((row, index, arr) => arr.indexOf(row) === index);
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
    return !this.units.some((other) => other.id !== unit.id && other.team === unit.team && Math.abs(other.laneRow - laneRow) < 0.5 && progressBetween(other.progress, unit.progress) < FRIENDLY_GAP);
  }

  private isMeleeUnit(unit: LaneUnit): boolean {
    return unit.role === "battle" && unit.range <= 2.5;
  }

  private isRangedUnit(unit: LaneUnit): boolean {
    return unit.role === "battle" && unit.range > 2.5;
  }

  private findCombatSlot(unit: LaneUnit, enemy: LaneUnit): CombatSlot | undefined {
    const teamOffset = unit.team === "player" ? -0.012 : 0.012;
    const laneCandidates = [0, -1, 1, -2, 2, -3, 3, -4, 4]
      .map((delta) => Phaser.Math.Clamp(Math.round(enemy.laneRow + delta), -4, 4))
      .filter((row, index, arr) => arr.indexOf(row) === index);
    const progressCandidates = [enemy.progress + teamOffset, enemy.progress + teamOffset * 1.6];

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
    if (Math.abs(slot.laneRow - enemy.laneRow) > 4.2) return false;
    return !this.units.some((other) =>
      other.id !== unit.id &&
      other.team === unit.team &&
      progressBetween(other.progress, slot.progress) < 0.012 &&
      Math.abs(other.laneRow - slot.laneRow) < 0.55,
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

  private findNearestEnemyTower(unit: LaneUnit): CapturePointState | undefined {
    return this.capturePoints
      .filter((point) => point.owner !== "neutral" && point.owner !== unit.team && point.towerBuilt)
      .sort((a, b) => this.towerDistance(unit, a) - this.towerDistance(unit, b))[0];
  }

  private unitDistance(a: LaneUnit, b: LaneUnit): number {
    const progressDistance = progressBetween(a.progress, b.progress);
    const rowDistance = Math.abs(a.laneRow - b.laneRow) * 0.01;
    return Math.sqrt(progressDistance * progressDistance + rowDistance * rowDistance);
  }

  private towerDistance(unit: LaneUnit, point: CapturePointState): number {
    const progressDistance = progressBetween(unit.progress, point.progress);
    const rowDistance = Math.abs(unit.laneRow) * 0.01;
    return Math.sqrt(progressDistance * progressDistance + rowDistance * rowDistance);
  }

  private keepUnitInPlayableLane(unit: LaneUnit): void {
    unit.laneRow = Phaser.Math.Clamp(unit.laneRow, -5, 5);
    this.laneObstacles.forEach((obstacle) => {
      if (progressBetween(unit.progress, obstacle.progress) > obstacle.radiusProgress) return;
      if (Math.abs(unit.laneRow - obstacle.laneRow) > obstacle.radiusRows) return;
      const pushDir = unit.laneRow >= obstacle.laneRow ? 1 : -1;
      unit.laneRow = obstacle.laneRow + pushDir * (obstacle.radiusRows + 0.4);
    });
    unit.laneRow = Phaser.Math.Clamp(unit.laneRow, -5, 5);
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

      this.tickWatchtower(point, deltaSec);
      if (point.buildingId === "supply_depot") this.tickSupplyDepot(point, deltaSec);
      if (point.buildingId === "mint") this.tickMint(point, deltaSec);
    });

    this.enemyAutoBuildCapturePoint();
    this.refreshCapturePointVisuals();
  }

  private tickWatchtower(point: CapturePointState, deltaSec: number): void {
    if (point.towerBuildRemainingSec > 0) {
      point.towerBuildRemainingSec = Math.max(0, point.towerBuildRemainingSec - deltaSec);
      if (point.towerBuildRemainingSec === 0) {
        point.towerBuilt = true;
        point.towerMaxHp = this.getTowerMaxHp(point.owner === "neutral" ? "stone" : (point.owner === "player" ? this.player.ageId : this.enemy.ageId));
        point.towerHp = point.towerMaxHp;
        point.towerTimerSec = 0.3;
        if (point.owner === "player") this.infoText.setText("타워 재건축 완료");
        if (point.owner === "player") {
          this.audio.playSfx("sfx.construction.complete", { eventKey: `tower:${point.id}:complete` });
          this.audio.playSfx("sfx.fortress.rebuilt", { eventKey: `tower:${point.id}:rebuilt` });
        }
      }
      return;
    }
    if (!point.towerBuilt) return;
    point.towerTimerSec -= deltaSec;
    if (point.owner === "neutral" || point.towerTimerSec > 0) return;
    const spec = this.getTowerAttackSpec(point.owner === "player" ? this.player.ageId : this.enemy.ageId);
    const target = this.units
      .filter((unit) => unit.team !== point.owner && progressBetween(unit.progress, point.progress) <= spec.rangeProgress)
      .sort((a, b) => a.hp - b.hp)[0];
    if (!target) return;
    point.towerTimerSec = spec.cooldownSec;
    const start = this.getTowerProjectileAnchor(point, true);
    this.playWorldSfx(
      "sfx.combat.towerAttack",
      start.x,
      start.y,
      `tower-attack:${point.id}:${target.id}:${Math.round(this.elapsedSec * 1000)}`,
    );
    const offsets = [-12, 12];
    offsets.forEach((offset, idx) => {
      const aim = this.getUnitProjectileAnchor(target).add(new Phaser.Math.Vector2(offset, idx * 3));
      this.launchProjectile(start, aim, spec.projectileKey, () => this.applyDamageToUnit(target, spec.damage, point.owner === "player" ? "#8fd2ff" : "#ffb4b4", "요새"), 1);
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
    this.audio.playSfx("sfx.ui.buildSelect", { eventKey: `capture:select:${id}` });
    this.refreshCapturePointVisuals();
    if (this.capturePanelTitle) this.refreshUi();
  }

  private tryBuildAtSelectedPoint(buildingId: BuildingId): void {
    const point = this.capturePoints.find((entry) => entry.id === this.selectedCapturePointId);
    if (!point) {
      this.infoText.setText("먼저 거점을 선택하십시오");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: "build:no-point" });
      return;
    }
    if (point.owner !== "player") {
      this.infoText.setText("아군 점령 거점에서만 건설 가능합니다");
      this.audio.playSfx("sfx.ui.hireFail", { eventKey: `build:${point.id}:not-owned` });
      return;
    }
    if (!point.definition.allowedBuildingTypes.includes(buildingId)) {
      this.infoText.setText("이 거점에는 해당 건물을 건설할 수 없습니다");
      this.audio.playSfx("sfx.ui.hireFail", { eventKey: `build:${point.id}:not-allowed:${buildingId}` });
      return;
    }
    if (point.definition.pointType === "fixed-fortress") {
      this.tryMaintainSelectedFortress();
      return;
    }
    const building = BUILDINGS.find((entry) => entry.id === buildingId);
    if (!building) return;
    if (buildingId === "watchtower") {
      const towerCost = this.getTowerBuildCost(this.player.ageId);
      if (point.towerBuilt || point.towerBuildRemainingSec > 0) {
        this.infoText.setText("이 거점의 타워는 이미 존재하거나 재건 중입니다");
        this.audio.playSfx("sfx.ui.cancel", { eventKey: `tower:${point.id}:busy` });
        return;
      }
      if (!canAfford(this.player.resources, towerCost)) {
        this.infoText.setText("타워 재건 자원 부족");
        this.audio.playSfx("sfx.state.resourceShortage", { eventKey: `tower:${point.id}:shortage` });
        return;
      }
      payCost(this.player.resources, towerCost);
      point.towerBuildRemainingSec = 10;
      point.towerTimerSec = 0;
      this.infoText.setText("타워 재건축을 시작했습니다 (10초)");
      this.audio.playSfx("sfx.construction.start", { eventKey: `tower:${point.id}:start` });
      this.refreshCapturePointVisuals();
      return;
    }
    if (point.buildingId) {
      this.infoText.setText("이미 건설된 거점입니다");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: `build:${point.id}:occupied` });
      return;
    }
    if (!canAfford(this.player.resources, building.cost)) {
      this.infoText.setText(`${building.label} 건설 자원 부족`);
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: `build:${point.id}:shortage:${buildingId}` });
      return;
    }
    payCost(this.player.resources, building.cost);
    point.buildingId = buildingId;
    point.buildingLevel = 1;
    point.incomeTimerSec = 4;
    point.towerTimerSec = 0.4;
    point.supplyTimerSec = 0.4;
    this.infoText.setText(`${building.label} 건설 완료`);
    this.audio.playSfx("sfx.construction.start", { eventKey: `build:${point.id}:start:${buildingId}` });
    this.time.delayedCall(180, () => {
      this.audio.playSfx("sfx.construction.complete", { eventKey: `build:${point.id}:complete:${buildingId}` });
    });
    this.refreshCapturePointVisuals();
  }

  private enemyAutoBuildCapturePoint(): void {
    const rebuildTarget = this.capturePoints.find((point) =>
      point.owner === "enemy"
      && point.definition.canRebuild
      && !point.towerBuilt
      && point.towerBuildRemainingSec <= 0,
    );
    if (rebuildTarget) {
      const towerCost = this.getTowerBuildCost(this.enemy.ageId);
      if (canAfford(this.enemy.resources, towerCost)) {
        payCost(this.enemy.resources, towerCost);
        rebuildTarget.towerBuildRemainingSec = 10;
        return;
      }
    }
    const target = this.capturePoints.find((point) =>
      point.owner === "enemy"
      && point.definition.pointType === "buildable"
      && !point.buildingId,
    );
    if (!target) return;
    const choices = BUILDINGS.filter((entry): entry is BuildingDef & { id: Exclude<BuildingId, "watchtower"> } =>
      entry.id !== "watchtower" && target.definition.allowedBuildingTypes.includes(entry.id),
    );
    if (choices.length === 0) return;
    const choice = choices[target.id % choices.length];
    if (!canAfford(this.enemy.resources, choice.cost)) return;
    payCost(this.enemy.resources, choice.cost);
    target.buildingId = choice.id as Exclude<BuildingId, "watchtower">;
    target.buildingLevel = 1;
    target.incomeTimerSec = 4;
    target.towerTimerSec = 0.4;
    target.supplyTimerSec = 0.4;
  }

  private tryDismantleSelectedPoint(): void {
    const point = this.capturePoints.find((entry) => entry.id === this.selectedCapturePointId);
    if (!point || point.owner !== "player" || !point.definition.canDemolish || !point.buildingId) {
      this.infoText.setText("폐기할 아군 거점 건물이 없습니다");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: "dismantle:invalid" });
      return;
    }
    if (this.player.resources.gold < DISMANTLE_COST_GOLD) {
      this.infoText.setText("폐기 비용이 부족합니다");
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: `dismantle:${point.id}:shortage` });
      return;
    }
    this.player.resources.gold -= DISMANTLE_COST_GOLD;
    point.buildingId = undefined;
    point.buildingLevel = 0;
    this.infoText.setText(`거점 건물을 폐기했습니다 (-${DISMANTLE_COST_GOLD}G)`);
    this.audio.playSfx("sfx.ui.confirm", { eventKey: `dismantle:${point.id}:complete` });
    this.refreshCapturePointVisuals();
  }

  private tryMaintainSelectedFortress(): void {
    const point = this.capturePoints.find((entry) => entry.id === this.selectedCapturePointId);
    if (!point || point.definition.pointType !== "fixed-fortress" || point.owner !== "player") {
      this.infoText.setText("수리할 아군 고정 요새가 없습니다");
      this.audio.playSfx("sfx.ui.hireFail", { eventKey: "fortress:maintain:invalid" });
      return;
    }
    if (point.towerBuildRemainingSec > 0) {
      this.infoText.setText(`요새 재건 중 (${Math.ceil(point.towerBuildRemainingSec)}초)`);
      this.audio.playSfx("sfx.ui.cancel", { eventKey: `fortress:${point.id}:busy` });
      return;
    }
    const rebuildCost = this.getTowerBuildCost(this.player.ageId);
    if (!point.towerBuilt) {
      if (!canAfford(this.player.resources, rebuildCost)) {
        this.infoText.setText("요새 재건 자원 부족");
        this.audio.playSfx("sfx.state.resourceShortage", { eventKey: `fortress:${point.id}:rebuild-shortage` });
        return;
      }
      payCost(this.player.resources, rebuildCost);
      point.towerBuildRemainingSec = 10;
      this.infoText.setText("고정 요새 재건을 시작했습니다 (10초)");
      this.audio.playSfx("sfx.construction.start", { eventKey: `fortress:${point.id}:rebuild-start` });
      return;
    }
    if (point.towerHp >= point.towerMaxHp) {
      this.infoText.setText("고정 요새가 최대 HP입니다");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: `fortress:${point.id}:full` });
      return;
    }
    const repairCost: ResourceCost = {
      gold: Math.max(1, Math.ceil((rebuildCost.gold ?? 0) / 2)),
      wood: Math.max(1, Math.ceil((rebuildCost.wood ?? 0) / 2)),
    };
    if (!canAfford(this.player.resources, repairCost)) {
      this.infoText.setText("요새 수리 자원 부족");
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: `fortress:${point.id}:repair-shortage` });
      return;
    }
    payCost(this.player.resources, repairCost);
    point.towerHp = point.towerMaxHp;
    this.infoText.setText("고정 요새 수리 완료");
    this.audio.playSfx("sfx.construction.repair", { eventKey: `fortress:${point.id}:repair` });
    this.refreshCapturePointVisuals();
  }

  private resolveCapturedStructure(point: CapturePointState, toOwner: TeamId): void {
    point.towerBuilt = false;
    point.towerBuildRemainingSec = 0;
    point.towerHp = 0;
    point.towerTimerSec = 0;
    if (!point.buildingId || point.buildingLevel <= 0) return;
    const destroyed = Phaser.Math.RND.frac() < 0.7;
    if (destroyed) {
      point.buildingId = undefined;
      point.buildingLevel = 0;
      if (toOwner === "player") this.infoText.setText("적 거점 건물이 파괴되었습니다");
      return;
    }
    const drop = Phaser.Math.Between(1, 3);
    point.buildingLevel = Math.max(0, point.buildingLevel - drop);
    if (point.buildingLevel <= 0) {
      point.buildingId = undefined;
      if (toOwner === "player") this.infoText.setText("적 건물을 접수하려 했지만 붕괴했습니다");
      return;
    }
    if (toOwner === "player") this.infoText.setText(`적 건물을 접수했습니다 (레벨 -${drop})`);
  }

  private isPrototypeV2(): boolean {
    return this.terrainMode === "prototype-v2";
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
      const centralV2 = this.isPrototypeV2() && point.id === 1;
      point.ring.setFillStyle(ownerColor, selected ? 0.32 : 0.18);
      point.ring.setRadius(centralV2 ? (selected ? 48 : 42) : selected ? 40 : 34);
      point.ring.setStrokeStyle(selected ? 5 : 4, selected ? 0xffffff : ownerColor, selected ? 0.9 : 0.5);
      point.ring
        .setPosition(pos.x, pos.y)
        .setDepth(this.getGroundDepth(pos.y, -6))
        .setVisible(!centralV2 || selected);
      point.core.setFillStyle(ownerColor, 0.78);
      point.core.setRadius(selected ? 17 : 14);
      point.core
        .setPosition(pos.x, pos.y)
        .setDepth(this.getGroundDepth(pos.y, -5))
        .setVisible(!centralV2 && point.towerBuilt);
      point.towerSprite
        .setPosition(pos.x, pos.y)
        .setOrigin(0.5, this.isPrototypeV2() ? TOWER_IMAGE_GROUND_ORIGIN_Y : 0.88);
      point.towerSprite.setDepth(this.getGroundDepth(pos.y));
      point.groundPresentation?.shadow
        .setPosition(pos.x + 20, pos.y + 12)
        .setDepth(this.getGroundDepth(pos.y, -2))
        .setVisible(this.terrainMode === "prototype" && point.id === 1 && point.towerBuilt);
      point.groundPresentationV2?.shadow
        .setPosition(
          pos.x
            + this.prototypeVisualConfig.terrain.foundationOffsetX
            + this.prototypeVisualConfig.terrain.towerShadowOffsetX,
          pos.y
            + this.prototypeVisualConfig.terrain.foundationOffsetY
            + this.prototypeVisualConfig.terrain.towerShadowOffsetY,
        )
        .setDepth(this.getGroundDepth(pos.y, -2))
        .setVisible(centralV2 && point.towerBuilt);
      point.ownerText.setText(point.owner === "player" ? "아군 점령" : point.owner === "enemy" ? "적 점령" : "중립");
      point.ownerText.setColor(point.owner === "player" ? "#cfeeff" : point.owner === "enemy" ? "#ffd8d8" : "#eadfb3");
      const selectedScale = this.isPrototypeV2() ? 1 : selected ? 1.04 : 1;
      const towerTargetCssHeight = point.definition.pointType === "fixed-fortress"
        ? this.scaleVisualConfig.fixedFortressCssHeight
        : this.scaleVisualConfig.captureTowerCssHeight;
      const towerHeight = this.isPrototypeV2()
        ? this.cssPxToWorld(towerTargetCssHeight / TOWER_IMAGE_VISIBLE_HEIGHT_RATIO) * selectedScale
        : TOWER_H * selectedScale;
      const towerWidth = this.isPrototypeV2()
        ? towerHeight * (point.towerSprite.frame.realWidth / point.towerSprite.frame.realHeight)
        : TOWER_W * selectedScale;
      const towerTop = pos.y - towerHeight * point.towerSprite.originY;
      const towerHpWidth = this.isPrototypeV2()
        ? this.cssPxToWorld(this.scaleVisualConfig.towerHpWidthCssPx)
        : 60;
      const towerHpHeight = this.isPrototypeV2()
        ? this.cssPxToWorld(this.scaleVisualConfig.towerHpHeightCssPx)
        : 7;
      const towerHpY = this.isPrototypeV2()
        ? towerTop - this.cssPxToWorld(8)
        : pos.y - 158;
      const labelY = this.isPrototypeV2()
        ? towerTop - this.cssPxToWorld(30)
        : pos.y - 190;
      const ownerY = this.isPrototypeV2()
        ? pos.y + this.cssPxToWorld(18)
        : pos.y + 34;
      const buildingY = this.isPrototypeV2()
        ? pos.y + this.cssPxToWorld(36)
        : pos.y + 52;
      point.label
        .setText(point.definition.pointType === "fixed-fortress"
          ? `중앙 고정 요새 · Lv.1`
          : point.towerBuilt
            ? `건설 거점 ${point.id + 1} · 타워 Lv.1`
            : `건설 거점 ${point.id + 1}`)
        .setPosition(pos.x, labelY)
        .setDepth(this.getGroundDepth(pos.y, 7));
      point.ownerText.setPosition(pos.x, ownerY).setDepth(this.getGroundDepth(pos.y, 7));
      point.buildingText.setPosition(pos.x, buildingY).setDepth(this.getGroundDepth(pos.y, 7));
      point.towerHpBg
        .setPosition(pos.x, towerHpY)
        .setSize(towerHpWidth, towerHpHeight)
        .setDepth(this.getGroundDepth(pos.y, 5));
      point.towerHpFill
        .setPosition(pos.x - towerHpWidth / 2, towerHpY)
        .setDepth(this.getGroundDepth(pos.y, 6));
      point.towerHpBg.setVisible(point.towerBuilt && point.owner !== "neutral");
      point.towerHpFill.setVisible(point.towerBuilt && point.owner !== "neutral");
      point.towerHpFill.setSize(
        towerHpWidth * Phaser.Math.Clamp(point.towerMaxHp > 0 ? point.towerHp / point.towerMaxHp : 0, 0, 1),
        towerHpHeight,
      );
      point.towerHpFill.setFillStyle(ownerColor, 1);
      const hpRatio = point.towerMaxHp > 0 ? point.towerHp / point.towerMaxHp : 0;
      const towerTexture = point.towerBuildRemainingSec > 0
        ? "tower-build"
        : !point.towerBuilt
          ? "tower-ruin-asset"
          : hpRatio > 0.66
            ? "tower-full"
            : hpRatio > 0.33
              ? "tower-damaged"
              : "tower-critical";
      point.towerSprite.setTexture(towerTexture);
      point.towerSprite.setAlpha(point.towerBuildRemainingSec > 0 ? 0.45 : 1);
      point.towerSprite.setDisplaySize(towerWidth, towerHeight);
      point.towerSprite.clearTint();
      if (point.owner === "enemy" && point.towerBuilt) point.towerSprite.setTint(0xffd0d0);
      if (point.owner === "neutral" && point.towerBuilt) point.towerSprite.setTint(0xe7ddb5);
      point.buildingText.setText(
        point.definition.pointType === "fixed-fortress"
          ? "고정 요새"
          : point.buildingId
            ? `${this.getBuildingDef(point.buildingId).shortLabel} Lv.${point.buildingLevel}`
            : "빈 건설 거점",
      );
      if (!point.towerBuilt && point.towerBuildRemainingSec > 0) {
        point.buildingText.setText(`${point.buildingText.text} | 타워 재건 ${Math.ceil(point.towerBuildRemainingSec)}초`);
      } else if (!point.towerBuilt) {
        point.buildingText.setText(`${point.buildingText.text} | 타워 파괴`);
      }
      if (this.isPrototypeV2()) {
        const towerFont = point.definition.pointType === "fixed-fortress"
          ? this.scaleVisualConfig.fixedFortressFontCssPx
          : this.scaleVisualConfig.towerFontCssPx;
        this.styleV2WorldText(point.label, towerFont, true);
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

  private getBuildingDef(id: BuildingId): BuildingDef {
    const found = BUILDINGS.find((entry) => entry.id === id);
    if (!found) throw new Error(`Unknown building: ${id}`);
    return found;
  }

  private getTowerBuildCost(ageId: AgeId): ResourceCost {
    const ageIndex = AGES.findIndex((age) => age.id === ageId);
    return {
      gold: 10 + ageIndex * 4,
      wood: 10 + ageIndex * 4,
      ...(ageIndex >= 2 ? { metal: 4 + ageIndex * 2 } : {}),
    };
  }

  private getTowerMaxHp(ageId: AgeId): number {
    const sampleRoster = getWaveRoster(ageId);
    const sampleUnit = sampleRoster.battleline[0]?.unitId ?? "stone_axeman";
    return UNIT_STATS[sampleUnit].hp * 5;
  }

  private getTowerAttackSpec(ageId: AgeId): TowerAttackSpec {
    const ageIndex = AGES.findIndex((age) => age.id === ageId);
    if (ageIndex >= 4) return { projectileKey: "projectile-shot", damage: 10, rangeProgress: 0.082, cooldownSec: 2.05 };
    if (ageIndex >= 2) return { projectileKey: "projectile-arrow", damage: 8, rangeProgress: 0.076, cooldownSec: 1.95 };
    return { projectileKey: "projectile-stone", damage: 6, rangeProgress: 0.072, cooldownSec: 2.0 };
  }

  private getProjectileKeyForUnit(unitId: BattleUnitId | SupportUnitId): string {
    switch (unitId) {
      case "stone_slinger":
        return "projectile-stone";
      case "archer":
        return "projectile-arrow";
      case "musketeer":
        return "projectile-shot";
      default:
        return "projectile-stone";
    }
  }

  private getUnitProjectileAnchor(unit: LaneUnit): Phaser.Math.Vector2 {
    const visibleHeight = unit.sprite.displayHeight
      * this.getUnitOpaqueMetrics(unit.currentTextureKey).visibleHeightRatio;
    return new Phaser.Math.Vector2(
      unit.sprite.x,
      unit.sprite.y - (this.terrainPrototypeEnabled ? visibleHeight * 0.58 : 10),
    );
  }

  private getTowerProjectileAnchor(point: CapturePointState, launch: boolean): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      point.towerSprite.x,
      point.towerSprite.y - (
        this.terrainPrototypeEnabled
          ? point.towerSprite.displayHeight * TOWER_IMAGE_VISIBLE_HEIGHT_RATIO * (launch ? 0.72 : 0.48)
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
    const projectile = this.add.image(start.x, start.y, textureKey)
      .setDepth(DEPTH_UNIT + Math.max(start.y, end.y) * 0.1 + 6)
      .setScale(textureKey === "projectile-shot" ? 0.9 : 1.05);
    if (this.isPrototypeV2()) {
      const cssSize = textureKey === "projectile-arrow"
        ? { width: 26, height: 9 }
        : textureKey === "projectile-shot"
          ? { width: 14, height: 14 }
          : { width: 18, height: 18 };
      projectile.setDisplaySize(
        this.cssPxToWorld(cssSize.width),
        this.cssPxToWorld(cssSize.height),
      );
    }
    projectile.setName(textureKey);
    this.activeProjectiles.add(projectile);
    this.uiCamera?.ignore(projectile);
    projectile.setRotation(Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y));
    const travel = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const duration = Phaser.Math.Clamp(travel * 1.2 * durationScale, 150, 360);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Quad.Out",
      onUpdate: (tween) => {
        const value = tween.getValue() ?? 0;
        const x = Phaser.Math.Linear(start.x, end.x, value);
        const y = Phaser.Math.Linear(start.y, end.y, value) - Math.sin(value * Math.PI) * Math.min(42, travel * 0.06);
        projectile.setPosition(x, y);
      },
      onComplete: () => {
        this.activeProjectiles.delete(projectile);
        projectile.destroy();
        onHit();
      },
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
    target.sprite.setTintFill(0xffffff);
    this.time.delayedCall(80, () => {
      if (!target.sprite.active) return;
      target.sprite.clearTint();
      target.sprite.setTint(target.team === "player" ? 0xe9f6ff : 0xffd0d0);
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

  private applyDamageToTower(point: CapturePointState, damage: number, attackerTeam: TeamId): void {
    if (!point.towerBuilt) return;
    point.towerHp = Math.max(0, point.towerHp - damage);
    this.playWorldSfx(
      "sfx.combat.towerHit",
      point.towerSprite.x,
      point.towerSprite.y,
      `impact:tower:${point.id}:${Math.round(this.elapsedSec * 1000)}`,
    );
    this.tweens.add({
      targets: point.towerSprite,
      alpha: 0.45,
      duration: 70,
      yoyo: true,
    });
    this.spawnToast(`${damage}`, point.towerSprite.x, point.towerSprite.y - 58, attackerTeam === "player" ? "#ffd67a" : "#ff8f8f");
    if (point.towerHp <= 0) {
      point.towerBuilt = false;
      point.towerTimerSec = 0;
      point.towerBuildRemainingSec = 0;
      this.audio.playSfx("sfx.fortress.destroyed", { eventKey: `tower:${point.id}:destroyed` });
      if (attackerTeam === "player") this.infoText.setText("적 타워를 파괴했습니다");
    }
  }

  private checkBasePressure(deltaSec: number): void {
    const playerThreat = this.units.filter((unit) => unit.team === "enemy" && unit.progress <= 0.04);
    const enemyThreat = this.units.filter((unit) => unit.team === "player" && unit.progress >= 0.96);

    if (playerThreat.length > 0) this.player.baseHp = Math.max(0, this.player.baseHp - playerThreat.length * 5.8 * deltaSec);
    if (enemyThreat.length > 0) this.enemy.baseHp = Math.max(0, this.enemy.baseHp - enemyThreat.length * 5.8 * deltaSec);

    if (this.player.baseHp <= 0) this.scene.start("gameover", { win: false, squadSize: 0, summary: "아군 본진이 붕괴했습니다." });
    if (this.enemy.baseHp <= 0) this.scene.start("gameover", { win: true, squadSize: 0, summary: "적 본진을 돌파했습니다." });
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
    const roster = getWaveRoster(team.ageId);
    const ageBalance = getAgeBalance(team.ageId);
    const scale = getOpponentScale(PLAYER_OPPONENT_COUNT);
    const foodCost = Math.round(ageBalance.baseWaveFoodCost * scale.foodCostMultiplier);
    if (team.resources.food < foodCost) {
      if (team.id === "player") this.infoText.setText("식량 부족으로 웨이브 출전 실패");
      if (team.id === "player") this.audio.playSfx("sfx.state.resourceShortage", { eventKey: "wave:food-shortage" });
      team.nextWaveInSec = WAVE_INTERVAL_SEC;
      return false;
    }

    team.resources.food -= foodCost;
    team.nextWaveInSec = WAVE_INTERVAL_SEC;
    team.lastWaveElapsedSec = 0;
    this.spawnWaveUnits(team, roster);

    if (team.id === "player") this.infoText.setText(forced ? "즉시 웨이브를 투입했습니다" : "정규 웨이브가 출전했습니다");
    if (team.id === "player") {
      this.audio.playSfx("sfx.wave.start", { eventKey: `wave:start:${Math.round(this.elapsedSec * 10)}` });
      this.audio.setDirectorState("battle-low");
      this.combatAudioEventTimes.push(this.elapsedSec * 1000);
    }
    return true;
  }

  private deployOpeningWave(team: TeamState): void {
    this.spawnWaveUnits(team, getWaveRoster(team.ageId), team.id === "player" ? 0.12 : 0.88);
    team.nextWaveInSec = WAVE_INTERVAL_SEC;
    team.lastWaveElapsedSec = 0;
    if (team.id === "player") {
      this.audio.playSfx("sfx.wave.start", { eventKey: "wave:opening" });
      this.audio.setDirectorState("battle-low");
      this.combatAudioEventTimes.push(this.elapsedSec * 1000);
    }
  }

  private setupVisualValidationScenario(): void {
    this.units.forEach((unit) => this.destroyUnitPresentation(unit));
    this.units = [];

    const buildable = this.capturePoints[0];
    buildable.owner = "player";
    buildable.control = 1;
    buildable.towerBuilt = false;
    buildable.towerHp = 0;
    buildable.towerBuildRemainingSec = 0;
    buildable.buildingId = undefined;
    buildable.buildingLevel = 0;

    const fortress = this.capturePoints[1];
    fortress.owner = "player";
    fortress.control = 1;
    fortress.towerBuilt = true;
    fortress.towerHp = fortress.towerMaxHp * 0.62;
    fortress.towerBuildRemainingSec = 0;

    const enemyPoint = this.capturePoints[2];
    enemyPoint.owner = "enemy";
    enemyPoint.control = -1;
    enemyPoint.towerBuilt = true;
    enemyPoint.towerHp = enemyPoint.towerMaxHp;

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
    this.selectCapturePoint(fortress.id);
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
    unit.label.destroy();
  }

  private setUnitPresentationVisible(unit: LaneUnit, visible: boolean): void {
    unit.sprite.setVisible(visible);
    unit.shadow.setVisible(visible);
    unit.selectionRing.setVisible(visible && (unit.selected || unit.hovered));
    unit.hpBg.setVisible(visible);
    unit.hpFill.setVisible(visible);
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
    const pos = this.progressToScreen(progress, laneRow);
    const displaySize = role === "support" ? 86 : 76;
    const initialTextureKey = this.getAnimatedTexture(unitId, "idle") ?? stats.textureKey;
    const shadow = this.add.ellipse(pos.x, pos.y + 22, role === "support" ? 56 : 46, role === "support" ? 20 : 16, 0x000000, 0.2)
      .setDepth(this.getGroundDepth(pos.y, -1));
    const selectionRing = this.add.ellipse(pos.x, pos.y, 62, 24, 0x72c8ff, 0.12)
      .setStrokeStyle(3, team === "player" ? 0x8bd7ff : 0xffa0a0, 0.9)
      .setDepth(this.getGroundDepth(pos.y, -2))
      .setVisible(false);
    const sprite = this.add.image(pos.x, pos.y, initialTextureKey).setDepth(this.getGroundDepth(pos.y));
    sprite.setDisplaySize(displaySize, displaySize);
    sprite.setTint(team === "player" ? 0xe9f6ff : 0xffd0d0);
    const hpBg = this.add.rectangle(pos.x, pos.y - 44, 34, 5, 0x132033, 0.92).setDepth(sprite.depth + 1);
    const hpFill = this.add.rectangle(pos.x - 17, pos.y - 44, 34, 5, team === "player" ? 0x62d4a3 : 0xf06f6f, 1).setOrigin(0, 0.5).setDepth(sprite.depth + 2);
    const label = this.add.text(pos.x, pos.y - 58, stats.label, {
      fontFamily: "sans-serif",
      fontSize: "10px",
      color: team === "player" ? "#dbf0ff" : "#ffd9d9",
      stroke: "#132033",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(sprite.depth + 3);
    this.uiCamera?.ignore([shadow, selectionRing, sprite, hpBg, hpFill, label]);

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
      healPower: stats.healPower ?? 0,
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
    target.sprite.setTintFill(0xffffff);
    this.time.delayedCall(80, () => {
      if (!target.sprite.active) return;
      target.sprite.clearTint();
      target.sprite.setTint(target.team === "player" ? 0xe9f6ff : 0xffd0d0);
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

  private getV2UnitWorldHeight(unit: LaneUnit): number {
    const roleFactor = unit.unitId === "stone_slinger"
      ? 0.96
      : unit.unitId === "stone_axeman"
        ? 1.04
        : 1;
    const targetVisibleCssHeight = unit.role === "support"
      ? this.scaleVisualConfig.supportUnitCssHeight
      : unit.unitId === "knight"
        ? this.scaleVisualConfig.largeUnitCssHeight
        : this.scaleVisualConfig.normalUnitCssHeight * roleFactor;
    const metrics = this.getUnitOpaqueMetrics(unit.currentTextureKey);
    return this.cssPxToWorld(targetVisibleCssHeight / metrics.visibleHeightRatio);
  }

  private getUnitOpaqueMetrics(textureKey: string): SpriteOpaqueMetrics {
    return UNIT_POSE_OPAQUE_METRICS[textureKey] ?? {
      visibleHeightRatio: 1,
      groundOriginY: UNIT_IMAGE_GROUND_ORIGIN_Y,
    };
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
    const desiredTexture = this.getUnitPoseTexture(unit, moving);
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

    const gait = this.elapsedSec * 10 + unit.bobPhase;
    const bob = moving ? Math.sin(gait) * 1.1 : Math.sin(this.elapsedSec * 4 + unit.bobPhase) * 0.35;
    const attackProgress = unit.attackAnimTime > 0
      ? 1 - unit.attackAnimTime / ATTACK_VISUAL_DURATION_SEC
      : 0;
    const attackEase = attackProgress > 0 ? Math.sin(attackProgress * Math.PI) : 0;
    const meleeLunge = this.isMeleeUnit(unit) ? attackEase * 11 * unit.facingX : 0;
    const rangedRecoil = this.isRangedUnit(unit) ? -attackEase * 5 * unit.facingX : 0;
    const supportReach = unit.role === "support" ? attackEase * 4 * unit.facingX : 0;
    const attackOffsetX = meleeLunge + rangedRecoil + supportReach;
    const attackLift = attackEase * (this.isMeleeUnit(unit) ? 1.4 : 0.6);
    const legacyScale = unit.role === "support" ? 1.08 : 1;
    const prototypeHeight = this.isPrototypeV2()
      ? this.getV2UnitWorldHeight(unit)
      : unit.role === "support" ? 118 : 112;
    const frameAspect = unit.sprite.frame.realHeight > 0
      ? unit.sprite.frame.realWidth / unit.sprite.frame.realHeight
      : 1;
    const spriteWidth = this.terrainPrototypeEnabled
      ? prototypeHeight * frameAspect
      : unit.displaySize * legacyScale;
    const spriteHeight = this.terrainPrototypeEnabled
      ? prototypeHeight
      : unit.displaySize * legacyScale;
    const opaqueMetrics = this.getUnitOpaqueMetrics(unit.currentTextureKey);
    const originY = this.isPrototypeV2()
      ? opaqueMetrics.groundOriginY
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
      ? spriteHeight * opaqueMetrics.visibleHeightRatio
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
        pos.x + (this.terrainPrototypeEnabled ? 5 : 0),
        pos.y + (this.terrainPrototypeEnabled ? 4 : 24),
      )
      .setSize(shadowWidth, shadowHeight)
      .setRotation(this.terrainPrototypeEnabled ? -0.2 : 0)
      .setFillStyle(0x061016, this.terrainPrototypeEnabled ? 0.34 : 0.2)
      .setScale(moving ? 0.96 : 1, moving ? 0.94 : 1)
      .setDepth(this.getGroundDepth(pos.y, -1));
    unit.selectionRing
      .setPosition(pos.x, pos.y + 3)
      .setSize(Math.max(52, spriteWidth * 1.08), Math.max(20, shadowHeight * 1.45))
      .setDepth(this.getGroundDepth(pos.y, -2))
      .setVisible(this.isPrototypeV2() && (unit.selected || unit.hovered));
    unit.sprite
      .setPosition(pos.x + attackOffsetX, pos.y - bob - attackLift)
      .setOrigin(0.5, originY)
      .setRotation(0)
      .setFlipX(this.isPrototypeV2() && unit.facingX < 0)
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

  private getUnitPoseTexture(unit: LaneUnit, moving: boolean): string {
    if (unit.attackAnimTime > 0.02) {
      return this.getAnimatedTexture(unit.unitId, "attack") ?? UNIT_STATS[unit.unitId].textureKey;
    }
    if (moving) {
      const phase = Math.sin(this.elapsedSec * 9 + unit.bobPhase) >= 0 ? "walk-a" : "walk-b";
      return this.getAnimatedTexture(unit.unitId, phase) ?? UNIT_STATS[unit.unitId].textureKey;
    }
    return this.getAnimatedTexture(unit.unitId, "idle") ?? UNIT_STATS[unit.unitId].textureKey;
  }

  private getAnimatedTexture(unitId: BattleUnitId | SupportUnitId, pose: "idle" | "walk-a" | "walk-b" | "attack"): string | undefined {
    switch (unitId) {
      case "stone_slinger":
        return `stone-slinger-${pose}`;
      case "stone_axeman":
        return `stone-axeman-${pose}`;
      case "supply_wagon":
        return `stone-supply-${pose}`;
      default:
        return undefined;
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
      this.infoText.setText("일꾼 고용 실패: 금/목재/식량 부족");
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: "hire:worker:shortage" });
      return;
    }
    payCost(this.player.resources, BASE_WORKER_COST);
    this.player.workers.idle += 1;
    this.infoText.setText("일꾼 1명을 고용했습니다");
    this.audio.playSfx("sfx.ui.hireSuccess", { eventKey: `hire:worker:${this.player.workers.idle}` });
  }

  private hireResearchWorker(): void {
    if (canAfford(this.player.resources, RESEARCH_WORKER_DIRECT_COST)) {
      payCost(this.player.resources, RESEARCH_WORKER_DIRECT_COST);
      this.player.workers.research += 1;
      this.infoText.setText("연구 일꾼을 직접 고용했습니다");
      this.audio.playSfx("sfx.ui.hireSuccess", { eventKey: `hire:research:direct:${this.player.workers.research}` });
      return;
    }

    if (this.totalConvertibleWorkers() >= RESEARCH_WORKER_CONVERSION.workerCount) {
      let remaining = RESEARCH_WORKER_CONVERSION.workerCount;
      (["idle", "gold", "wood", "food", "metal"] as WorkerRole[]).forEach((role) => {
        if (remaining <= 0) return;
        const spend = Math.min(remaining, this.player.workers[role]);
        this.player.workers[role] -= spend;
        remaining -= spend;
      });
      this.player.workers.research += RESEARCH_WORKER_CONVERSION.resultCount;
      this.infoText.setText("일반 일꾼 10명을 연구 일꾼으로 전환했습니다");
      this.audio.playSfx("sfx.ui.hireSuccess", { eventKey: `hire:research:convert:${this.player.workers.research}` });
      return;
    }

    this.infoText.setText("연구 일꾼 조건 미달");
    this.audio.playSfx("sfx.ui.hireFail", { eventKey: "hire:research:failed" });
  }

  private totalConvertibleWorkers(): number {
    return this.player.workers.idle + this.player.workers.gold + this.player.workers.wood + this.player.workers.food + this.player.workers.metal;
  }

  private tryUseInstantWaveToken(team: TeamState): void {
    if (team.instantWaveTokens <= 0) {
      if (team.id === "player") this.infoText.setText("즉시 웨이브 토큰이 없습니다");
      if (team.id === "player") this.audio.playSfx("sfx.ui.hireFail", { eventKey: "wave:instant:no-token" });
      return;
    }
    if (team.lastWaveElapsedSec < INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC) {
      if (team.id === "player") this.infoText.setText("직전 웨이브 후 10초 뒤 사용 가능");
      if (team.id === "player") this.audio.playSfx("sfx.ui.cancel", { eventKey: "wave:instant:cooldown" });
      return;
    }
    if (this.trySpawnWave(team, true)) team.instantWaveTokens -= 1;
  }

  private tryAgeUpPlayer(): void {
    const idx = AGES.findIndex((age) => age.id === this.player.ageId);
    if (idx >= AGES.length - 1) {
      this.infoText.setText("이미 최종 시대입니다");
      this.audio.playSfx("sfx.ui.cancel", { eventKey: "age:max" });
      return;
    }
    const cost = this.getAgeUpCost(idx);
    if (!canAfford(this.player.resources, cost)) {
      this.infoText.setText("시대 업 실패: 금/목재/금속 부족");
      this.audio.playSfx("sfx.state.resourceShortage", { eventKey: "age:shortage" });
      return;
    }
    payCost(this.player.resources, cost);
    this.advanceAge(this.player);
    this.infoText.setText(`${getAge(this.player.ageId).label} 도달`);
    this.audio.playSfx("sfx.ui.confirm", { eventKey: `age:${this.player.ageId}` });
  }

  private getAgeUpCost(ageIndex: number): ResourceCost {
    return {
      gold: 35 + ageIndex * 20,
      wood: 20 + ageIndex * 15,
      metal: 28 + ageIndex * 20,
    };
  }

  private advanceAge(team: TeamState): void {
    const idx = AGES.findIndex((age) => age.id === team.ageId);
    if (idx >= AGES.length - 1) return;
    team.ageId = AGES[idx + 1].id;
    if (getAge(team.ageId).immediateWaveTokenGranted) this.grantInstantWaveToken(team);
    if (team.id === "player") this.refreshUi();
  }

  private grantInstantWaveToken(team: TeamState): void {
    team.instantWaveTokens += 1;
  }

  private refreshUi(): void {
    this.ageText.setText(`시대 ${getAge(this.player.ageId).label}`);
    this.waveText.setText(`다음 웨이브 ${Math.max(0, Math.ceil(this.player.nextWaveInSec))}초 | 적 ${Math.max(0, Math.ceil(this.enemy.nextWaveInSec))}초`);
    this.baseText.setText(`전장 병력 ${this.units.filter((unit) => unit.team === "player").length} | 적 병력 ${this.units.filter((unit) => unit.team === "enemy").length}`);
    this.tokensText.setText(`즉시 웨이브 토큰 ${this.player.instantWaveTokens}`);

    MVP_ACTIVE_RESOURCE_IDS.forEach((resourceId) => {
      const value = this.player.resources[resourceId];
      this.resourceTexts.get(resourceId)?.setText(resourceId === "food" ? Math.floor(value).toString() : Math.round(value).toString());
    });

    this.workerRows.forEach((row, role) => {
      row.value.setText(String(this.player.workers[role]));
      const active = role !== "idle" && this.player.workers.idle > 0;
      row.plus.setFillStyle(active ? 0x324a73 : 0x1d2634, 0.96);
      row.minus.setFillStyle(this.player.workers[role] > 0 && role !== "idle" ? 0x324a73 : 0x1d2634, 0.96);
    });

    this.playerBaseBar.width = 220 * Phaser.Math.Clamp(this.player.baseHp / PLAYER_BASE_HP, 0, 1);
    this.enemyBaseBar.width = 220 * Phaser.Math.Clamp(this.enemy.baseHp / ENEMY_BASE_HP, 0, 1);
    this.playerBaseBar.setOrigin(0, 0.5);
    this.enemyBaseBar.setOrigin(0, 0.5);

    const roster = getWaveRoster(this.player.ageId);
    const rosterSummary = roster.battleline.map((entry) => `${UNIT_STATS[entry.unitId].label}${entry.count}`).join(" · ");
    this.rosterText.setText([
      `다음 웨이브: ${rosterSummary}`,
      `보급대 ${roster.support[0]?.count ?? 0}기 포함`,
      `웨이브 식량 ${Math.round(getAgeBalance(this.player.ageId).baseWaveFoodCost * getOpponentScale(PLAYER_OPPONENT_COUNT).foodCostMultiplier)}`,
    ]);

    const selected = this.capturePoints.find((point) => point.id === this.selectedCapturePointId) ?? this.capturePoints[0];
    const selectedActions = this.getSelectedCaptureActions();
    this.captureActionButtons.forEach((button, action) => {
      this.setCaptureActionButtonVisible(button, selectedActions.includes(action));
    });
    this.capturePanelTitle.setText(selected
      ? selected.definition.pointType === "fixed-fortress"
        ? `고정 요새 · 거점 ${selected.id + 1}`
        : `건설 거점 ${selected.id + 1}`
      : "거점 선택");
    this.capturePanelBody.setText(selected
      ? [
          `소유 ${selected.owner === "player" ? "아군" : selected.owner === "enemy" ? "적" : "중립"} | 점령 ${Math.round(Math.abs(selected.control) * 100)}%`,
          `타워 ${selected.towerBuilt ? `가동 중 HP ${Math.round(selected.towerHp)}/${Math.round(selected.towerMaxHp)}` : selected.towerBuildRemainingSec > 0 ? `재건 ${Math.ceil(selected.towerBuildRemainingSec)}초` : "파괴됨"}`,
          selected.definition.pointType === "fixed-fortress"
            ? "고정 요새 전용 | 교체·폐기 불가"
            : `건설 ${selected.buildingId ? `${this.getBuildingDef(selected.buildingId).label} Lv.${selected.buildingLevel}` : "없음"} | 폐기 ${DISMANTLE_COST_GOLD}G`,
        ]
      : ["거점을 터치해 선택", "점령 후 건설 가능"]);
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
        motion: { x: unit.motionX, y: unit.motionY },
        pose: unit.currentTextureKey,
        attackAnimTime: unit.attackAnimTime,
      })),
      battlefield: {
        capturePoints: this.battlefield.capturePoints,
        controlPoints: this.capturePoints.map((point) => ({
          id: point.id,
          pointType: point.definition.pointType,
          allowedBuildingTypes: point.definition.allowedBuildingTypes,
          owner: point.owner,
          control: point.control,
          buildingId: point.buildingId ?? null,
          availableActions: getCapturePointActions(point.definition, point),
        })),
        laneStart: { x: this.laneStart.x, y: this.laneStart.y },
        laneEnd: { x: this.laneEnd.x, y: this.laneEnd.y },
      },
      ui: {
        selectedCapturePointId: this.selectedCapturePointId,
        visibleCaptureActions: [...this.captureActionButtons.entries()]
          .filter(([, button]) => button.rect.visible && button.text.visible)
          .map(([action]) => action),
      },
      activeProjectiles: [...this.activeProjectiles].map((projectile) => ({
        textureKey: projectile.name,
        x: projectile.x,
        y: projectile.y,
      })),
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
              * this.getUnitOpaqueMetrics(unit.currentTextureKey).visibleHeightRatio
              * this.cameras.main.zoom
              * this.getCanvasCssScale(),
            originY: unit.sprite.originY,
            hpWorldWidth: unit.hpBg.width,
            hpWorldHeight: unit.hpBg.height,
            hpCssWidth: unit.hpBg.width * this.cameras.main.zoom * this.getCanvasCssScale(),
            hpCssHeight: unit.hpBg.height * this.cameras.main.zoom * this.getCanvasCssScale(),
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
          captureTowers: this.capturePoints.map((point) => ({
            id: point.id,
            pointType: point.definition.pointType,
            textureKey: point.towerSprite.texture.key,
            cssFrameHeight: point.towerSprite.displayHeight
              * this.cameras.main.zoom
              * this.getCanvasCssScale(),
            cssVisibleHeight: point.towerSprite.displayHeight
              * TOWER_IMAGE_VISIBLE_HEIGHT_RATIO
              * this.cameras.main.zoom
              * this.getCanvasCssScale(),
            originY: point.towerSprite.originY,
          })),
          centralTower: (() => {
            const point = this.capturePoints[1];
            return point ? {
              pointType: point.definition.pointType,
              worldWidth: point.towerSprite.displayWidth,
              worldHeight: point.towerSprite.displayHeight,
              cssFrameWidth: point.towerSprite.displayWidth * this.cameras.main.zoom * this.getCanvasCssScale(),
              cssFrameHeight: point.towerSprite.displayHeight * this.cameras.main.zoom * this.getCanvasCssScale(),
              cssVisibleHeight: point.towerSprite.displayHeight
                * TOWER_IMAGE_VISIBLE_HEIGHT_RATIO
                * this.cameras.main.zoom
                * this.getCanvasCssScale(),
              originY: point.towerSprite.originY,
              hpWorldWidth: point.towerHpBg.width,
              hpWorldHeight: point.towerHpBg.height,
              hpCssWidth: point.towerHpBg.width * this.cameras.main.zoom * this.getCanvasCssScale(),
              hpCssHeight: point.towerHpBg.height * this.cameras.main.zoom * this.getCanvasCssScale(),
              labelCssFontSize: Number.parseFloat(String(point.label.style.fontSize))
                * this.cameras.main.zoom
                * this.getCanvasCssScale(),
              labelResolution: point.label.style.resolution,
              labelScale: point.label.scaleX,
              availableActions: getCapturePointActions(point.definition, point),
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

  private getWorkerRoleLabel(role: WorkerRole): string {
    switch (role) {
      case "gold":
        return "금";
      case "wood":
        return "목재";
      case "food":
        return "식량";
      case "metal":
        return "금속";
      case "research":
        return "연구";
      case "idle":
        return "대기";
      default:
        return role;
    }
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
