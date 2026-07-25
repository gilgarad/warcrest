import Phaser from "phaser";
import {
  ISO_TILE_H,
  ISO_TILE_W,
  WALL_HEIGHT,
  drawFloorDiamond,
  drawWallBlockTexture,
  isoDepth,
  isoProject,
  wallBlockOrigin,
} from "../gfx/iso";
import { getSkill } from "../data/skills";
import { DEFAULT_UNIT_TYPE_ID, getUnitType } from "../data/unitTypes";
import { Squad, type SquadUnit } from "../systems/squad";
import { generateDungeon, TILE, type DungeonResult, type TileCoord } from "../systems/dungeonGenerator";

const CANVAS_W = 960;
const CANVAS_H = 540;
const TILE_SIZE = 20;
const MAX_SPEED = 98;
const MOVE_ACCEL = 760;
const MOVE_DRAG = 1550;
const VISION_RADIUS = 8;
const OFFSET_X = 0;
const OFFSET_Y = 0;
const VISUAL_W = 34;
const VISUAL_H = 48;
const PANEL_W = 164;
const PANEL_X = CANVAS_W - PANEL_W / 2 - 10;
const PANEL_TOP = 116;
const PANEL_BOTTOM = 430;
const INVENTORY_X = 20;
const INVENTORY_Y = CANVAS_H - 86;
const DEPTH_FLOOR = -1000;
const DEPTH_FOG = 2000;
const DEPTH_UI = 3000;
const DEPTH_TOAST = 3600;
const TRAIL_SPACING = 10;
const HISTORY_MAX = 500;
const LONG_PRESS_MS = 700;

type EnemyKind = "melee" | "ranged";
type EnemyMode = "idle" | "alert" | "aggro" | "dead";
type LootKind = "skill" | "manaPotion";

interface EnemyState {
  id: number;
  kind: EnemyKind;
  level: number;
  maxHp: number;
  hp: number;
  attackBase: number;
  detectRange: number;
  attackRange: number;
  attackCooldownMs: number;
  attackTimerMs: number;
  alertMs: number;
  state: EnemyMode;
  spawn: { x: number; y: number };
  wanderTarget: { x: number; y: number } | null;
  body: Phaser.Physics.Arcade.Sprite;
  visual: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  deathElapsedMs: number;
  deathDropped: boolean;
  hitStunMs: number;
}

interface ProjectileState {
  id: number;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  damage: number;
}

interface InventoryItem {
  id: number;
  kind: LootKind;
  label: string;
  skillId?: string;
  amount?: number;
  unlocked?: boolean;
  autoUse?: boolean;
}

interface GroundLoot {
  id: number;
  kind: LootKind;
  x: number;
  y: number;
  item: InventoryItem;
  visual: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

interface SkillSlotUi {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  cooldownOverlay: Phaser.GameObjects.Rectangle;
  slotIndex: number;
  holdEvent: Phaser.Time.TimerEvent | null;
}

interface InventorySlotUi {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  holdEvent: Phaser.Time.TimerEvent | null;
}

let nextEnemyId = 1;
let nextLootId = 1;
let nextProjectileId = 1;
let nextInventoryId = 1;

function sizeVisual(image: Phaser.GameObjects.Image, width: number, height: number): Phaser.GameObjects.Image {
  const baseScaleX = width / image.width;
  const baseScaleY = height / image.height;
  image.setScale(baseScaleX, baseScaleY);
  image.setData("baseScaleX", baseScaleX);
  image.setData("baseScaleY", baseScaleY);
  return image;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randDamage(base: number): number {
  return Math.round(base * randRange(0.8, 1.2));
}

export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonResult;
  private squad!: Squad;

  private playerBody!: Phaser.Physics.Arcade.Sprite;
  private playerVisual!: Phaser.GameObjects.Image;
  private leaderFlag!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  private history: { x: number; y: number }[] = [];
  private followerVisuals = new Map<number, Phaser.GameObjects.Image>();
  private followerHpBars = new Map<number, { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle }>();

  private enemyStates: EnemyState[] = [];
  private enemyByBody = new Map<Phaser.GameObjects.GameObject, EnemyState>();
  private projectiles: ProjectileState[] = [];
  private groundLoot: GroundLoot[] = [];
  private captives = new Map<Phaser.GameObjects.GameObject, Phaser.GameObjects.Image>();
  private enemyGroup!: Phaser.Physics.Arcade.Group;

  private wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  private captiveGroup!: Phaser.Physics.Arcade.StaticGroup;
  private exitZone!: Phaser.GameObjects.Rectangle;

  private fogTiles: Phaser.GameObjects.Image[][] = [];
  private revealed: boolean[][] = [];
  private lastPlayerTile: TileCoord = { x: -1, y: -1 };
  private lightGfx!: Phaser.GameObjects.Graphics;
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private manaBarFill!: Phaser.GameObjects.Rectangle;
  private leaderInfoText!: Phaser.GameObjects.Text;
  private levelPointText!: Phaser.GameObjects.Text;
  private squadStunText!: Phaser.GameObjects.Text;

  private slotUis: SkillSlotUi[] = [];
  private equippedSkills: Array<{ skillId: string | null; cooldownMs: number }> = [
    { skillId: null, cooldownMs: 0 },
    { skillId: null, cooldownMs: 0 },
    { skillId: null, cooldownMs: 0 },
  ];
  private skillMenu: Phaser.GameObjects.Container | null = null;
  private inventoryItems: InventoryItem[] = [];
  private inventorySlotUis: InventorySlotUi[] = [];
  private inventoryMenu: Phaser.GameObjects.Container | null = null;

  private kills = 0;
  private droppedHeal = false;
  private droppedStrike = false;

  constructor() {
    super("run");
  }

  preload(): void {
    this.load.image("fantasy-hud-panel", "/assets/fantasy-hud-panel.png");
    this.load.image("leader-sprite", "/assets/characters/leader.png");
    this.load.image("soldier-sprite", "/assets/characters/soldier.png");
    this.load.image("enemy-melee-sprite", "/assets/characters/enemy-melee.png");
    this.load.image("enemy-ranged-sprite", "/assets/characters/enemy-ranged.png");
    this.load.image("captive-sprite", "/assets/characters/captive.png");
  }

  create(): void {
    this.dungeon = generateDungeon();
    this.squad = new Squad();
    this.history = [];
    this.enemyStates = [];
    this.enemyByBody.clear();
    this.projectiles = [];
    this.groundLoot = [];
    this.captives.clear();
    this.inventoryItems = [];

    this.createUiTextures();

    this.cameras.main.setBackgroundColor(0x05070f);
    this.buildIsoTilemap();
    this.decorateDungeon();
    this.buildWallColliders();
    this.buildFog();
    this.lightGfx = this.add.graphics().setDepth(DEPTH_FLOOR + 1);

    const startWorld = this.tileToWorld(this.dungeon.playerStart);
    this.playerBody = this.physics.add.sprite(startWorld.x, startWorld.y, "leader-sprite");
    this.playerBody.setVisible(false);
    this.playerBody.body!.setSize(8, 8).setOffset(6, 9);
    this.playerBody.setDrag(MOVE_DRAG, MOVE_DRAG);
    this.playerBody.setMaxVelocity(MAX_SPEED, MAX_SPEED);
    this.physics.add.collider(this.playerBody, this.wallGroup);

    this.playerVisual = sizeVisual(this.add.image(0, 0, "leader-sprite").setOrigin(0.5, 1), VISUAL_W, VISUAL_H);
    this.leaderFlag = this.add.text(0, 0, "⚑", { fontSize: "14px", color: "#f5d76e" }).setOrigin(0.5, 1);
    this.syncVisual(this.playerVisual, this.playerBody.x, this.playerBody.y);
    this.syncLeaderFlag();
    this.setupCamera();

    this.cursors = this.input.keyboard!.createCursorKeys();
    const kc = Phaser.Input.Keyboard.KeyCodes;
    this.wasd = {
      up: this.input.keyboard!.addKey(kc.W),
      down: this.input.keyboard!.addKey(kc.S),
      left: this.input.keyboard!.addKey(kc.A),
      right: this.input.keyboard!.addKey(kc.D),
    };

    this.spawnEnemies();
    this.spawnCaptives();
    this.spawnExit();
    this.setupHud();
    this.renderFollowerVisuals();
    this.updateVision(true);
    this.updateMinimap();
    this.updateProgressText();
  }

  private createUiTextures(): void {
    if (!this.textures.exists("arrow")) {
      const g = this.add.graphics();
      g.fillStyle(0xf8f1de, 1).fillRect(0, 2, 10, 2);
      g.fillStyle(0xd08d2b, 1);
      g.beginPath();
      g.moveTo(10, 0);
      g.lineTo(14, 3);
      g.lineTo(10, 6);
      g.closePath();
      g.fillPath();
      g.generateTexture("arrow", 14, 6);
      g.destroy();
    }
    if (!this.textures.exists("loot-skill")) {
      const g = this.add.graphics();
      g.fillStyle(0x2ecc71, 1).fillCircle(10, 10, 9);
      g.fillStyle(0xffffff, 0.85).fillCircle(7, 7, 3);
      g.generateTexture("loot-skill", 20, 20);
      g.destroy();
    }
    if (!this.textures.exists("loot-potion")) {
      const g = this.add.graphics();
      g.fillStyle(0x4aa3ff, 1).fillRoundedRect(4, 4, 12, 14, 4);
      g.fillStyle(0xe5f3ff, 0.9).fillRoundedRect(8, 1, 4, 5, 1);
      g.generateTexture("loot-potion", 20, 20);
      g.destroy();
    }
    if (!this.textures.exists("wall-banner")) {
      const g = this.add.graphics();
      g.fillStyle(0x1f334a, 1).fillRoundedRect(0, 0, 18, 28, 3);
      g.fillStyle(0xd4a63c, 1).fillRect(0, 0, 18, 4);
      g.fillStyle(0x2f6fe0, 1).fillRoundedRect(2, 4, 14, 18, 2);
      g.fillStyle(0xf7d46c, 1);
      g.beginPath();
      g.moveTo(9, 9);
      g.lineTo(12, 14);
      g.lineTo(9, 19);
      g.lineTo(6, 14);
      g.closePath();
      g.fillPath();
      g.generateTexture("wall-banner", 18, 28);
      g.destroy();
    }
    if (!this.textures.exists("torch")) {
      const g = this.add.graphics();
      g.fillStyle(0x6d4930, 1).fillRoundedRect(6, 10, 4, 12, 2);
      g.fillStyle(0xffb347, 1).fillCircle(8, 8, 5);
      g.fillStyle(0xffe28a, 0.9).fillCircle(8, 6, 2.6);
      g.generateTexture("torch", 16, 24);
      g.destroy();
    }
  }

  private tileToWorld(t: TileCoord): { x: number; y: number } {
    return { x: OFFSET_X + t.x * TILE_SIZE + TILE_SIZE / 2, y: OFFSET_Y + t.y * TILE_SIZE + TILE_SIZE / 2 };
  }

  private worldToTile(x: number, y: number): TileCoord {
    return { x: Math.floor((x - OFFSET_X) / TILE_SIZE), y: Math.floor((y - OFFSET_Y) / TILE_SIZE) };
  }

  private orthoToIso(px: number, py: number): { x: number; y: number } {
    const tx = (px - OFFSET_X) / TILE_SIZE;
    const ty = (py - OFFSET_Y) / TILE_SIZE;
    return isoProject(tx, ty, 0, 0);
  }

  private orthoDepth(px: number, py: number): number {
    const tx = (px - OFFSET_X) / TILE_SIZE;
    const ty = (py - OFFSET_Y) / TILE_SIZE;
    return isoDepth(tx, ty);
  }

  private syncVisual(visual: Phaser.GameObjects.Image, orthoX: number, orthoY: number): void {
    const iso = this.orthoToIso(orthoX, orthoY);
    visual.setPosition(iso.x, iso.y);
    visual.setDepth(this.orthoDepth(orthoX, orthoY));
  }

  private syncLeaderFlag(): void {
    this.leaderFlag.setPosition(this.playerVisual.x, this.playerVisual.y - 22);
    this.leaderFlag.setDepth(this.playerVisual.depth + 2);
  }

  private setupCamera(): void {
    const { width, height } = this.dungeon;
    const corners = [
      isoProject(0, 0, 0, 0),
      isoProject(width, 0, 0, 0),
      isoProject(0, height, 0, 0),
      isoProject(width, height, 0, 0),
    ];
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));
    const pad = 120;
    this.cameras.main.setBounds(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2 + WALL_HEIGHT);
    this.cameras.main.startFollow(this.playerVisual, true, 0.12, 0.12);
  }

  private buildIsoTilemap(): void {
    const { width, height, grid } = this.dungeon;
    const isWall = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || grid[y][x] === TILE.WALL;
    const floorBase = 0x6f655b;
    const floorAlt = 0x7f7568;
    const floorAccent = 0x9e8754;
    const wallTop = 0x8d7762;

    const corners = [
      isoProject(0, 0, 0, 0),
      isoProject(width, 0, 0, 0),
      isoProject(0, height, 0, 0),
      isoProject(width, height, 0, 0),
    ];
    const minX = Math.min(...corners.map((c) => c.x)) - ISO_TILE_W;
    const maxX = Math.max(...corners.map((c) => c.x)) + ISO_TILE_W;
    const minY = Math.min(...corners.map((c) => c.y)) - ISO_TILE_H;
    const maxY = Math.max(...corners.map((c) => c.y)) + ISO_TILE_H;

    const floorKey = "dungeon-iso-floor";
    if (this.textures.exists(floorKey)) this.textures.remove(floorKey);
    const g = this.add.graphics();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === TILE.WALL) continue;
        const iso = isoProject(x, y, 0, 0);
        drawFloorDiamond(g, iso.x - minX, iso.y - minY, (x + y) % 2 === 0 ? floorBase : floorAlt);
        if ((x * 3 + y) % 11 === 0) {
          drawFloorDiamond(g, iso.x - minX, iso.y - minY, floorAccent);
        }
      }
    }
    g.generateTexture(floorKey, maxX - minX, maxY - minY);
    g.destroy();
    this.add.image(minX, minY, floorKey).setOrigin(0, 0).setDepth(DEPTH_FLOOR);

    const wallKey = drawWallBlockTexture(this, "iso-wall-block", wallTop);
    const origin = wallBlockOrigin();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] !== TILE.WALL) continue;
        const nearFloor = !isWall(x, y - 1) || !isWall(x, y + 1) || !isWall(x - 1, y) || !isWall(x + 1, y);
        if (!nearFloor) continue;
        const iso = isoProject(x, y, 0, 0);
        this.add.image(iso.x, iso.y, wallKey).setOrigin(origin.x, origin.y).setDepth(isoDepth(x, y));
      }
    }
  }

  private decorateDungeon(): void {
    const { width, height, grid } = this.dungeon;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (grid[y][x] !== TILE.WALL) continue;
        const floorBelow = grid[y + 1][x] !== TILE.WALL;
        const floorLeft = grid[y][x - 1] !== TILE.WALL;
        if (floorBelow && (x + y) % 9 === 0) {
          const iso = isoProject(x, y + 0.08, 0, 0);
          const banner = this.add.image(iso.x, iso.y - 22, "wall-banner").setOrigin(0.5, 1).setDepth(isoDepth(x, y) + 2);
          banner.setAlpha(0.95);
        }
        if (floorLeft && (x * 3 + y) % 13 === 0) {
          const iso = isoProject(x - 0.08, y + 0.08, 0, 0);
          const glow = this.add.circle(iso.x, iso.y - 12, 14, 0xffc261, 0.18).setDepth(isoDepth(x, y) + 1);
          const torch = this.add.image(iso.x, iso.y - 10, "torch").setOrigin(0.5, 1).setDepth(isoDepth(x, y) + 3);
          torch.setScale(0.9);
          this.tweens.add({
            targets: [glow, torch],
            alpha: { from: 0.82, to: 1 },
            duration: 650 + ((x + y) % 4) * 120,
            yoyo: true,
            repeat: -1,
          });
        }
      }
    }
  }

  private buildWallColliders(): void {
    const { width, height, grid } = this.dungeon;
    this.wallGroup = this.physics.add.staticGroup();
    for (let y = 0; y < height; y++) {
      let runStart = -1;
      for (let x = 0; x <= width; x++) {
        const solid = x < width && grid[y][x] === TILE.WALL;
        if (solid && runStart === -1) runStart = x;
        if (!solid && runStart !== -1) {
          const runLen = x - runStart;
          const cx = OFFSET_X + runStart * TILE_SIZE + (runLen * TILE_SIZE) / 2;
          const cy = OFFSET_Y + y * TILE_SIZE + TILE_SIZE / 2;
          const rect = this.add.rectangle(cx, cy, runLen * TILE_SIZE, TILE_SIZE, 0x000000, 0);
          this.physics.add.existing(rect, true);
          this.wallGroup.add(rect);
          runStart = -1;
        }
      }
    }
  }

  private buildFog(): void {
    const { width, height } = this.dungeon;
    this.revealed = Array.from({ length: height }, () => Array(width).fill(false));
    const key = "iso-fog-diamond";
    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      drawFloorDiamond(g, (ISO_TILE_W + 2) / 2, (ISO_TILE_H + 2) / 2, 0x000000);
      g.generateTexture(key, ISO_TILE_W + 2, ISO_TILE_H + 2);
      g.destroy();
    }
    this.fogTiles = [];
    for (let y = 0; y < height; y++) {
      const row: Phaser.GameObjects.Image[] = [];
      for (let x = 0; x < width; x++) {
        const iso = isoProject(x, y, 0, 0);
        row.push(this.add.image(iso.x, iso.y, key).setDepth(DEPTH_FOG));
      }
      this.fogTiles.push(row);
    }
  }

  private updateVision(force = false): void {
    const tile = this.worldToTile(this.playerBody.x, this.playerBody.y);
    if (!force && tile.x === this.lastPlayerTile.x && tile.y === this.lastPlayerTile.y) return;
    this.lastPlayerTile = tile;
    const { width, height } = this.dungeon;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dist = Math.max(Math.abs(x - tile.x), Math.abs(y - tile.y));
        if (dist <= VISION_RADIUS) this.revealed[y][x] = true;
        const fog = this.fogTiles[y][x];
        fog.setAlpha(dist <= VISION_RADIUS ? 0 : this.revealed[y][x] ? 0.62 : 1);
      }
    }
    this.updateMinimap();
  }

  private updateAmbientLight(): void {
    this.lightGfx.clear();
    const radius = VISION_RADIUS * ((ISO_TILE_W + ISO_TILE_H) / 2) * 0.7;
    for (let i = 4; i >= 1; i--) {
      const r = radius * (i / 4);
      this.lightGfx.fillStyle(0xffe3ae, 0.045 * ((4 - i + 1) / 4));
      this.lightGfx.fillCircle(this.playerVisual.x, this.playerVisual.y, r);
    }
  }

  private spawnEnemies(): void {
    this.enemyGroup = this.physics.add.group();
    this.dungeon.enemies.forEach((tile, index) => {
      const pos = this.tileToWorld(tile);
      const kind: EnemyKind = index % 2 === 0 ? "melee" : "ranged";
      const level = 1 + (index % 3);
      const maxHp = Math.round((kind === "melee" ? 100 : 88) * (1 + (level - 1) * 0.18));
      const body = this.physics.add.sprite(pos.x, pos.y, kind === "melee" ? "enemy-melee-sprite" : "enemy-ranged-sprite");
      body.setVisible(false);
      body.body!.setSize(8, 8).setOffset(6, 9);
      body.setImmovable(true);
      this.physics.add.collider(body, this.wallGroup);
      this.enemyGroup.add(body);
      const visual = this.add
        .image(0, 0, kind === "melee" ? "enemy-melee-sprite" : "enemy-ranged-sprite")
        .setOrigin(0.5, 1);
      sizeVisual(visual, VISUAL_W + 4, VISUAL_H + 4);
      this.syncVisual(visual, pos.x, pos.y);
      const hpBg = this.add.rectangle(visual.x, visual.y - 28, 22, 4, 0x1a2036, 0.85).setDepth(visual.depth + 1);
      const hpFill = this.add.rectangle(hpBg.x - 11, hpBg.y, 22, 4, kind === "melee" ? 0xe86b6b : 0xc06bf0, 1).setOrigin(0, 0.5).setDepth(hpBg.depth + 1);
      const state: EnemyState = {
        id: nextEnemyId++,
        kind,
        level,
        maxHp,
        hp: maxHp,
        attackBase: kind === "melee" ? 9 + level : 7 + level,
        detectRange: 82,
        attackRange: kind === "melee" ? 18 : 96,
        attackCooldownMs: kind === "melee" ? 1200 : 2450,
        attackTimerMs: randRange(450, 850),
        alertMs: 0,
        state: "idle",
        spawn: pos,
        wanderTarget: null,
        body,
        visual,
        hpBg,
        hpFill,
        deathElapsedMs: 0,
        deathDropped: false,
        hitStunMs: 0,
      };
      this.enemyStates.push(state);
      this.enemyByBody.set(body, state);
    });
    this.physics.add.collider(this.playerBody, this.enemyGroup);
  }

  private spawnCaptives(): void {
    this.captiveGroup = this.physics.add.staticGroup();
    this.dungeon.captives.forEach((tile) => {
      const pos = this.tileToWorld(tile);
      const body = this.captiveGroup.create(pos.x, pos.y, "captive-sprite") as Phaser.Physics.Arcade.Sprite;
      body.setVisible(false);
      const visual = sizeVisual(this.add.image(0, 0, "captive-sprite").setOrigin(0.5, 1), VISUAL_W, VISUAL_H);
      this.syncVisual(visual, pos.x, pos.y);
      this.captives.set(body, visual);
    });
    this.physics.add.overlap(this.playerBody, this.captiveGroup, (_p, obj) => this.onCaptiveContact(obj as Phaser.GameObjects.GameObject));
  }

  private spawnExit(): void {
    const exitWorld = this.tileToWorld(this.dungeon.exit);
    const exitIso = this.orthoToIso(exitWorld.x, exitWorld.y);
    this.add.text(exitIso.x, exitIso.y - ISO_TILE_H, "🚩", { fontSize: "16px" }).setOrigin(0.5, 1).setDepth(isoDepth(this.dungeon.exit.x, this.dungeon.exit.y) + 1);
    this.exitZone = this.add.rectangle(exitWorld.x, exitWorld.y, TILE_SIZE, TILE_SIZE, 0x000000, 0);
    this.physics.add.existing(this.exitZone, true);
    this.physics.add.overlap(this.playerBody, this.exitZone, () => this.onExitReached());
  }

  private setupHud(): void {
    this.minimapGfx = this.add.graphics().setDepth(DEPTH_UI).setScrollFactor(0);
    this.progressText = this.add.text(CANVAS_W - PANEL_W - 24, 16, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#cfd3e6" }).setOrigin(1, 0).setDepth(DEPTH_UI).setScrollFactor(0);
    this.leaderInfoText = this.add.text(16, 16, "", { fontFamily: "sans-serif", fontSize: "12px", color: "#d8ddf0" }).setDepth(DEPTH_UI).setScrollFactor(0);
    this.levelPointText = this.add.text(16, 34, "", { fontFamily: "sans-serif", fontSize: "12px", color: "#f4d35e" }).setDepth(DEPTH_UI).setScrollFactor(0);
    this.squadStunText = this.add.text(16, 52, "", { fontFamily: "sans-serif", fontSize: "12px", color: "#f28a8a" }).setDepth(DEPTH_UI).setScrollFactor(0);

    this.add.image(PANEL_X, (PANEL_TOP + PANEL_BOTTOM) / 2, "fantasy-hud-panel").setDisplaySize(PANEL_W + 28, PANEL_BOTTOM - PANEL_TOP + 28).setDepth(DEPTH_UI).setScrollFactor(0);
    this.add.text(PANEL_X, PANEL_TOP + 12, "리더 스킬", { fontFamily: "sans-serif", fontSize: "14px", color: "#d8ddf0" }).setOrigin(0.5).setDepth(DEPTH_UI).setScrollFactor(0);
    this.add.text(PANEL_X, PANEL_TOP + 34, "마나", { fontFamily: "sans-serif", fontSize: "11px", color: "#8fa7d9" }).setOrigin(0.5).setDepth(DEPTH_UI).setScrollFactor(0);
    this.add.rectangle(PANEL_X, PANEL_TOP + 52, PANEL_W - 24, 12, 0x29314f, 1).setStrokeStyle(1, 0x4a5590).setDepth(DEPTH_UI).setScrollFactor(0);
    this.manaBarFill = this.add.rectangle(PANEL_X - (PANEL_W - 24) / 2, PANEL_TOP + 52, PANEL_W - 24, 12, 0x4aa3ff, 1).setOrigin(0, 0.5).setDepth(DEPTH_UI + 1).setScrollFactor(0);

    const slotY0 = PANEL_TOP + 104;
    for (let i = 0; i < 3; i++) {
      const y = slotY0 + i * 64;
      const rect = this.add.rectangle(PANEL_X, y, PANEL_W - 20, 52, 0x243253, 0.55).setStrokeStyle(2, 0x4a5590).setDepth(DEPTH_UI).setScrollFactor(0);
      const overlay = this.add.rectangle(PANEL_X, y - 26, PANEL_W - 20, 0, 0x000000, 0.55).setOrigin(0.5, 0).setDepth(DEPTH_UI + 1).setScrollFactor(0);
      const text = this.add.text(PANEL_X, y, "비어 있음", { fontFamily: "sans-serif", fontSize: "13px", color: "#adb8da" }).setOrigin(0.5).setDepth(DEPTH_UI + 2).setScrollFactor(0);
      const slotUi: SkillSlotUi = { rect, text, cooldownOverlay: overlay, slotIndex: i, holdEvent: null };
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.onSkillSlotPointerDown(slotUi));
      rect.on("pointerup", () => this.onSkillSlotPointerUp(slotUi));
      rect.on("pointerout", () => this.cancelSkillSlotHold(slotUi));
      this.slotUis.push(slotUi);
    }

    this.add.rectangle(INVENTORY_X + 158, INVENTORY_Y + 34, 316, 72, 0x0b1220, 0.9).setStrokeStyle(2, 0xd4a63c, 0.6).setDepth(DEPTH_UI).setScrollFactor(0);
    this.add.text(INVENTORY_X, INVENTORY_Y - 12, "인벤토리 (탭 사용 / 길게 눌러 자동사용·버리기)", { fontFamily: "sans-serif", fontSize: "11px", color: "#9aa6c8" }).setOrigin(0, 0).setDepth(DEPTH_UI).setScrollFactor(0);
    for (let i = 0; i < 9; i++) {
      const x = INVENTORY_X + 18 + (i % 3) * 102;
      const y = INVENTORY_Y + 16 + Math.floor(i / 3) * 24;
      const rect = this.add.rectangle(x + 42, y + 10, 84, 20, 0x1b2135, 1).setStrokeStyle(1, 0x455075).setDepth(DEPTH_UI).setScrollFactor(0);
      const text = this.add.text(x, y + 2, "-", { fontFamily: "sans-serif", fontSize: "10px", color: "#dbe2ff" }).setOrigin(0, 0).setDepth(DEPTH_UI + 1).setScrollFactor(0);
      const slot = { rect, text, holdEvent: null };
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.onInventoryPointerDown(slot, i));
      rect.on("pointerup", (pointer: Phaser.Input.Pointer) => this.onInventoryPointerUp(i, pointer));
      rect.on("pointerout", () => this.cancelInventoryHold(slot));
      this.inventorySlotUis.push(slot);
    }
    this.refreshInventoryUi();
    this.refreshSkillUi();
  }

  update(time: number, delta: number): void {
    this.squad.tick(delta);
    this.handleMovement();
    this.updateVision();
    this.updateEnemyAi(delta);
    this.updateAutoAttacks();
    this.updateProjectiles(delta);
    this.updateLootPickup();
    this.updateAutoUsePotions();

    this.syncVisual(this.playerVisual, this.playerBody.x, this.playerBody.y);
    this.applyWalkBounce(this.playerVisual, this.playerBody.body!.velocity.length(), time, 0);
    this.syncLeaderFlag();
    this.updateFollowerVisuals(time);
    this.updateAmbientLight();
    this.updateEnemyVisuals(time);
    this.updateUi(delta);
    this.updateProgressText();

    (window as unknown as { __gameDebug: unknown }).__gameDebug = {
      phase: "field-combat",
      squadSize: this.squad.size,
      combatants: this.squad.combatantCount,
      mana: this.squad.leaderMana,
      leaderLevel: this.squad.leader.level,
      levelPoints: this.squad.leaderLevelPoints,
      enemiesLeft: this.enemyStates.filter((enemy) => enemy.state !== "dead").length,
      inventory: this.inventoryItems.map((item) => ({ kind: item.kind, label: item.label, unlocked: item.unlocked, autoUse: item.autoUse })),
      equippedSkills: this.equippedSkills,
      playerWorld: { x: this.playerBody.x, y: this.playerBody.y },
      dungeon: {
        grid: this.dungeon.grid.map((row) => row.join("")),
        tileSize: TILE_SIZE,
        offsetX: OFFSET_X,
        offsetY: OFFSET_Y,
        playerStart: this.dungeon.playerStart,
        exit: this.dungeon.exit,
      },
    };
  }

  private handleMovement(): void {
    if (this.squad.squadStunMs > 0) {
      this.playerBody.setVelocity(0, 0);
      return;
    }
    const left = this.cursors.left?.isDown || this.wasd.left.isDown;
    const right = this.cursors.right?.isDown || this.wasd.right.isDown;
    const up = this.cursors.up?.isDown || this.wasd.up.isDown;
    const down = this.cursors.down?.isDown || this.wasd.down.isDown;
    let vx = 0;
    let vy = 0;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy) || 1;
      vx = (vx / len) * MOVE_ACCEL;
      vy = (vy / len) * MOVE_ACCEL;
    }
    this.playerBody.setAcceleration(vx, vy);
  }

  private renderFollowerVisuals(): void {
    this.followerVisuals.forEach((visual) => visual.destroy());
    this.followerHpBars.forEach((bars) => {
      bars.bg.destroy();
      bars.fill.destroy();
    });
    this.followerVisuals.clear();
    this.followerHpBars.clear();
    this.squad.followers.forEach((unit) => {
      const visual = sizeVisual(this.add.image(this.playerVisual.x, this.playerVisual.y, "soldier-sprite").setOrigin(0.5, 1), VISUAL_W, VISUAL_H);
      const bg = this.add.rectangle(visual.x, visual.y - 24, 20, 3, 0x182038, 0.85);
      const fill = this.add.rectangle(visual.x - 10, visual.y - 24, 20, 3, 0x6bd67e, 1).setOrigin(0, 0.5);
      this.followerVisuals.set(unit.id, visual);
      this.followerHpBars.set(unit.id, { bg, fill });
    });
  }

  private squadOffset(index: number): { x: number; y: number } {
    const side = index % 2 === 0 ? -1 : 1;
    const rank = Math.floor(index / 2);
    const row = Math.floor(index / 4);
    return {
      x: side * (12 + rank * 10) + row * side * 2,
      y: rank * 7 + row * 4,
    };
  }

  private getFollowerWorldPos(index: number): { x: number; y: number } {
    const idx = this.history.length - 1 - (index + 1) * TRAIL_SPACING;
    const pos = this.history[Math.max(0, idx)] ?? { x: this.playerBody.x, y: this.playerBody.y };
    const off = this.squadOffset(index);
    return { x: pos.x + off.x, y: pos.y + off.y };
  }

  private updateFollowerVisuals(time: number): void {
    this.history.push({ x: this.playerBody.x, y: this.playerBody.y });
    if (this.history.length > HISTORY_MAX) this.history.shift();
    const speed = this.playerBody.body!.velocity.length();
    this.squad.followers.forEach((unit, index) => {
      const visual = this.followerVisuals.get(unit.id);
      const bars = this.followerHpBars.get(unit.id);
      if (!visual || !bars) return;
      const pos = this.getFollowerWorldPos(index);
      const iso = this.orthoToIso(pos.x, pos.y);
      visual.setPosition(iso.x, iso.y).setDepth(this.orthoDepth(pos.x, pos.y) - 1);
      this.applyWalkBounce(visual, speed, time, index * 140);
      bars.bg.setPosition(visual.x, visual.y - 22).setDepth(visual.depth + 1);
      bars.fill.setPosition(visual.x - 10, visual.y - 22).setSize(20 * Math.max(0, unit.hp / unit.maxHp), 3).setDepth(visual.depth + 2);
    });
  }

  private updateAutoAttacks(): void {
    if (this.squad.squadStunMs > 0) return;
    this.squad.followers.forEach((unit, index) => {
      if (unit.attackCooldownMs > 0) return;
      const unitType = getUnitType(unit.unitTypeId);
      if (!unitType.canAutoAttack) return;
      const pos = this.getFollowerWorldPos(index);
      const target = this.findNearestEnemy(pos.x, pos.y, unitType.attackRange, false);
      if (!target) return;
      unit.attackCooldownMs = unitType.attackCooldownMs;
      this.damageEnemy(target, randDamage(unitType.baseAttack), true);
      this.flashToast("참!", "#ffd166", target.visual.x, target.visual.y - 18);
      this.squad.gainFollowerXp(unit.id, 16);
    });
  }

  private updateEnemyAi(delta: number): void {
    this.enemyStates.forEach((enemy) => {
      if (enemy.state === "dead") {
        this.updateEnemyDeath(enemy, delta);
        return;
      }
      enemy.hitStunMs = Math.max(0, enemy.hitStunMs - delta);
      enemy.attackTimerMs = Math.max(0, enemy.attackTimerMs - delta);
      const dx = this.playerBody.x - enemy.body.x;
      const dy = this.playerBody.y - enemy.body.y;
      const dist = Math.hypot(dx, dy);

      if (enemy.state === "idle" && dist <= enemy.detectRange) {
        enemy.state = "alert";
        enemy.alertMs = 620;
      }
      if (enemy.state === "alert") {
        enemy.body.setVelocity(0, 0);
        enemy.alertMs -= delta;
        if (enemy.alertMs <= 0) enemy.state = "aggro";
      } else if (enemy.state === "idle") {
        this.updateIdleWander(enemy);
      } else if (enemy.state === "aggro" && enemy.hitStunMs <= 0) {
        if (enemy.kind === "melee") this.updateMeleeEnemy(enemy, dist, dx, dy);
        else this.updateRangedEnemy(enemy, dist, dx, dy);
      }
    });
  }

  private updateIdleWander(enemy: EnemyState): void {
    if (!enemy.wanderTarget || Phaser.Math.Distance.Between(enemy.body.x, enemy.body.y, enemy.wanderTarget.x, enemy.wanderTarget.y) < 5) {
      enemy.wanderTarget = {
        x: enemy.spawn.x + randRange(-18, 18),
        y: enemy.spawn.y + randRange(-18, 18),
      };
    }
    const dx = enemy.wanderTarget.x - enemy.body.x;
    const dy = enemy.wanderTarget.y - enemy.body.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.body.setVelocity((dx / len) * 18, (dy / len) * 18);
  }

  private updateMeleeEnemy(enemy: EnemyState, dist: number, dx: number, dy: number): void {
    if (dist > enemy.attackRange + 2) {
      const len = Math.hypot(dx, dy) || 1;
      enemy.body.setVelocity((dx / len) * 42, (dy / len) * 42);
      return;
    }
    enemy.body.setVelocity(0, 0);
    if (enemy.attackTimerMs <= 0) {
      enemy.attackTimerMs = enemy.attackCooldownMs;
      this.damageNearestSquadUnit(enemy.body.x, enemy.body.y, enemy.attackBase);
    }
  }

  private updateRangedEnemy(enemy: EnemyState, dist: number, dx: number, dy: number): void {
    const preferred = 86;
    if (dist > preferred) {
      const len = Math.hypot(dx, dy) || 1;
      enemy.body.setVelocity((dx / len) * 38, (dy / len) * 38);
      return;
    }
    enemy.body.setVelocity(0, 0);
    if (enemy.attackTimerMs <= 0) {
      enemy.attackTimerMs = enemy.attackCooldownMs;
      this.spawnArrow(enemy);
    }
  }

  private spawnArrow(enemy: EnemyState): void {
    const dx = this.playerBody.x - enemy.body.x;
    const dy = this.playerBody.y - enemy.body.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 78;
    const sprite = this.add.image(enemy.visual.x, enemy.visual.y - 14, "arrow").setDepth(enemy.visual.depth + 3);
    sprite.rotation = Math.atan2(dy, dx);
    this.projectiles.push({
      id: nextProjectileId++,
      sprite,
      x: enemy.body.x,
      y: enemy.body.y - 8,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      lifeMs: 1700,
      damage: randDamage(enemy.attackBase),
    });
  }

  private updateProjectiles(delta: number): void {
    const next: ProjectileState[] = [];
    this.projectiles.forEach((proj) => {
      proj.lifeMs -= delta;
      if (proj.lifeMs <= 0) {
        proj.sprite.destroy();
        return;
      }
      proj.x += (proj.vx * delta) / 1000;
      proj.y += (proj.vy * delta) / 1000;
      const iso = this.orthoToIso(proj.x, proj.y);
      proj.sprite.setPosition(iso.x, iso.y);

      const hit = this.findSquadUnitNear(proj.x, proj.y, 14);
      if (hit) {
        proj.sprite.destroy();
        this.applySquadDamage(hit.id, proj.damage);
        return;
      }
      next.push(proj);
    });
    this.projectiles = next;
  }

  private findSquadUnitNear(x: number, y: number, radius: number): SquadUnit | null {
    const positions = this.getSquadUnitPositions();
    const found = positions.find((entry) => Phaser.Math.Distance.Between(x, y, entry.x, entry.y) <= radius);
    return found?.unit ?? null;
  }

  private getSquadUnitPositions(): Array<{ unit: SquadUnit; x: number; y: number }> {
    const entries: Array<{ unit: SquadUnit; x: number; y: number }> = [{ unit: this.squad.leader, x: this.playerBody.x, y: this.playerBody.y }];
    this.squad.followers.forEach((unit, index) => {
      const pos = this.getFollowerWorldPos(index);
      entries.push({ unit, x: pos.x, y: pos.y });
    });
    return entries;
  }

  private damageNearestSquadUnit(x: number, y: number, baseDamage: number): void {
    const positions = this.getSquadUnitPositions().sort(
      (a, b) => Phaser.Math.Distance.Between(x, y, a.x, a.y) - Phaser.Math.Distance.Between(x, y, b.x, b.y)
    );
    const target = positions[0]?.unit;
    if (!target) return;
    this.applySquadDamage(target.id, randDamage(baseDamage));
  }

  private applySquadDamage(targetId: number, amount: number): void {
    const result = this.squad.damageUnit(targetId, amount);
    this.flashToast(`-${amount}`, "#f28a8a");
    if (result.promoted || result.died) {
      this.renderFollowerVisuals();
      this.syncLeaderFlag();
      this.playerVisual.setTexture("leader-sprite");
      sizeVisual(this.playerVisual, VISUAL_W, VISUAL_H);
    }
    if (result.wiped) {
      this.scene.start("gameover", { win: false, squadSize: this.squad.size });
    }
  }

  private findNearestEnemy(x: number, y: number, range: number, includeDead: boolean): EnemyState | null {
    let best: EnemyState | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    this.enemyStates.forEach((enemy) => {
      if (!includeDead && enemy.state === "dead") return;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.body.x, enemy.body.y);
      if (dist <= range && dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    });
    return best;
  }

  private damageEnemy(enemy: EnemyState, amount: number, creditLeaderXp: boolean): void {
    enemy.hp = Math.max(0, enemy.hp - amount);
    if (enemy.hp <= 0 && enemy.state !== "dead") {
      enemy.state = "dead";
      enemy.body.setVelocity(0, 0);
      enemy.body.disableBody(true, false);
      enemy.deathElapsedMs = 0;
      if (creditLeaderXp) this.onEnemyKilled();
    }
  }

  private onEnemyKilled(): void {
    this.kills += 1;
    const leveled = this.squad.gainLeaderXp(100);
    if (leveled) this.flashToast("리더 레벨 업!", "#f4d35e");
    if (!this.droppedHeal) {
      this.droppedHeal = true;
    } else if (!this.droppedStrike && this.kills >= 3) {
      this.droppedStrike = true;
    }
  }

  private updateEnemyDeath(enemy: EnemyState, delta: number): void {
    enemy.deathElapsedMs += delta;
    if (enemy.deathElapsedMs >= 1000 && !enemy.deathDropped) {
      enemy.deathDropped = true;
      if (this.kills === 1) this.spawnSkillLoot("heal", enemy.body.x, enemy.body.y);
      else if (this.kills === 3) this.spawnSkillLoot("strike", enemy.body.x, enemy.body.y);
      if (Math.random() < 0.45) this.spawnPotionLoot(enemy.body.x + randRange(-4, 4), enemy.body.y + randRange(-4, 4));
    }
    if (enemy.deathElapsedMs >= 1000) {
      const t = (enemy.deathElapsedMs - 1000) / 2000;
      const blinkRate = 120 + (1 - t) * -80;
      enemy.visual.setVisible(Math.floor(enemy.deathElapsedMs / Math.max(40, blinkRate)) % 2 === 0);
    }
    if (enemy.deathElapsedMs >= 3000) {
      enemy.visual.destroy();
      enemy.hpBg.destroy();
      enemy.hpFill.destroy();
      this.enemyByBody.delete(enemy.body);
      enemy.body.destroy();
    }
  }

  private spawnSkillLoot(skillId: string, x: number, y: number): void {
    const skill = getSkill(skillId);
    const item: InventoryItem = {
      id: nextInventoryId++,
      kind: "skill",
      label: `${skill.label} (잠김)`,
      skillId,
      unlocked: false,
    };
    const visual = this.add.image(this.orthoToIso(x, y).x, this.orthoToIso(x, y).y - 6, "loot-skill").setDepth(DEPTH_UI - 10);
    const label = this.add.text(visual.x, visual.y - 16, skill.label, { fontFamily: "sans-serif", fontSize: "10px", color: "#dfffe5" }).setOrigin(0.5).setDepth(DEPTH_UI - 9);
    this.groundLoot.push({ id: nextLootId++, kind: "skill", x, y, item, visual, label });
  }

  private spawnPotionLoot(x: number, y: number): void {
    const item: InventoryItem = {
      id: nextInventoryId++,
      kind: "manaPotion",
      label: "마나 포션",
      amount: 30,
      autoUse: false,
    };
    const iso = this.orthoToIso(x, y);
    const visual = this.add.image(iso.x, iso.y - 6, "loot-potion").setDepth(DEPTH_UI - 10);
    const label = this.add.text(iso.x, iso.y - 16, "마나+30", { fontFamily: "sans-serif", fontSize: "10px", color: "#d9ecff" }).setOrigin(0.5).setDepth(DEPTH_UI - 9);
    this.groundLoot.push({ id: nextLootId++, kind: "manaPotion", x, y, item, visual, label });
  }

  private updateLootPickup(): void {
    const remaining: GroundLoot[] = [];
    this.groundLoot.forEach((loot) => {
      if (Phaser.Math.Distance.Between(loot.x, loot.y, this.playerBody.x, this.playerBody.y) > 16) {
        remaining.push(loot);
        return;
      }

      if (loot.kind === "manaPotion" && this.squad.leaderMaxMana - this.squad.leaderMana >= (loot.item.amount ?? 0)) {
        this.squad.restoreMana(loot.item.amount ?? 0);
        this.destroyLoot(loot);
        this.flashToast("마나 회복", "#8fd6ff");
        return;
      }

      if (this.inventoryItems.length >= 9) {
        remaining.push(loot);
        this.flashToast("인벤토리 가득 참", "#f2c14e");
        return;
      }

      this.inventoryItems.push(loot.item);
      this.refreshInventoryUi();
      this.destroyLoot(loot);
      this.flashToast(loot.kind === "skill" ? "스킬 획득!" : "포션 획득!", loot.kind === "skill" ? "#8fe08f" : "#8fd6ff");
    });
    this.groundLoot = remaining;
    this.updateAutoUsePotions();
  }

  private updateAutoUsePotions(): void {
    const potion = this.inventoryItems.find((item) => item.kind === "manaPotion" && item.autoUse && this.squad.leaderMaxMana - this.squad.leaderMana >= (item.amount ?? 0));
    if (!potion) return;
    this.squad.restoreMana(potion.amount ?? 0);
    this.inventoryItems = this.inventoryItems.filter((item) => item.id !== potion.id);
    this.refreshInventoryUi();
    this.flashToast("자동 포션", "#8fd6ff");
  }

  private destroyLoot(loot: GroundLoot): void {
    loot.visual.destroy();
    loot.label.destroy();
  }

  private onCaptiveContact(captiveObj: Phaser.GameObjects.GameObject): void {
    const visual = this.captives.get(captiveObj);
    if (!visual) return;
    visual.destroy();
    this.captives.delete(captiveObj);
    (captiveObj as Phaser.Physics.Arcade.Sprite).destroy();
    this.squad.addFollower(DEFAULT_UNIT_TYPE_ID);
    this.renderFollowerVisuals();
    this.flashToast("검 유닛 합류!", "#8fe0c8");
  }

  private onExitReached(): void {
    this.scene.start("gameover", { win: true, squadSize: this.squad.size });
  }

  private onSkillSlotPointerDown(slot: SkillSlotUi): void {
    this.cancelSkillSlotHold(slot);
    slot.holdEvent = this.time.delayedCall(LONG_PRESS_MS, () => {
      slot.holdEvent = null;
      this.openSkillMenu(slot.slotIndex);
    });
  }

  private onSkillSlotPointerUp(slot: SkillSlotUi): void {
    if (slot.holdEvent) {
      slot.holdEvent.remove(false);
      slot.holdEvent = null;
      this.useSkill(slot.slotIndex);
    }
  }

  private cancelSkillSlotHold(slot: SkillSlotUi): void {
    if (!slot.holdEvent) return;
    slot.holdEvent.remove(false);
    slot.holdEvent = null;
  }

  private openSkillMenu(slotIndex: number): void {
    this.skillMenu?.destroy();
    const ownedSkills = this.inventoryItems.filter((item) => item.kind === "skill");
    const x = PANEL_X - PANEL_W / 2 - 12;
    const y = PANEL_TOP + 104 + slotIndex * 64;
    const bg = this.add.rectangle(x, y, 120, Math.max(38, 26 + ownedSkills.length * 24), 0x11182b, 0.95).setStrokeStyle(1, 0x4a5590);
    const header = this.add.text(x - 50, y - bg.height / 2 + 6, "장착/해금", { fontFamily: "sans-serif", fontSize: "10px", color: "#d6def7" });
    const children: Phaser.GameObjects.GameObject[] = [bg, header];
    ownedSkills.forEach((item, idx) => {
      const label = item.unlocked ? getSkill(item.skillId!).label : `${getSkill(item.skillId!).label} (잠김)`;
      const txt = this.add.text(x - 50, y - bg.height / 2 + 24 + idx * 22, label, {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: item.unlocked ? "#8fe08f" : this.squad.leaderLevelPoints > 0 ? "#f4d35e" : "#e08f8f",
      });
      txt.setInteractive({ useHandCursor: true });
      txt.on("pointerup", () => {
        if (!item.unlocked) {
          if (this.squad.leaderLevelPoints <= 0) {
            this.flashToast("레벨 포인트 부족", "#f2c14e");
            return;
          }
          this.squad.leaderLevelPoints -= 1;
          item.unlocked = true;
          item.label = getSkill(item.skillId!).label;
        }
        this.equippedSkills[slotIndex].skillId = item.skillId!;
        this.refreshSkillUi();
        this.skillMenu?.destroy();
        this.skillMenu = null;
      });
      children.push(txt);
    });
    this.skillMenu = this.add.container(0, 0, children).setDepth(DEPTH_UI + 20).setScrollFactor(0);
  }

  private useSkill(slotIndex: number): void {
    const slot = this.equippedSkills[slotIndex];
    if (!slot.skillId) {
      this.flashToast("비어 있는 슬롯", "#c1c7da");
      return;
    }
    if (slot.cooldownMs > 0) return;
    if (this.squad.squadStunMs > 0) {
      this.flashToast("지휘 불가", "#f28a8a");
      return;
    }
    const skill = getSkill(slot.skillId);
    if (!this.squad.spendMana(skill.manaCost)) {
      this.flashToast("마나 부족", "#8fd6ff");
      return;
    }

    if (skill.kind === "heal") {
      this.squad.healAll(20);
      this.flashToast("치유!", "#8fe08f");
    } else {
      const target = this.findNearestEnemy(this.playerBody.x, this.playerBody.y, 120, false);
      if (!target) {
        this.squad.restoreMana(skill.manaCost);
        this.flashToast("사거리 내 적 없음", "#c1c7da");
        return;
      }
      target.hitStunMs = 220;
      this.damageEnemy(target, randDamage(20), false);
      this.flashToast("강타!", "#ffd166", target.visual.x, target.visual.y - 20);
    }
    slot.cooldownMs = skill.cooldownMs;
  }

  private refreshSkillUi(): void {
    this.slotUis.forEach((slotUi, idx) => {
      const skillId = this.equippedSkills[idx].skillId;
      if (!skillId) {
        slotUi.text.setText("비어 있음").setColor("#adb8da");
        slotUi.rect.setFillStyle(0x243253, 0.55);
      } else {
        const skill = getSkill(skillId);
        slotUi.text.setText(skill.label).setColor("#ffffff");
        slotUi.rect.setFillStyle(skill.color, 0.35);
      }
    });
  }

  private refreshInventoryUi(): void {
    this.inventorySlotUis.forEach((slot, index) => {
      const item = this.inventoryItems[index];
      if (!item) {
        slot.text.setText("-");
        slot.rect.setFillStyle(0x1b2135, 1);
        return;
      }
      const suffix = item.kind === "manaPotion" && item.autoUse ? " [A]" : "";
      slot.text.setText(item.label + suffix);
      slot.rect.setFillStyle(item.kind === "skill" ? 0x23432e : 0x1f3557, 1);
    });
  }

  private onInventoryPointerUp(index: number, pointer: Phaser.Input.Pointer): void {
    const slot = this.inventorySlotUis[index];
    if (slot?.holdEvent) {
      slot.holdEvent.remove(false);
      slot.holdEvent = null;
    } else {
      return;
    }
    const item = this.inventoryItems[index];
    if (!item) return;
    if (pointer.getDistance() > 24) return;
    if (item.kind === "manaPotion") {
      this.squad.restoreMana(item.amount ?? 0);
      this.inventoryItems.splice(index, 1);
      this.refreshInventoryUi();
      this.flashToast("포션 사용", "#8fd6ff");
    }
  }

  private onInventoryPointerDown(slot: InventorySlotUi, index: number): void {
    this.cancelInventoryHold(slot);
    slot.holdEvent = this.time.delayedCall(LONG_PRESS_MS, () => {
      slot.holdEvent = null;
      this.openInventoryMenu(index);
    });
  }

  private cancelInventoryHold(slot: InventorySlotUi): void {
    if (!slot.holdEvent) return;
    slot.holdEvent.remove(false);
    slot.holdEvent = null;
  }

  private openInventoryMenu(index: number): void {
    const item = this.inventoryItems[index];
    if (!item) return;
    this.inventoryMenu?.destroy();
    const x = INVENTORY_X + 330;
    const y = INVENTORY_Y - 18;
    const options: Array<{ label: string; action: () => void; color?: string }> = [];
    if (item.kind === "manaPotion") {
      options.push({
        label: "사용",
        action: () => {
          this.squad.restoreMana(item.amount ?? 0);
          this.inventoryItems.splice(index, 1);
          this.refreshInventoryUi();
          this.flashToast("포션 사용", "#8fd6ff");
        },
      });
      options.push({
        label: item.autoUse ? "자동사용 해제" : "자동사용 켜기",
        action: () => {
          item.autoUse = !item.autoUse;
          this.refreshInventoryUi();
        },
      });
    }
    options.push({
      label: "버리기",
      color: "#f2a0a0",
      action: () => {
        this.inventoryItems.splice(index, 1);
        this.refreshInventoryUi();
        this.flashToast("버림", "#f2a0a0");
      },
    });

    const height = 28 + options.length * 22;
    const bg = this.add.rectangle(x, y, 132, height, 0x11182b, 0.97).setStrokeStyle(1, 0x4a5590);
    const children: Phaser.GameObjects.GameObject[] = [bg];
    options.forEach((opt, idx) => {
      const txt = this.add.text(x - 54, y - height / 2 + 8 + idx * 22, opt.label, {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: opt.color ?? "#dbe2ff",
      });
      txt.setInteractive({ useHandCursor: true });
      txt.on("pointerup", () => {
        opt.action();
        this.inventoryMenu?.destroy();
        this.inventoryMenu = null;
      });
      children.push(txt);
    });
    this.inventoryMenu = this.add.container(0, 0, children).setDepth(DEPTH_UI + 24).setScrollFactor(0);
  }

  private updateEnemyVisuals(time: number): void {
    this.enemyStates.forEach((enemy) => {
      if (enemy.deathElapsedMs >= 3000) return;
      this.syncVisual(enemy.visual, enemy.body.x, enemy.body.y);
      this.applyWalkBounce(enemy.visual, enemy.body.body?.velocity.length() ?? 0, time, enemy.id * 73);
      enemy.hpBg.setPosition(enemy.visual.x, enemy.visual.y - 24).setDepth(enemy.visual.depth + 1).setVisible(enemy.state !== "dead");
      enemy.hpFill.setPosition(enemy.visual.x - 11, enemy.visual.y - 24).setSize(22 * Math.max(0, enemy.hp / enemy.maxHp), 4).setDepth(enemy.visual.depth + 2).setVisible(enemy.state !== "dead");
      if (enemy.state === "alert") enemy.visual.setTint(0xf4d35e);
      else if (enemy.state === "aggro") enemy.visual.setTint(0xffffff);
      if (enemy.hitStunMs > 0) enemy.visual.setTintFill(0xffffff);
      else if (enemy.state !== "alert") enemy.visual.clearTint();
    });
    this.enemyStates = this.enemyStates.filter((enemy) => enemy.deathElapsedMs < 3000);
  }

  private updateUi(delta: number): void {
    this.manaBarFill.width = (PANEL_W - 24) * Math.max(0, this.squad.leaderMana / this.squad.leaderMaxMana);
    this.leaderInfoText.setText(`리더 Lv.${this.squad.leader.level}  |  병력 ${this.squad.size} (전투 ${this.squad.combatantCount})`);
    this.levelPointText.setText(`레벨 포인트 ${this.squad.leaderLevelPoints}  |  XP ${this.squad.leaderXp}/100`);
    this.squadStunText.setText(this.squad.squadStunMs > 0 ? "리더 교체 충격: 순간 스턴" : "");
    this.equippedSkills.forEach((slot, idx) => {
      slot.cooldownMs = Math.max(0, slot.cooldownMs - delta);
      const skillId = slot.skillId;
      const total = skillId ? getSkill(skillId).cooldownMs : 1;
      this.slotUis[idx].cooldownOverlay.height = 52 * (slot.cooldownMs / total);
    });
  }

  private updateMinimap(): void {
    const { width, height } = this.dungeon;
    const boxW = PANEL_W;
    const boxH = 78;
    const boxX = CANVAS_W - boxW - 10;
    const boxY = 24;
    const sx = boxW / width;
    const sy = boxH / height;
    this.minimapGfx.clear();
    this.minimapGfx.fillStyle(0x0a0d1a, 0.85).fillRect(boxX, boxY, boxW, boxH);
    this.minimapGfx.lineStyle(1, 0x3a4570, 1).strokeRect(boxX, boxY, boxW, boxH);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!this.revealed[y][x] || this.dungeon.grid[y][x] === TILE.WALL) continue;
        this.minimapGfx.fillStyle(0x4a5590, 1).fillRect(boxX + x * sx, boxY + y * sy, Math.max(1, sx), Math.max(1, sy));
      }
    }
    this.enemyStates.forEach((enemy) => {
      const t = this.worldToTile(enemy.body.x, enemy.body.y);
      if (this.revealed[t.y]?.[t.x] && enemy.state !== "dead") this.minimapGfx.fillStyle(enemy.kind === "melee" ? 0xe74c3c : 0xb768ff, 1).fillRect(boxX + t.x * sx - 1, boxY + t.y * sy - 1, 3, 3);
    });
    this.captives.forEach((_visual, body) => {
      const captiveBody = body as Phaser.Physics.Arcade.Sprite;
      const t = this.worldToTile(captiveBody.x, captiveBody.y);
      if (this.revealed[t.y]?.[t.x]) this.minimapGfx.fillStyle(0x8fbf9f, 1).fillRect(boxX + t.x * sx - 1, boxY + t.y * sy - 1, 3, 3);
    });
    const pTile = this.worldToTile(this.playerBody.x, this.playerBody.y);
    this.minimapGfx.fillStyle(0xffffff, 1).fillRect(boxX + pTile.x * sx - 1, boxY + pTile.y * sy - 1, 3, 3);
  }

  private updateProgressText(): void {
    const aliveEnemies = this.enemyStates.filter((enemy) => enemy.state !== "dead").length;
    this.progressText.setText(`적 ${aliveEnemies}  |  포로 ${this.captives.size}  |  인벤토리 ${this.inventoryItems.length}/9`);
  }

  private applyWalkBounce(visual: Phaser.GameObjects.Image, speed: number, time: number, phaseOffsetMs: number): void {
    const baseScaleX = visual.getData("baseScaleX") as number | undefined;
    const baseScaleY = visual.getData("baseScaleY") as number | undefined;
    const scaleX = baseScaleX ?? visual.scaleX;
    const scaleY = baseScaleY ?? visual.scaleY;
    if (speed > 5) {
      const bounce = Math.abs(Math.sin((time + phaseOffsetMs) * 0.012)) * 3;
      visual.y -= bounce;
      visual.setScale(scaleX, scaleY * (1 - bounce * 0.012));
    } else {
      visual.setScale(scaleX, scaleY);
    }
  }

  private flashToast(text: string, color: string, x = this.playerVisual.x, y = this.playerVisual.y - 30): void {
    const toast = this.add.text(x, y, text, { fontFamily: "sans-serif", fontSize: "13px", color }).setOrigin(0.5).setDepth(DEPTH_TOAST);
    this.tweens.add({ targets: toast, y: toast.y - 18, alpha: 0, duration: 700, onComplete: () => toast.destroy() });
  }
}
