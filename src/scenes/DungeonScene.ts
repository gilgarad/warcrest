import Phaser from "phaser";
import { drawChibiTexture } from "../gfx/chibi";
import {
  ISO_TILE_W,
  ISO_TILE_H,
  WALL_HEIGHT,
  isoProject,
  isoDepth,
  drawFloorDiamond,
  drawWallBlockTexture,
  wallBlockOrigin,
} from "../gfx/iso";
import { UNIT_TYPES, getUnitType, DEFAULT_UNIT_TYPE_ID } from "../data/unitTypes";
import { COMMANDS } from "../data/commands";
import { Squad } from "../systems/squad";
import { createCombatEncounter, tickCombat, pressSlot, type CombatEncounterState } from "../systems/combat";
import { generateDungeon, TILE, type DungeonResult, type TileCoord } from "../systems/dungeonGenerator";

const CANVAS_W = 960;

// Logic grid — movement/collision/fog radius all live here, untouched by
// the iso rendering below. See docs/patterns/README.md.
const TILE_SIZE = 20;
const OFFSET_X = 0;
const OFFSET_Y = 0;
const VISION_RADIUS = 8; // tiles
const SPEED = 130; // px/s

const ISO_ORIGIN_X = 0;
const ISO_ORIGIN_Y = 0;

const CHAR_W = 20;
const CHAR_H = 26;

const PANEL_W = 130;
const PANEL_X = CANVAS_W - PANEL_W / 2 - 10;
const PANEL_TOP = 130;
const PANEL_BOTTOM = 420;

const DEPTH_FLOOR = -1000;
const DEPTH_FOG = 2000;
const DEPTH_UI = 3000;
const DEPTH_TOAST = 3500;

const TRAIL_SPACING = 6;
const HISTORY_MAX = 500;

type Phase = "explore" | "combat" | "resolving";

interface SlotButton {
  rect: Phaser.GameObjects.Rectangle;
  cooldownOverlay: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  cmdId: string;
  height: number;
}

/**
 * Isometric (Diablo-style) top-down dungeon. Movement/collision/fog radius
 * stay in an orthogonal logic grid exactly like the previous top-down
 * version (proven, already debugged) — only *drawing* positions go through
 * an iso projection (`gfx/iso.ts`). Every moving/placed thing therefore has
 * an invisible physics/logic body plus a separate visible Image kept in
 * sync each frame; see the `*Visual` fields below.
 *
 * Combat moved from a scripted command sequence to an MMO-hotbar model:
 * enemies have HP, commands are cooldown-gated slots (offense damages,
 * defense opens a guard window against the enemy's own attack timer) — see
 * `systems/combat.ts`.
 */
export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonResult;
  private phase: Phase = "explore";

  private playerBody!: Phaser.Physics.Arcade.Sprite;
  private playerVisual!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  private squad!: Squad;
  private history: { x: number; y: number }[] = [];
  private squadVisuals: Phaser.GameObjects.Image[] = [];

  private enemyBodies = new Map<Phaser.GameObjects.GameObject, TileCoord>();
  private enemyVisuals = new Map<Phaser.GameObjects.GameObject, Phaser.GameObjects.Image>();
  private captiveBodies = new Map<Phaser.GameObjects.GameObject, TileCoord>();
  private captiveVisuals = new Map<Phaser.GameObjects.GameObject, Phaser.GameObjects.Image>();
  private enemyGroup!: Phaser.Physics.Arcade.StaticGroup;
  private captiveGroup!: Phaser.Physics.Arcade.StaticGroup;
  private wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  private exitZone!: Phaser.GameObjects.Rectangle;

  private fogTiles: Phaser.GameObjects.Image[][] = [];
  private revealed: boolean[][] = [];
  private lastPlayerTile: TileCoord = { x: -1, y: -1 };
  private lightGfx!: Phaser.GameObjects.Graphics;

  private minimapGfx!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;

  private actionPanelTitle!: Phaser.GameObjects.Text;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBarBg!: Phaser.GameObjects.Rectangle;
  private guardIndicator!: Phaser.GameObjects.Text;
  private slotButtons: SlotButton[] = [];

  private combatState: CombatEncounterState | null = null;
  private currentEnemyObj: Phaser.GameObjects.GameObject | null = null;

  constructor() {
    super("run");
  }

  create(): void {
    this.phase = "explore";
    this.dungeon = generateDungeon();
    this.squad = new Squad(DEFAULT_UNIT_TYPE_ID);
    this.history = [];
    this.enemyBodies.clear();
    this.enemyVisuals.clear();
    this.captiveBodies.clear();
    this.captiveVisuals.clear();

    UNIT_TYPES.forEach((u) => drawChibiTexture(this, `chibi-${u.id}-sm`, u.palette, { width: CHAR_W, height: CHAR_H }));
    drawChibiTexture(this, "chibi-enemy-sm", { skin: 0xd9975f, outfit: 0xc0392b, accent: 0x6b2d2d }, { width: CHAR_W, height: CHAR_H });
    drawChibiTexture(this, "chibi-captive-sm", { skin: 0xffcc99, outfit: 0x2ecc71, accent: 0x1a8f4c }, { width: CHAR_W, height: CHAR_H });

    this.cameras.main.setBackgroundColor(0x05070f);
    this.buildIsoTilemap();
    this.buildWallColliders();
    this.buildFog();
    this.lightGfx = this.add.graphics().setDepth(DEPTH_FLOOR + 1);

    const startWorld = this.tileToWorld(this.dungeon.playerStart);
    this.playerBody = this.physics.add.sprite(startWorld.x, startWorld.y, "chibi-soldier-sm");
    this.playerBody.setVisible(false);
    this.playerBody.setCollideWorldBounds(false);
    // Body offset is relative to the frame's top-left, not its display
    // origin — center a small top-down footprint box on the sprite's
    // actual (x, y). See docs/patterns/README.md for why.
    this.playerBody.body!.setSize(8, 8).setOffset(6, 9);
    this.physics.add.collider(this.playerBody, this.wallGroup);

    this.playerVisual = this.add.image(0, 0, "chibi-soldier-sm").setOrigin(0.5, 1);
    this.syncVisual(this.playerVisual, this.playerBody.x, this.playerBody.y);

    this.setupCamera();

    this.cursors = this.input.keyboard!.createCursorKeys();
    const kc = Phaser.Input.Keyboard.KeyCodes;
    this.wasd = {
      up: this.input.keyboard!.addKey(kc.W),
      down: this.input.keyboard!.addKey(kc.S),
      left: this.input.keyboard!.addKey(kc.A),
      right: this.input.keyboard!.addKey(kc.D),
    };

    this.enemyGroup = this.physics.add.staticGroup();
    this.dungeon.enemies.forEach((tile) => {
      const w = this.tileToWorld(tile);
      const body = this.enemyGroup.create(w.x, w.y, "chibi-enemy-sm") as Phaser.Physics.Arcade.Sprite;
      body.setVisible(false);
      this.enemyBodies.set(body, tile);
      const visual = this.add.image(0, 0, "chibi-enemy-sm").setOrigin(0.5, 1);
      this.syncVisual(visual, w.x, w.y);
      this.enemyVisuals.set(body, visual);
    });

    this.captiveGroup = this.physics.add.staticGroup();
    this.dungeon.captives.forEach((tile) => {
      const w = this.tileToWorld(tile);
      const body = this.captiveGroup.create(w.x, w.y, "chibi-captive-sm") as Phaser.Physics.Arcade.Sprite;
      body.setVisible(false);
      this.captiveBodies.set(body, tile);
      const visual = this.add.image(0, 0, "chibi-captive-sm").setOrigin(0.5, 1);
      this.syncVisual(visual, w.x, w.y);
      this.captiveVisuals.set(body, visual);
    });

    const exitWorld = this.tileToWorld(this.dungeon.exit);
    const exitIso = this.orthoToIso(exitWorld.x, exitWorld.y);
    this.add.text(exitIso.x, exitIso.y - ISO_TILE_H, "🚩", { fontSize: "16px" }).setOrigin(0.5, 1).setDepth(isoDepth(this.dungeon.exit.x, this.dungeon.exit.y) + 1);
    this.exitZone = this.add.rectangle(exitWorld.x, exitWorld.y, TILE_SIZE, TILE_SIZE, 0x000000, 0);
    this.physics.add.existing(this.exitZone, true);

    this.physics.add.overlap(this.playerBody, this.enemyGroup, (_p, enemyObj) => this.onEnemyContact(enemyObj));
    this.physics.add.overlap(this.playerBody, this.captiveGroup, (_p, captiveObj) => this.onCaptiveContact(captiveObj));
    this.physics.add.overlap(this.playerBody, this.exitZone, () => this.onExitReached());

    this.minimapGfx = this.add.graphics().setDepth(DEPTH_UI).setScrollFactor(0);
    this.progressText = this.add
      .text(CANVAS_W - PANEL_W - 24, 16, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#cfd3e6" })
      .setOrigin(1, 0)
      .setDepth(DEPTH_UI)
      .setScrollFactor(0);
    this.add
      .text(16, 16, "화살표/WASD 이동 — 적과 부딪히면 전투(오른쪽 슬롯), 동료는 닿으면 자동 구출", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#8890b0",
      })
      .setOrigin(0, 0)
      .setDepth(DEPTH_UI)
      .setScrollFactor(0);
    this.setupActionPanel();

    this.renderSquadVisuals();
    this.updateVision(true);
    this.updateMinimap();
    this.updateProgressText();
  }

  // ---- world / tile helpers -------------------------------------------------

  private tileToWorld(t: TileCoord): { x: number; y: number } {
    return { x: OFFSET_X + t.x * TILE_SIZE + TILE_SIZE / 2, y: OFFSET_Y + t.y * TILE_SIZE + TILE_SIZE / 2 };
  }

  private worldToTile(x: number, y: number): TileCoord {
    return {
      x: Math.floor((x - OFFSET_X) / TILE_SIZE),
      y: Math.floor((y - OFFSET_Y) / TILE_SIZE),
    };
  }

  /** Ortho physics-space pixel position -> iso screen/world position. */
  private orthoToIso(px: number, py: number): { x: number; y: number } {
    const tx = (px - OFFSET_X) / TILE_SIZE;
    const ty = (py - OFFSET_Y) / TILE_SIZE;
    return isoProject(tx, ty, ISO_ORIGIN_X, ISO_ORIGIN_Y);
  }

  private orthoDepth(px: number, py: number): number {
    const tx = (px - OFFSET_X) / TILE_SIZE;
    const ty = (py - OFFSET_Y) / TILE_SIZE;
    return isoDepth(tx, ty);
  }

  /** Repositions a visual Image to the iso projection of an ortho position, with matching depth. */
  private syncVisual(visual: Phaser.GameObjects.Image, orthoX: number, orthoY: number): void {
    const iso = this.orthoToIso(orthoX, orthoY);
    visual.setPosition(iso.x, iso.y);
    visual.setDepth(this.orthoDepth(orthoX, orthoY));
  }

  private setupCamera(): void {
    const { width, height } = this.dungeon;
    const corners = [
      isoProject(0, 0, ISO_ORIGIN_X, ISO_ORIGIN_Y),
      isoProject(width, 0, ISO_ORIGIN_X, ISO_ORIGIN_Y),
      isoProject(0, height, ISO_ORIGIN_X, ISO_ORIGIN_Y),
      isoProject(width, height, ISO_ORIGIN_X, ISO_ORIGIN_Y),
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

    const floorBase = 0x3f9660;
    const floorAlt = 0x37a670;
    const wallTop = 0x6bc17e;

    // --- floor: baked into one texture (never needs per-tile depth sorting) ---
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

    const key = "dungeon-iso-floor";
    if (this.textures.exists(key)) this.textures.remove(key);
    const g = this.add.graphics();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === TILE.WALL) continue;
        const iso = isoProject(x, y, 0, 0);
        const checker = (x + y) % 2 === 0;
        drawFloorDiamond(g, iso.x - minX, iso.y - minY, checker ? floorBase : floorAlt);
      }
    }
    g.generateTexture(key, maxX - minX, maxY - minY);
    g.destroy();
    this.add.image(minX + ISO_ORIGIN_X, minY + ISO_ORIGIN_Y, key).setOrigin(0, 0).setDepth(DEPTH_FLOOR);

    // --- walls: individual iso "block" sprites so they depth-sort against
    // the player/enemies correctly. Only tiles bordering a corridor are
    // built — deep interior rock is never seen anyway. ---
    const wallTexKey = drawWallBlockTexture(this, "iso-wall-block", wallTop);
    const origin = wallBlockOrigin();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] !== TILE.WALL) continue;
        const nearFloor = !isWall(x, y - 1) || !isWall(x, y + 1) || !isWall(x - 1, y) || !isWall(x + 1, y);
        if (!nearFloor) continue;
        const iso = isoProject(x, y, ISO_ORIGIN_X, ISO_ORIGIN_Y);
        this.add.image(iso.x, iso.y, wallTexKey).setOrigin(origin.x, origin.y).setDepth(isoDepth(x, y));
      }
    }
  }

  private buildWallColliders(): void {
    const { width, height, grid } = this.dungeon;
    this.wallGroup = this.physics.add.staticGroup();
    for (let y = 0; y < height; y++) {
      let runStart = -1;
      for (let x = 0; x <= width; x++) {
        const isWall = x < width && grid[y][x] === TILE.WALL;
        if (isWall && runStart === -1) runStart = x;
        if (!isWall && runStart !== -1) {
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
    this.fogTiles = [];
    const key = "iso-fog-diamond";
    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      drawFloorDiamond(g, (ISO_TILE_W + 2) / 2, (ISO_TILE_H + 2) / 2, 0x000000);
      g.generateTexture(key, ISO_TILE_W + 2, ISO_TILE_H + 2);
      g.destroy();
    }
    for (let y = 0; y < height; y++) {
      const row: Phaser.GameObjects.Image[] = [];
      for (let x = 0; x < width; x++) {
        const iso = isoProject(x, y, ISO_ORIGIN_X, ISO_ORIGIN_Y);
        const img = this.add.image(iso.x, iso.y, key).setDepth(DEPTH_FOG).setAlpha(1);
        row.push(img);
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
        const img = this.fogTiles[y][x];
        if (dist <= VISION_RADIUS) img.setAlpha(0);
        else if (this.revealed[y][x]) img.setAlpha(0.62);
        else img.setAlpha(1);
      }
    }
    this.updateMinimap();
  }

  private updateAmbientLight(): void {
    this.lightGfx.clear();
    const radius = VISION_RADIUS * ((ISO_TILE_W + ISO_TILE_H) / 2) * 0.7;
    const steps = 4;
    for (let i = steps; i >= 1; i--) {
      const r = radius * (i / steps);
      const alpha = 0.045 * ((steps - i + 1) / steps);
      this.lightGfx.fillStyle(0xffe3ae, alpha);
      this.lightGfx.fillCircle(this.playerVisual.x, this.playerVisual.y, r);
    }
  }

  private updateMinimap(): void {
    const { width, height } = this.dungeon;
    const boxW = PANEL_W;
    const boxH = 78;
    const boxX = CANVAS_W - boxW - 10;
    const boxY = 36;
    const sx = boxW / width;
    const sy = boxH / height;

    this.minimapGfx.clear();
    this.minimapGfx.fillStyle(0x0a0d1a, 0.85).fillRect(boxX, boxY, boxW, boxH);
    this.minimapGfx.lineStyle(1, 0x3a4570, 1).strokeRect(boxX, boxY, boxW, boxH);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!this.revealed[y][x]) continue;
        if (this.dungeon.grid[y][x] === TILE.WALL) continue;
        this.minimapGfx.fillStyle(0x4a5590, 1).fillRect(boxX + x * sx, boxY + y * sy, Math.max(1, sx), Math.max(1, sy));
      }
    }

    this.enemyBodies.forEach((tile) => {
      if (!this.revealed[tile.y][tile.x]) return;
      this.minimapGfx.fillStyle(0xe74c3c, 1).fillRect(boxX + tile.x * sx - 1, boxY + tile.y * sy - 1, 3, 3);
    });
    this.captiveBodies.forEach((tile) => {
      if (!this.revealed[tile.y][tile.x]) return;
      this.minimapGfx.fillStyle(0x8fbf9f, 1).fillRect(boxX + tile.x * sx - 1, boxY + tile.y * sy - 1, 3, 3);
    });
    if (this.revealed[this.dungeon.exit.y]?.[this.dungeon.exit.x]) {
      this.minimapGfx.fillStyle(0xf2c14e, 1).fillRect(boxX + this.dungeon.exit.x * sx - 1, boxY + this.dungeon.exit.y * sy - 1, 3, 3);
    }

    const pTile = this.worldToTile(this.playerBody.x, this.playerBody.y);
    this.minimapGfx.fillStyle(0xffffff, 1).fillRect(boxX + pTile.x * sx - 1, boxY + pTile.y * sy - 1, 3, 3);
  }

  // ---- squad visuals (loose cluster, not single-file) ------------------------

  private squadOffset(index: number): { x: number; y: number } {
    // Small fixed per-member offsets so the squad reads as a loose group
    // following the leader (Clash-of-Clans-ish troop blob) instead of a
    // single-file snake line.
    const side = index % 2 === 0 ? -1 : 1;
    const rank = Math.floor(index / 2);
    return { x: side * (5 + rank * 5), y: rank * 3 };
  }

  private renderSquadVisuals(): void {
    this.squadVisuals.forEach((img) => img.destroy());
    this.squadVisuals = this.squad.members.slice(1).map((member) => {
      const tex = `chibi-${getUnitType(member.unitTypeId).id}-sm`;
      return this.add.image(this.playerVisual.x, this.playerVisual.y, tex).setOrigin(0.5, 1);
    });
  }

  private updateSquadVisuals(time: number): void {
    this.history.push({ x: this.playerBody.x, y: this.playerBody.y });
    if (this.history.length > HISTORY_MAX) this.history.shift();
    const speed = this.playerBody.body!.velocity.length();

    this.squadVisuals.forEach((img, i) => {
      const idx = this.history.length - 1 - (i + 1) * TRAIL_SPACING;
      const pos = this.history[Math.max(0, idx)] ?? this.history[0];
      if (!pos) return;
      const off = this.squadOffset(i);
      const iso = this.orthoToIso(pos.x + off.x, pos.y + off.y);
      img.setPosition(iso.x, iso.y);
      img.setDepth(this.orthoDepth(pos.x, pos.y) - 1);
      this.applyWalkBounce(img, speed, time, i * 140);
    });
  }

  /** Small squash/bounce while moving — a bit of Clash-style "juice" instead of a static glide. */
  private applyWalkBounce(visual: Phaser.GameObjects.Image, speed: number, time: number, phaseOffsetMs: number): void {
    if (speed > 5) {
      const bounce = Math.abs(Math.sin((time + phaseOffsetMs) * 0.012)) * 3;
      visual.y -= bounce;
      visual.setScale(1, 1 - bounce * 0.012);
    } else {
      visual.setScale(1, 1);
    }
  }

  private updateProgressText(): void {
    this.progressText.setText(`대열 ${this.squad.size}  |  적 ${this.enemyBodies.size}  |  포로 ${this.captiveBodies.size}`);
  }

  // ---- action panel (persistent right-side combat slots) --------------------

  private setupActionPanel(): void {
    this.add
      .rectangle(PANEL_X, (PANEL_TOP + PANEL_BOTTOM) / 2, PANEL_W, PANEL_BOTTOM - PANEL_TOP, 0x10152a, 0.85)
      .setStrokeStyle(2, 0x3a4570)
      .setDepth(DEPTH_UI)
      .setScrollFactor(0);

    this.actionPanelTitle = this.add
      .text(PANEL_X, PANEL_TOP + 14, "대기 중", { fontFamily: "sans-serif", fontSize: "13px", color: "#8890b0" })
      .setOrigin(0.5)
      .setDepth(DEPTH_UI)
      .setScrollFactor(0);

    const hpBarY = PANEL_TOP + 40;
    this.enemyHpBarBg = this.add
      .rectangle(PANEL_X, hpBarY, PANEL_W - 24, 12, 0x2a2f4a, 1)
      .setStrokeStyle(1, 0x4a5590)
      .setDepth(DEPTH_UI)
      .setScrollFactor(0)
      .setVisible(false);
    this.enemyHpBar = this.add
      .rectangle(PANEL_X - (PANEL_W - 24) / 2, hpBarY, PANEL_W - 24, 12, 0xe74c3c, 1)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI)
      .setScrollFactor(0)
      .setVisible(false);

    this.guardIndicator = this.add
      .text(PANEL_X, hpBarY + 18, "", { fontFamily: "sans-serif", fontSize: "12px", color: "#7ec8f2" })
      .setOrigin(0.5)
      .setDepth(DEPTH_UI)
      .setScrollFactor(0);

    const slotY0 = PANEL_TOP + 90;
    const slotH = 54;
    this.slotButtons = COMMANDS.map((cmd, i) => {
      const sy = slotY0 + i * (slotH + 10);
      const rect = this.add
        .rectangle(PANEL_X, sy, PANEL_W - 20, slotH, cmd.color, 0.3)
        .setStrokeStyle(2, 0x4a5590, 0.5)
        .setDepth(DEPTH_UI)
        .setScrollFactor(0);
      const cooldownOverlay = this.add
        .rectangle(PANEL_X, sy - slotH / 2, PANEL_W - 20, 0, 0x000000, 0.55)
        .setOrigin(0.5, 0)
        .setDepth(DEPTH_UI + 1)
        .setScrollFactor(0);
      const text = this.add
        .text(PANEL_X, sy, cmd.label, { fontFamily: "sans-serif", fontSize: "14px", color: "#ffffff" })
        .setOrigin(0.5)
        .setAlpha(0.5)
        .setDepth(DEPTH_UI + 2)
        .setScrollFactor(0);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.onCommandPressed(cmd.id));
      return { rect, cooldownOverlay, text, cmdId: cmd.id, height: slotH };
    });
  }

  private refreshSlotStyles(): void {
    const active = this.phase === "combat";
    this.slotButtons.forEach(({ text }) => {
      text.setAlpha(active ? 1 : 0.5);
    });
  }

  private updateSlotCooldowns(): void {
    if (!this.combatState) return;
    this.slotButtons.forEach((slot) => {
      const s = this.combatState!.slots.find((x) => x.commandId === slot.cmdId);
      const cmd = COMMANDS.find((c) => c.id === slot.cmdId)!;
      const frac = s ? s.remainingMs / cmd.cooldownMs : 0;
      slot.cooldownOverlay.height = slot.height * frac;
    });
  }

  // ---- update loop --------------------------------------------------------

  update(time: number, delta: number): void {
    if (this.phase === "explore") {
      this.handleMovement();
      this.updateVision();
    } else if (this.phase === "combat" && this.combatState) {
      const result = tickCombat(this.combatState, delta);
      this.enemyHpBar.width = (PANEL_W - 24) * Math.max(0, this.combatState.enemyHp / this.combatState.enemyMaxHp);
      this.guardIndicator.setText(this.combatState.guardMs > 0 ? "방어 중" : this.combatState.enemyAttackInMs < 500 ? "적 공격 임박!" : "");
      this.guardIndicator.setColor(this.combatState.enemyAttackInMs < 500 && this.combatState.guardMs <= 0 ? "#f2a0a0" : "#7ec8f2");
      this.updateSlotCooldowns();
      if (result === "hit") this.onPlayerHit();
    }

    this.syncVisual(this.playerVisual, this.playerBody.x, this.playerBody.y);
    this.applyWalkBounce(this.playerVisual, this.playerBody.body!.velocity.length(), time, 0);
    this.updateSquadVisuals(time);
    this.updateAmbientLight();
    this.updateProgressText();

    (window as unknown as { __gameDebug: unknown }).__gameDebug = {
      phase: this.phase,
      squadSize: this.squad.size,
      enemiesLeft: this.enemyBodies.size,
      captivesLeft: this.captiveBodies.size,
      playerWorld: { x: this.playerBody.x, y: this.playerBody.y },
      enemyHp: this.combatState?.enemyHp ?? null,
      enemyMaxHp: this.combatState?.enemyMaxHp ?? null,
      dungeon: {
        grid: this.dungeon.grid.map((row) => row.join("")),
        tileSize: TILE_SIZE,
        offsetX: OFFSET_X,
        offsetY: OFFSET_Y,
        playerStart: this.dungeon.playerStart,
        enemies: this.dungeon.enemies,
        captives: this.dungeon.captives,
        exit: this.dungeon.exit,
      },
    };
  }

  private handleMovement(): void {
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

    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    this.playerBody.setVelocity(vx * SPEED, vy * SPEED);
  }

  // ---- combat (hotbar: HP + cooldown slots, no popup) ------------------------

  private onEnemyContact(enemyObj: unknown): void {
    if (this.phase !== "explore") return;
    const obj = enemyObj as unknown as Phaser.GameObjects.GameObject;
    if (!this.enemyBodies.has(obj)) return;

    this.phase = "combat";
    this.playerBody.setVelocity(0, 0);
    this.currentEnemyObj = obj;
    this.combatState = createCombatEncounter(2);

    this.actionPanelTitle.setText("전투 중!").setColor("#f2a0a0");
    this.enemyHpBarBg.setVisible(true);
    this.enemyHpBar.setVisible(true).setSize(PANEL_W - 24, 12);
    this.refreshSlotStyles();
  }

  private onCommandPressed(commandId: string): void {
    if (this.phase !== "combat" || !this.combatState) return;
    const result = pressSlot(this.combatState, commandId);
    if (result === "win") this.onCombatWin();
  }

  private onPlayerHit(): void {
    this.squad.removeFront();
    this.renderSquadVisuals();
    this.flashToast("피격!", "#f28a8a");
    if (this.squad.isWiped) this.onCombatLose();
  }

  private onCombatWin(): void {
    this.phase = "resolving";
    this.removeCurrentEnemy();
    this.flashToast("전투 승리!", "#8fe08f");
    this.time.delayedCall(300, () => this.endCombat());
  }

  private onCombatLose(): void {
    this.phase = "resolving";
    this.removeCurrentEnemy();
    this.time.delayedCall(300, () => this.scene.start("gameover", { win: false, squadSize: 0 }));
  }

  private removeCurrentEnemy(): void {
    if (this.currentEnemyObj) {
      this.enemyBodies.delete(this.currentEnemyObj);
      this.enemyVisuals.get(this.currentEnemyObj)?.destroy();
      this.enemyVisuals.delete(this.currentEnemyObj);
      (this.currentEnemyObj as Phaser.Physics.Arcade.Sprite).destroy();
      this.currentEnemyObj = null;
    }
  }

  private endCombat(): void {
    this.combatState = null;
    this.enemyHpBarBg.setVisible(false);
    this.enemyHpBar.setVisible(false);
    this.guardIndicator.setText("");
    this.actionPanelTitle.setText("대기 중").setColor("#8890b0");
    this.slotButtons.forEach((s) => (s.cooldownOverlay.height = 0));
    this.refreshSlotStyles();
    this.phase = "explore";
  }

  // ---- rescue / exit ------------------------------------------------------

  private onCaptiveContact(captiveObj: unknown): void {
    const obj = captiveObj as unknown as Phaser.GameObjects.GameObject;
    if (!this.captiveBodies.has(obj)) return;
    this.captiveBodies.delete(obj);
    this.captiveVisuals.get(obj)?.destroy();
    this.captiveVisuals.delete(obj);
    (obj as Phaser.Physics.Arcade.Sprite).destroy();
    this.squad.add(DEFAULT_UNIT_TYPE_ID);
    this.renderSquadVisuals();
    this.flashToast("대열 합류!", "#8fe0c8");
  }

  private onExitReached(): void {
    if (this.phase !== "explore") return;
    this.scene.start("gameover", { win: true, squadSize: this.squad.size });
  }

  private flashToast(text: string, color: string): void {
    const t = this.add
      .text(this.playerVisual.x, this.playerVisual.y - 30, text, { fontFamily: "sans-serif", fontSize: "13px", color })
      .setOrigin(0.5)
      .setDepth(DEPTH_TOAST);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }
}
