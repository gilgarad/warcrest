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
import { generateBattlefield, type BattlefieldResult } from "../systems/battlefieldGenerator";
import { getMusicController } from "../systems/musicController";

const CANVAS_W = 1600;
const CANVAS_H = 900;
const WORLD_W = 4200;
const WORLD_H = 2304;
const DEPTH_BG = 0;
const DEPTH_FIELD = 100;
const DEPTH_UNIT = 250;
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
const FIELD_CAMERA_ZOOM = 0.64;

type TeamId = "player" | "enemy";
type WorkerRole = "gold" | "wood" | "food" | "metal" | "research" | "idle";
type WorkerResourceId = "gold" | "wood" | "food" | "metal";
type UnitTextureKey =
  | "token-axe"
  | "stone-slinger-unit"
  | "stone-axeman-unit"
  | "stone-supply-unit"
  | "token-spear"
  | "token-ranged"
  | "token-elite"
  | "token-support";
type BuildingId = "watchtower" | "supply_depot" | "mint";

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
  healPower: number;
  attrition: number;
  displaySize: number;
  bobPhase: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

interface WorkerUiRow {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  plus: Phaser.GameObjects.Arc;
  minus: Phaser.GameObjects.Arc;
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

interface CapturePointState {
  id: number;
  progress: number;
  owner: TeamId | "neutral";
  control: number;
  buildingId?: BuildingId;
  buildingLevel: number;
  incomeTimerSec: number;
  towerTimerSec: number;
  supplyTimerSec: number;
  ring: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Arc;
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
    cost: { gold: 24, wood: 18 },
    description: "근처 적을 자동 공격",
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
  private readonly laneStart = new Phaser.Math.Vector2(360, 1720);
  private readonly laneEnd = new Phaser.Math.Vector2(3880, 760);
  private laneDir = new Phaser.Math.Vector2();
  private lanePerp = new Phaser.Math.Vector2();
  private isDraggingField = false;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private readonly worldObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly uiObjects: Phaser.GameObjects.GameObject[] = [];

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

  constructor() {
    super("run");
  }

  preload(): void {
    this.load.image("lane-battlefield-bg", "/assets/battle/lane-battlefield-bg-wide-v2.png");
    this.load.image("war-table-hud", "/assets/battle/war-table-hud.png");
    this.load.image("stone-slinger-unit", "/assets/lane-units/stone-slinger-unit.png");
    this.load.image("stone-axeman-unit", "/assets/lane-units/stone-axeman-unit.png");
    this.load.image("stone-supply-unit", "/assets/lane-units/stone-supply-unit.png");
  }

  create(): void {
    getMusicController().setMode("battle");
    void getMusicController().unlockAndStart("battle").catch(() => undefined);
    this.battlefield = generateBattlefield();
    this.laneDir = this.laneEnd.clone().subtract(this.laneStart).normalize();
    this.lanePerp = new Phaser.Math.Vector2(-this.laneDir.y, this.laneDir.x);
    this.cameras.main.setBackgroundColor(0x081018);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setZoom(FIELD_CAMERA_ZOOM);
    this.cameras.main.centerOn(1500, 1260);

    this.createUnitTokenTextures();

    this.player = this.createTeamState("player", makeResourceMap(60, 40, 18, 18));
    this.enemy = this.createTeamState("enemy", makeResourceMap(60, 40, 18, 18));

    this.drawBattlefield();
    this.worldObjects.push(...this.children.list);
    this.createUiIconTextures();
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
    this.setupFieldDrag();
    this.refreshUi();
    this.publishDebug();
  }

  update(_time: number, deltaMs: number): void {
    const deltaSec = deltaMs / 1000;
    this.elapsedSec += deltaSec;
    this.tickEconomy(deltaSec);
    this.tickAi(deltaSec);
    this.tickWaves(deltaSec);
    this.tickCombat(deltaSec);
    this.tickCapturePoints(deltaSec);
    this.refreshUi();
    this.publishDebug();
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
      this.cameras.main.scrollX = Phaser.Math.Clamp(
        this.cameras.main.scrollX - (pointer.x - pointer.prevPosition.x),
        0,
        WORLD_W - CANVAS_W,
      );
      this.cameras.main.scrollY = Phaser.Math.Clamp(
        this.cameras.main.scrollY - (pointer.y - pointer.prevPosition.y),
        0,
        WORLD_H - CANVAS_H,
      );
    });
  }

  private isPointerOnUi(pointer: Phaser.Input.Pointer): boolean {
    return pointer.y <= 250 || pointer.y >= CANVAS_H - 260;
  }

  private drawBattlefield(): void {
    this.add.image(WORLD_W / 2, WORLD_H / 2, "lane-battlefield-bg").setDisplaySize(WORLD_W, WORLD_H).setDepth(DEPTH_BG);
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x07111b, 0.12).setDepth(DEPTH_BG + 1);

    const laneGlow = this.add.graphics().setDepth(DEPTH_FIELD);
    laneGlow.lineStyle(82, 0xffffff, 0.05);
    laneGlow.beginPath();
    laneGlow.moveTo(this.laneStart.x, this.laneStart.y);
    laneGlow.lineTo(this.laneEnd.x, this.laneEnd.y);
    laneGlow.strokePath();
    laneGlow.lineStyle(18, 0xf2e0a4, 0.18);
    laneGlow.beginPath();
    laneGlow.moveTo(this.laneStart.x, this.laneStart.y);
    laneGlow.lineTo(this.laneEnd.x, this.laneEnd.y);
    laneGlow.strokePath();

    const progressPoints = this.battlefield.capturePoints.map((point) => {
      const minX = this.battlefield.playerSpawn.x;
      const maxX = this.battlefield.enemySpawn.x;
      return (point.x - minX) / (maxX - minX);
    });
    this.capturePoints = progressPoints.map((progress, index) => {
      const pos = this.progressToScreen(progress, 0);
      const ring = this.add.circle(pos.x, pos.y, 34, 0xf3cc6a, 0.2).setDepth(DEPTH_FIELD + 2).setStrokeStyle(4, 0xf8e2a5, 0.55);
      const core = this.add.circle(pos.x, pos.y, 14, 0xf8e2a5, 0.78).setDepth(DEPTH_FIELD + 3);
      const label = this.add.text(pos.x, pos.y - 40, `거점 ${index + 1}`, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#fff4cf",
        stroke: "#1a130a",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH_FIELD + 4);
      const ownerText = this.add.text(pos.x, pos.y + 28, "중립", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#eadfb3",
        stroke: "#1a130a",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH_FIELD + 4);
      const buildingText = this.add.text(pos.x, pos.y + 46, "빈 거점", {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: "#d3d8e8",
        stroke: "#132033",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH_FIELD + 4);

      ring.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));
      core.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));
      label.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectCapturePoint(index));

      return {
        id: index,
        progress,
        owner: "neutral",
        control: 0,
        buildingId: undefined,
        buildingLevel: 0,
        incomeTimerSec: 0,
        towerTimerSec: 0,
        supplyTimerSec: 0,
        ring,
        core,
        label,
        ownerText,
        buildingText,
      };
    });

    const playerBase = this.progressToScreen(0.02, -1.9);
    const enemyBase = this.progressToScreen(0.98, 1.9);
    this.add.circle(playerBase.x, playerBase.y, 60, 0x4ea5ff, 0.22).setDepth(DEPTH_FIELD + 2);
    this.add.circle(enemyBase.x, enemyBase.y, 60, 0xff6b6b, 0.22).setDepth(DEPTH_FIELD + 2);
    this.add.text(playerBase.x - 8, playerBase.y - 48, "아군 본진", {
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      color: "#dceeff",
      stroke: "#16202a",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH_FIELD + 4);
    this.add.text(enemyBase.x + 4, enemyBase.y - 48, "적 본진", {
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      color: "#ffe1e1",
      stroke: "#2a1616",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH_FIELD + 4);
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

    this.createActionButton(882, 670, 150, 34, "요새", () => this.tryBuildAtSelectedPoint("watchtower"));
    this.createActionButton(882, 712, 150, 34, "병참", () => this.tryBuildAtSelectedPoint("supply_depot"));
    this.createActionButton(882, 754, 150, 34, "조달소", () => this.tryBuildAtSelectedPoint("mint"));
    this.createActionButton(882, 796, 150, 30, "폐기", () => this.tryDismantleSelectedPoint());

    this.playerBaseBar = this.add.rectangle(160, 228, 220, 12, 0x4fc1ff, 1).setOrigin(0, 0.5).setDepth(DEPTH_UI + 2);
    this.enemyBaseBar = this.add.rectangle(1218, 228, 220, 12, 0xff7373, 1).setOrigin(0, 0.5).setDepth(DEPTH_UI + 2);
    this.add.rectangle(160, 228, 220, 12, 0, 0).setOrigin(0, 0.5).setStrokeStyle(2, 0xd6e3f1, 0.4).setDepth(DEPTH_UI + 1);
    this.add.rectangle(1218, 228, 220, 12, 0, 0).setOrigin(0, 0.5).setStrokeStyle(2, 0xd6e3f1, 0.4).setDepth(DEPTH_UI + 1);
    this.add.text(160, 204, "아군 본진", { fontFamily: "sans-serif", fontSize: "12px", color: "#c7e5ff" }).setDepth(DEPTH_UI + 2);
    this.add.text(1218, 204, "적 본진", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffd0d0" }).setDepth(DEPTH_UI + 2);
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

  private createActionButton(x: number, y: number, w: number, h: number, label: string, onClick: () => void): void {
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
    rect.on("pointerover", () => rect.setFillStyle(0x274165, 0.98));
    rect.on("pointerout", () => rect.setFillStyle(0x1d2d47, 0.95));
    rect.on("pointerdown", () => {
      rect.setFillStyle(0x37567f, 1);
      this.time.delayedCall(100, () => rect.setFillStyle(0x1d2d47, 0.95));
      onClick();
    });

    text.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
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
    this.player.nextWaveInSec -= deltaSec;
    this.player.lastWaveElapsedSec += deltaSec;
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
      unit.attackTimerSec -= deltaSec;
      if (unit.role === "support") {
        this.tickSupport(unit, deltaSec);
        return;
      }
      const nearest = this.findNearestEnemy(unit);
      if (!nearest) {
        this.advanceUnit(unit, deltaSec);
        return;
      }
      const distance = this.unitDistance(unit, nearest);
      const attackRange = unit.range * RANGE_TO_PROGRESS;
      if (distance > attackRange) {
        this.advanceUnit(unit, deltaSec);
        return;
      }
      if (unit.attackTimerSec <= 0) {
        unit.attackTimerSec = unit.attackCooldownSec;
        unit.attackAnimTime = 0.24;
        const damageBase = unit.attack * (1 - unit.attrition);
        const damage = Math.max(1, Math.round(damageBase - nearest.defense * 0.35));
        nearest.hp -= damage;
        this.playImpactFeedback(unit, nearest, damage);
        this.spawnToast(`${damage}`, nearest.sprite.x, nearest.sprite.y - 26, unit.team === "player" ? "#ffd67a" : "#ff8f8f");
        if (nearest.hp <= 0) deaths.add(nearest);
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

  private advanceUnit(unit: LaneUnit, deltaSec: number): void {
    const dir = unit.team === "player" ? 1 : -1;
    const desired = unit.progress + dir * unit.speed * UNIT_PROGRESS_SPEED * deltaSec;
    const enemyAhead = this.findNearestEnemy(unit);
    if (enemyAhead) this.repositionTowardCombat(unit, enemyAhead);
    if (enemyAhead && this.unitDistance(unit, enemyAhead) <= ENGAGE_GAP + unit.range * RANGE_TO_PROGRESS * 0.3) return;

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
          return;
        }
      }
    }

    unit.progress = Phaser.Math.Clamp(desired, 0.01, 0.99);
  }

  private repositionTowardCombat(unit: LaneUnit, enemy: LaneUnit): void {
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
    return true;
  }

  private isLaneRowFree(unit: LaneUnit, laneRow: number): boolean {
    return !this.units.some((other) => other.id !== unit.id && other.team === unit.team && Math.abs(other.laneRow - laneRow) < 0.5 && progressBetween(other.progress, unit.progress) < FRIENDLY_GAP);
  }

  private findNearestEnemy(unit: LaneUnit): LaneUnit | undefined {
    return this.units
      .filter((other) => other.team !== unit.team)
      .sort((a, b) => this.unitDistance(unit, a) - this.unitDistance(unit, b))[0];
  }

  private unitDistance(a: LaneUnit, b: LaneUnit): number {
    const progressDistance = progressBetween(a.progress, b.progress);
    const rowDistance = Math.abs(a.laneRow - b.laneRow) * 0.01;
    return Math.sqrt(progressDistance * progressDistance + rowDistance * rowDistance);
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

      if (point.buildingId === "watchtower") this.tickWatchtower(point, deltaSec);
      if (point.buildingId === "supply_depot") this.tickSupplyDepot(point, deltaSec);
      if (point.buildingId === "mint") this.tickMint(point, deltaSec);
    });

    this.enemyAutoBuildCapturePoint();
    this.refreshCapturePointVisuals();
  }

  private tickWatchtower(point: CapturePointState, deltaSec: number): void {
    point.towerTimerSec -= deltaSec;
    if (point.owner === "neutral" || point.towerTimerSec > 0) return;
    const target = this.units
      .filter((unit) => unit.team !== point.owner && progressBetween(unit.progress, point.progress) <= CAPTURE_RADIUS_PROGRESS)
      .sort((a, b) => a.hp - b.hp)[0];
    if (!target) return;
    point.towerTimerSec = 1.2;
    target.hp -= 6 + point.buildingLevel * 2;
    this.spawnToast("요새", target.sprite.x, target.sprite.y - 32, point.owner === "player" ? "#8fd2ff" : "#ffb4b4");
    if (target.hp <= 0) this.killUnit(target);
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
    this.refreshCapturePointVisuals();
  }

  private tryBuildAtSelectedPoint(buildingId: BuildingId): void {
    const point = this.capturePoints.find((entry) => entry.id === this.selectedCapturePointId);
    if (!point) {
      this.infoText.setText("먼저 거점을 선택하십시오");
      return;
    }
    if (point.owner !== "player") {
      this.infoText.setText("아군 점령 거점에서만 건설 가능합니다");
      return;
    }
    if (point.buildingId) {
      this.infoText.setText("이미 건설된 거점입니다");
      return;
    }
    const building = BUILDINGS.find((entry) => entry.id === buildingId);
    if (!building) return;
    if (!canAfford(this.player.resources, building.cost)) {
      this.infoText.setText(`${building.label} 건설 자원 부족`);
      return;
    }
    payCost(this.player.resources, building.cost);
    point.buildingId = buildingId;
    point.buildingLevel = 1;
    point.incomeTimerSec = 4;
    point.towerTimerSec = 0.4;
    point.supplyTimerSec = 0.4;
    this.infoText.setText(`${building.label} 건설 완료`);
    this.refreshCapturePointVisuals();
  }

  private enemyAutoBuildCapturePoint(): void {
    const target = this.capturePoints.find((point) => point.owner === "enemy" && !point.buildingId);
    if (!target) return;
    const choice = BUILDINGS[target.id % BUILDINGS.length];
    if (!canAfford(this.enemy.resources, choice.cost)) return;
    payCost(this.enemy.resources, choice.cost);
    target.buildingId = choice.id;
    target.buildingLevel = 1;
    target.incomeTimerSec = 4;
    target.towerTimerSec = 0.4;
    target.supplyTimerSec = 0.4;
  }

  private tryDismantleSelectedPoint(): void {
    const point = this.capturePoints.find((entry) => entry.id === this.selectedCapturePointId);
    if (!point || point.owner !== "player" || !point.buildingId) {
      this.infoText.setText("폐기할 아군 거점 건물이 없습니다");
      return;
    }
    if (this.player.resources.gold < DISMANTLE_COST_GOLD) {
      this.infoText.setText("폐기 비용이 부족합니다");
      return;
    }
    this.player.resources.gold -= DISMANTLE_COST_GOLD;
    point.buildingId = undefined;
    point.buildingLevel = 0;
    this.infoText.setText(`거점 건물을 폐기했습니다 (-${DISMANTLE_COST_GOLD}G)`);
    this.refreshCapturePointVisuals();
  }

  private resolveCapturedStructure(point: CapturePointState, toOwner: TeamId): void {
    if (!point.buildingId || point.buildingLevel <= 0) return;
    const destroyed = Math.random() < 0.7;
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

  private refreshCapturePointVisuals(): void {
    this.capturePoints.forEach((point) => {
      const selected = this.selectedCapturePointId === point.id;
      const ownerColor = point.owner === "player" ? 0x61c3ff : point.owner === "enemy" ? 0xff7f7f : 0xf3cc6a;
      point.ring.setFillStyle(ownerColor, selected ? 0.32 : 0.18);
      point.ring.setRadius(selected ? 40 : 34);
      point.ring.setStrokeStyle(selected ? 5 : 4, selected ? 0xffffff : ownerColor, selected ? 0.9 : 0.5);
      point.core.setFillStyle(ownerColor, 0.78);
      point.core.setRadius(selected ? 17 : 14);
      point.ownerText.setText(point.owner === "player" ? "아군 점령" : point.owner === "enemy" ? "적 점령" : "중립");
      point.ownerText.setColor(point.owner === "player" ? "#cfeeff" : point.owner === "enemy" ? "#ffd8d8" : "#eadfb3");
      point.buildingText.setText(point.buildingId ? `${this.getBuildingDef(point.buildingId).shortLabel} Lv.${point.buildingLevel}` : "빈 거점");
    });
  }

  private getBuildingDef(id: BuildingId): BuildingDef {
    const found = BUILDINGS.find((entry) => entry.id === id);
    if (!found) throw new Error(`Unknown building: ${id}`);
    return found;
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
    this.units = this.units.filter((entry) => entry.id !== unit.id);
    unit.sprite.destroy();
    unit.shadow.destroy();
    unit.hpBg.destroy();
    unit.hpFill.destroy();
    unit.label.destroy();

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
      team.nextWaveInSec = WAVE_INTERVAL_SEC;
      return false;
    }

    team.resources.food -= foodCost;
    team.nextWaveInSec = WAVE_INTERVAL_SEC;
    team.lastWaveElapsedSec = 0;
    this.spawnWaveUnits(team, roster);

    if (team.id === "player") this.infoText.setText(forced ? "즉시 웨이브를 투입했습니다" : "정규 웨이브가 출전했습니다");
    return true;
  }

  private deployOpeningWave(team: TeamState): void {
    this.spawnWaveUnits(team, getWaveRoster(team.ageId), team.id === "player" ? 0.12 : 0.88);
    team.nextWaveInSec = WAVE_INTERVAL_SEC;
    team.lastWaveElapsedSec = 0;
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
    const shadow = this.add.ellipse(pos.x, pos.y + 22, role === "support" ? 56 : 46, role === "support" ? 20 : 16, 0x000000, 0.2).setDepth(DEPTH_UNIT - 1);
    const sprite = this.add.image(pos.x, pos.y, stats.textureKey).setDepth(DEPTH_UNIT + pos.y * 0.1);
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
    this.uiCamera?.ignore([shadow, sprite, hpBg, hpFill, label]);

    this.units.push({
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
      healPower: stats.healPower ?? 0,
      attrition: 0,
      displaySize,
      bobPhase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      sprite,
      shadow,
      hpBg,
      hpFill,
      label,
    });
  }

  private playImpactFeedback(attacker: LaneUnit, target: LaneUnit, damage: number): void {
    target.sprite.setTintFill(0xffffff);
    this.time.delayedCall(80, () => {
      if (!target.sprite.active) return;
      target.sprite.clearTint();
      target.sprite.setTint(target.team === "player" ? 0xe9f6ff : 0xffd0d0);
    });

    this.tweens.add({
      targets: target.sprite,
      scaleX: 1.16,
      scaleY: 0.86,
      duration: 70,
      yoyo: true,
    });
    this.tweens.add({
      targets: attacker.sprite,
      x: attacker.sprite.x + (attacker.team === "player" ? 8 : -8),
      duration: 65,
      yoyo: true,
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

    const pos = this.progressToScreen(unit.visualProgress, unit.visualLaneRow);
    const moving = progressBetween(unit.progress, unit.visualProgress) > 0.0008;
    const gait = this.elapsedSec * 10 + unit.bobPhase;
    const bob = moving ? Math.sin(gait) * 3.2 : Math.sin(this.elapsedSec * 4 + unit.bobPhase) * 1.2;
    const strafe = moving ? Math.cos(gait) * 4 : 0;
    const lean = moving ? Math.sin(gait) * 0.05 : 0;
    const attackPulse = unit.attackAnimTime > 0 ? 1 - unit.attackAnimTime / 0.24 : 0;
    const attackEase = attackPulse > 0 ? Math.sin(attackPulse * Math.PI) : 0;
    const attackLunge = attackEase * (unit.team === "player" ? 12 : -12);
    const attackLift = attackEase * 6;
    const attackTilt = attackEase * (unit.team === "player" ? 0.18 : -0.18);
    const scale = unit.role === "support" ? 1.08 : 1;
    unit.shadow
      .setPosition(pos.x, pos.y + 24)
      .setScale(moving ? 0.88 : 1, moving ? 0.88 : 1)
      .setDepth(DEPTH_UNIT - 1 + pos.y * 0.05);
    unit.sprite
      .setPosition(pos.x + strafe + attackLunge, pos.y - bob - attackLift)
      .setRotation(lean + attackTilt)
      .setDisplaySize(
        unit.displaySize * scale * (moving ? 0.97 + Math.abs(Math.sin(gait)) * 0.06 : 1 + attackEase * 0.04),
        unit.displaySize * scale * (moving ? 1.01 + Math.abs(Math.cos(gait)) * 0.04 : 1 - attackEase * 0.06),
      )
      .setDepth(DEPTH_UNIT + pos.y * 0.1);
    unit.hpBg.setPosition(pos.x, pos.y - 44 - bob - attackLift).setDepth(unit.sprite.depth + 1);
    unit.hpFill.setPosition(pos.x - 17, pos.y - 44 - bob - attackLift).setSize(34 * Math.max(0, unit.hp / unit.maxHp), 5).setDepth(unit.sprite.depth + 2);
    unit.label.setPosition(pos.x, pos.y - 58 - bob - attackLift).setDepth(unit.sprite.depth + 3);
  }

  private shiftWorker(role: WorkerRole, delta: 1 | -1): void {
    if (role === "idle") return;
    if (delta > 0) {
      if (this.player.workers.idle <= 0) return;
      this.player.workers.idle -= 1;
      this.player.workers[role] += 1;
    } else {
      if (this.player.workers[role] <= 0) return;
      this.player.workers[role] -= 1;
      this.player.workers.idle += 1;
    }
  }

  private hireWorker(): void {
    if (!canAfford(this.player.resources, BASE_WORKER_COST)) {
      this.infoText.setText("일꾼 고용 실패: 금/목재/식량 부족");
      return;
    }
    payCost(this.player.resources, BASE_WORKER_COST);
    this.player.workers.idle += 1;
    this.infoText.setText("일꾼 1명을 고용했습니다");
  }

  private hireResearchWorker(): void {
    if (canAfford(this.player.resources, RESEARCH_WORKER_DIRECT_COST)) {
      payCost(this.player.resources, RESEARCH_WORKER_DIRECT_COST);
      this.player.workers.research += 1;
      this.infoText.setText("연구 일꾼을 직접 고용했습니다");
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
      return;
    }

    this.infoText.setText("연구 일꾼 조건 미달");
  }

  private totalConvertibleWorkers(): number {
    return this.player.workers.idle + this.player.workers.gold + this.player.workers.wood + this.player.workers.food + this.player.workers.metal;
  }

  private tryUseInstantWaveToken(team: TeamState): void {
    if (team.instantWaveTokens <= 0) {
      if (team.id === "player") this.infoText.setText("즉시 웨이브 토큰이 없습니다");
      return;
    }
    if (team.lastWaveElapsedSec < INSTANT_WAVE_TOKEN_COOLDOWN_AFTER_WAVE_SEC) {
      if (team.id === "player") this.infoText.setText("직전 웨이브 후 10초 뒤 사용 가능");
      return;
    }
    if (this.trySpawnWave(team, true)) team.instantWaveTokens -= 1;
  }

  private tryAgeUpPlayer(): void {
    const idx = AGES.findIndex((age) => age.id === this.player.ageId);
    if (idx >= AGES.length - 1) {
      this.infoText.setText("이미 최종 시대입니다");
      return;
    }
    const cost = this.getAgeUpCost(idx);
    if (!canAfford(this.player.resources, cost)) {
      this.infoText.setText("시대 업 실패: 금/목재/금속 부족");
      return;
    }
    payCost(this.player.resources, cost);
    this.advanceAge(this.player);
    this.infoText.setText(`${getAge(this.player.ageId).label} 도달`);
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
    this.capturePanelTitle.setText(selected ? `거점 ${selected.id + 1}` : "거점 선택");
    this.capturePanelBody.setText(selected
      ? [
          `소유 ${selected.owner === "player" ? "아군" : selected.owner === "enemy" ? "적" : "중립"} | 점령 ${Math.round(Math.abs(selected.control) * 100)}%`,
          `건설 ${selected.buildingId ? `${this.getBuildingDef(selected.buildingId).label} Lv.${selected.buildingLevel}` : "없음"}`,
          `드래그로 맵 이동 | 폐기 ${DISMANTLE_COST_GOLD}G`,
        ]
      : ["거점을 터치해 선택", "점령 후 건설 가능"]);
  }

  private publishDebug(): void {
    (window as unknown as { __gameDebug: unknown }).__gameDebug = {
      phase: "lane-siege",
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
      })),
      battlefield: {
        capturePoints: this.battlefield.capturePoints,
        controlPoints: this.capturePoints.map((point) => ({
          id: point.id,
          owner: point.owner,
          control: point.control,
          buildingId: point.buildingId ?? null,
        })),
        laneStart: { x: this.laneStart.x, y: this.laneStart.y },
        laneEnd: { x: this.laneEnd.x, y: this.laneEnd.y },
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
    return this.laneStart
      .clone()
      .lerp(this.laneEnd, progress)
      .add(this.lanePerp.clone().scale(laneRow * LANE_ROW_SPACING));
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
