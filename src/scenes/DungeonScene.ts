import Phaser from "phaser";
import { drawChibiTexture, shade } from "../gfx/chibi";
import { UNIT_TYPES, getUnitType, DEFAULT_UNIT_TYPE_ID } from "../data/unitTypes";
import { COMMANDS } from "../data/commands";
import { Squad } from "../systems/squad";
import { createCombatEncounter, submitCommand, type CombatEncounterState } from "../systems/combat";
import { generateDungeon, TILE, type DungeonResult, type TileCoord } from "../systems/dungeonGenerator";

const CANVAS_W = 960;
const CANVAS_H = 540;

const TILE_SIZE = 13;
const OFFSET_X = 16;
const OFFSET_Y = 54;
const VISION_RADIUS = 9; // tiles
const SPEED = 110; // px/s
const TRAIL_SPACING = 6; // history samples between followers
const HISTORY_MAX = 500;

const CHAR_W = 16;
const CHAR_H = 21;

const PANEL_W = 130;
const PANEL_X = CANVAS_W - PANEL_W / 2 - 10;
const PANEL_TOP = 130;
const PANEL_BOTTOM = 480;

type Phase = "explore" | "combat" | "resolving";

interface SlotButton {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  cmdId: string;
}

/**
 * Real-time top-down dungeon: the player walks the corridors (Diablo-style,
 * only nearby tiles visible + a minimap), bumps into enemies to fight them
 * via an always-on right-side command-slot panel (Patapon-style timed
 * sequence, reused from the old combat system), and auto-frees captives on
 * contact to grow a trailing squad line. Reaching the exit tile wins.
 *
 * Replaces the earlier menu/fork-based RunScene (user feedback: lost the
 * "actually moving through a dungeon" feel) and then the first dungeon pass
 * (user feedback: too flat/80s-looking, combat popped a modal box instead
 * of using persistent side slots, camera too close). This version pulls the
 * camera back (smaller tiles, wider vision radius), adds pseudo-3D tile/
 * character shading, and moves combat into a permanent action-bar panel.
 */
export class DungeonScene extends Phaser.Scene {
  private dungeon!: DungeonResult;
  private phase: Phase = "explore";

  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  private squad!: Squad;
  private history: { x: number; y: number }[] = [];
  private squadImages: Phaser.GameObjects.Image[] = [];

  private enemySprites = new Map<Phaser.GameObjects.GameObject, TileCoord>();
  private captiveSprites = new Map<Phaser.GameObjects.GameObject, TileCoord>();
  private enemyGroup!: Phaser.Physics.Arcade.StaticGroup;
  private captiveGroup!: Phaser.Physics.Arcade.StaticGroup;
  private wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  private exitZone!: Phaser.GameObjects.Rectangle;

  private fogTiles: Phaser.GameObjects.Rectangle[][] = [];
  private revealed: boolean[][] = [];
  private lastPlayerTile: TileCoord = { x: -1, y: -1 };
  private lightGfx!: Phaser.GameObjects.Graphics;

  private minimapGfx!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;

  // action panel (persistent — no more center popup)
  private actionPanelTitle!: Phaser.GameObjects.Text;
  private sequenceContainer!: Phaser.GameObjects.Container;
  private sequenceIcons: Phaser.GameObjects.Rectangle[] = [];
  private timerBarBg!: Phaser.GameObjects.Rectangle;
  private timerFill!: Phaser.GameObjects.Rectangle;
  private slotButtons: SlotButton[] = [];

  private combatState: CombatEncounterState | null = null;
  private combatStartTime = 0;
  private currentEnemyObj: Phaser.GameObjects.GameObject | null = null;

  constructor() {
    super("run");
  }

  create(): void {
    this.phase = "explore";
    this.dungeon = generateDungeon();
    this.squad = new Squad(DEFAULT_UNIT_TYPE_ID);
    this.history = [];
    this.enemySprites.clear();
    this.captiveSprites.clear();

    UNIT_TYPES.forEach((u) => drawChibiTexture(this, `chibi-${u.id}-sm`, u.palette, { width: CHAR_W, height: CHAR_H }));
    drawChibiTexture(this, "chibi-enemy-sm", { skin: 0xd9a5a0, outfit: 0x6b2d3c, accent: 0x8a3b4a }, { width: CHAR_W, height: CHAR_H });
    drawChibiTexture(this, "chibi-captive-sm", { skin: 0xf2c299, outfit: 0x4a6b5a, accent: 0x8fbf9f }, { width: CHAR_W, height: CHAR_H });

    this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x0a0d1a).setOrigin(0, 0);
    this.progressText = this.add
      .text(CANVAS_W - PANEL_W - 24, 16, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#cfd3e6" })
      .setOrigin(1, 0);
    this.add
      .text(16, 16, "화살표/WASD 이동 — 적과 부딪히면 전투(오른쪽 슬롯), 동료는 닿으면 자동 구출", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#8890b0",
      })
      .setOrigin(0, 0);

    this.buildTilemapVisual();
    this.buildWallColliders();
    this.buildFog();
    this.lightGfx = this.add.graphics().setDepth(5);

    const startWorld = this.tileToWorld(this.dungeon.playerStart);
    this.player = this.physics.add.sprite(startWorld.x, startWorld.y, "chibi-soldier-sm").setDepth(10);
    this.player.setCollideWorldBounds(false);
    // Body offset is relative to the frame's top-left, not its display
    // origin — center a small top-down footprint box on the sprite's
    // actual (x, y). See docs/patterns/README.md for why.
    this.player.body!.setSize(6, 6).setOffset(5, 7);
    this.physics.add.collider(this.player, this.wallGroup);

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
      const sp = this.enemyGroup.create(w.x, w.y, "chibi-enemy-sm") as Phaser.Physics.Arcade.Sprite;
      sp.setDepth(10);
      this.enemySprites.set(sp, tile);
    });

    this.captiveGroup = this.physics.add.staticGroup();
    this.dungeon.captives.forEach((tile) => {
      const w = this.tileToWorld(tile);
      const sp = this.captiveGroup.create(w.x, w.y, "chibi-captive-sm") as Phaser.Physics.Arcade.Sprite;
      sp.setDepth(10);
      this.captiveSprites.set(sp, tile);
    });

    const exitWorld = this.tileToWorld(this.dungeon.exit);
    this.add.text(exitWorld.x, exitWorld.y, "🚩", { fontSize: "16px" }).setOrigin(0.5).setDepth(10);
    this.exitZone = this.add.rectangle(exitWorld.x, exitWorld.y, TILE_SIZE, TILE_SIZE, 0x000000, 0);
    this.physics.add.existing(this.exitZone, true);

    this.physics.add.overlap(this.player, this.enemyGroup, (_p, enemyObj) => this.onEnemyContact(enemyObj));
    this.physics.add.overlap(this.player, this.captiveGroup, (_p, captiveObj) => this.onCaptiveContact(captiveObj));
    this.physics.add.overlap(this.player, this.exitZone, () => this.onExitReached());

    this.minimapGfx = this.add.graphics().setDepth(50);
    this.setupActionPanel();

    this.renderSquadTrail();
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

  private buildTilemapVisual(): void {
    const { width, height, grid } = this.dungeon;
    const key = "dungeon-bake";
    if (this.textures.exists(key)) this.textures.remove(key);
    const g = this.add.graphics();
    const isWall = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || grid[y][x] === TILE.WALL;

    const floorBase = 0x2b3352;
    const floorAlt = 0x27304c;
    const wallTop = 0x3c4570;

    // Pass 1: flat floor / raised wall blocks.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (grid[y][x] === TILE.WALL) {
          const front = shade(wallTop, -0.45);
          g.fillStyle(front, 1);
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE);

          // Only bevel "surface" walls that actually border a corridor —
          // decorating every tile in a solid rock mass the same way just
          // repeats into a corrugated/venetian-blinds look. Deep interior
          // wall tiles stay a flat dark mass instead.
          const isSurface = !isWall(x, y - 1) || !isWall(x, y + 1) || !isWall(x - 1, y) || !isWall(x + 1, y);
          if (isSurface) {
            g.fillStyle(wallTop, 1);
            g.fillRect(px, py, TILE_SIZE, TILE_SIZE * 0.45);
            g.fillStyle(shade(wallTop, 0.3), 0.8);
            g.fillRect(px, py, TILE_SIZE, 1.5);
            g.fillStyle(0x000000, 0.45);
            g.fillRect(px, py + TILE_SIZE - 1.5, TILE_SIZE, 1.5);
          }
        } else {
          const checker = (x + y) % 2 === 0;
          g.fillStyle(checker ? floorBase : floorAlt, 1);
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Pass 2: soft contact shadow cast by walls onto adjacent floor tiles —
    // correlates with real geometry (unlike a repeated per-tile band, which
    // just looked like venetian blinds), so it reads as actual wall height.
    const shadowDepth = Math.max(3, TILE_SIZE * 0.3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === TILE.WALL) continue;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const bands = 3;
        for (let i = 0; i < bands; i++) {
          const a = 0.32 * (1 - i / bands);
          const d = shadowDepth * (1 - i / bands);
          if (isWall(x, y - 1)) g.fillStyle(0x000000, a).fillRect(px, py, TILE_SIZE, d);
          if (isWall(x, y + 1)) g.fillStyle(0x000000, a).fillRect(px, py + TILE_SIZE - d, TILE_SIZE, d);
          if (isWall(x - 1, y)) g.fillStyle(0x000000, a).fillRect(px, py, d, TILE_SIZE);
          if (isWall(x + 1, y)) g.fillStyle(0x000000, a).fillRect(px + TILE_SIZE - d, py, d, TILE_SIZE);
        }
      }
    }

    g.generateTexture(key, width * TILE_SIZE, height * TILE_SIZE);
    g.destroy();
    this.add.image(OFFSET_X, OFFSET_Y, key).setOrigin(0, 0);
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
    for (let y = 0; y < height; y++) {
      const row: Phaser.GameObjects.Rectangle[] = [];
      for (let x = 0; x < width; x++) {
        const wx = OFFSET_X + x * TILE_SIZE + TILE_SIZE / 2;
        const wy = OFFSET_Y + y * TILE_SIZE + TILE_SIZE / 2;
        const rect = this.add.rectangle(wx, wy, TILE_SIZE + 1, TILE_SIZE + 1, 0x000000, 1).setDepth(20);
        row.push(rect);
      }
      this.fogTiles.push(row);
    }
  }

  private updateVision(force = false): void {
    const tile = this.worldToTile(this.player.x, this.player.y);
    if (!force && tile.x === this.lastPlayerTile.x && tile.y === this.lastPlayerTile.y) return;
    this.lastPlayerTile = tile;

    const { width, height } = this.dungeon;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dist = Math.max(Math.abs(x - tile.x), Math.abs(y - tile.y));
        if (dist <= VISION_RADIUS) this.revealed[y][x] = true;
        const rect = this.fogTiles[y][x];
        if (dist <= VISION_RADIUS) rect.setFillStyle(0x000000, 0);
        else if (this.revealed[y][x]) rect.setFillStyle(0x000000, 0.6);
        else rect.setFillStyle(0x000000, 1);
      }
    }
    this.updateMinimap();
  }

  private updateAmbientLight(): void {
    this.lightGfx.clear();
    const radius = VISION_RADIUS * TILE_SIZE * 0.8;
    const steps = 4;
    for (let i = steps; i >= 1; i--) {
      const r = radius * (i / steps);
      const alpha = 0.05 * ((steps - i + 1) / steps);
      this.lightGfx.fillStyle(0xffdca0, alpha);
      this.lightGfx.fillCircle(this.player.x, this.player.y, r);
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

    this.enemySprites.forEach((tile) => {
      if (!this.revealed[tile.y][tile.x]) return;
      this.minimapGfx.fillStyle(0xe74c3c, 1).fillRect(boxX + tile.x * sx - 1, boxY + tile.y * sy - 1, 3, 3);
    });
    this.captiveSprites.forEach((tile) => {
      if (!this.revealed[tile.y][tile.x]) return;
      this.minimapGfx.fillStyle(0x8fbf9f, 1).fillRect(boxX + tile.x * sx - 1, boxY + tile.y * sy - 1, 3, 3);
    });
    if (this.revealed[this.dungeon.exit.y]?.[this.dungeon.exit.x]) {
      this.minimapGfx.fillStyle(0xf2c14e, 1).fillRect(boxX + this.dungeon.exit.x * sx - 1, boxY + this.dungeon.exit.y * sy - 1, 3, 3);
    }

    const pTile = this.worldToTile(this.player.x, this.player.y);
    this.minimapGfx.fillStyle(0xffffff, 1).fillRect(boxX + pTile.x * sx - 1, boxY + pTile.y * sy - 1, 3, 3);
  }

  // ---- squad trail ------------------------------------------------------

  private renderSquadTrail(): void {
    this.squadImages.forEach((img) => img.destroy());
    this.squadImages = this.squad.members.slice(1).map((member) => {
      const tex = `chibi-${getUnitType(member.unitTypeId).id}-sm`;
      return this.add.image(this.player.x, this.player.y, tex).setDepth(9);
    });
  }

  private updateSquadTrail(): void {
    this.history.push({ x: this.player.x, y: this.player.y });
    if (this.history.length > HISTORY_MAX) this.history.shift();

    this.squadImages.forEach((img, i) => {
      const idx = this.history.length - 1 - (i + 1) * TRAIL_SPACING;
      const pos = this.history[Math.max(0, idx)] ?? this.history[0];
      if (pos) {
        img.x = pos.x;
        img.y = pos.y;
      }
    });
  }

  private updateProgressText(): void {
    this.progressText.setText(`대열 ${this.squad.size}  |  적 ${this.enemySprites.size}  |  포로 ${this.captiveSprites.size}`);
  }

  // ---- action panel (persistent right-side combat slots) --------------------

  private setupActionPanel(): void {
    this.add
      .rectangle(PANEL_X, (PANEL_TOP + PANEL_BOTTOM) / 2, PANEL_W, PANEL_BOTTOM - PANEL_TOP, 0x10152a, 0.85)
      .setStrokeStyle(2, 0x3a4570)
      .setDepth(55);

    this.actionPanelTitle = this.add
      .text(PANEL_X, PANEL_TOP + 14, "대기 중", { fontFamily: "sans-serif", fontSize: "13px", color: "#8890b0" })
      .setOrigin(0.5)
      .setDepth(56);

    this.sequenceContainer = this.add.container(0, 0).setDepth(56);

    const barY = PANEL_TOP + 62;
    this.timerBarBg = this.add
      .rectangle(PANEL_X, barY, PANEL_W - 24, 10, 0x2a2f4a, 1)
      .setStrokeStyle(1, 0x4a5590)
      .setDepth(56)
      .setVisible(false);
    this.timerFill = this.add
      .rectangle(PANEL_X - (PANEL_W - 24) / 2, barY, PANEL_W - 24, 10, 0xf2c14e, 1)
      .setOrigin(0, 0.5)
      .setDepth(57)
      .setVisible(false);

    const slotY0 = PANEL_TOP + 96;
    const slotH = 46;
    this.slotButtons = COMMANDS.map((cmd, i) => {
      const sy = slotY0 + i * (slotH + 10);
      const rect = this.add
        .rectangle(PANEL_X, sy, PANEL_W - 20, slotH, cmd.color, 0.25)
        .setStrokeStyle(2, 0x4a5590, 0.5)
        .setDepth(56);
      const text = this.add
        .text(PANEL_X, sy, cmd.label, { fontFamily: "sans-serif", fontSize: "14px", color: "#ffffff" })
        .setOrigin(0.5)
        .setAlpha(0.45)
        .setDepth(57);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.onCommandPressed(cmd.id));
      return { rect, text, cmdId: cmd.id };
    });
  }

  private refreshSlotStyles(): void {
    const active = this.phase === "combat";
    this.slotButtons.forEach(({ rect, text }) => {
      rect.setFillStyle(rect.fillColor, active ? 0.85 : 0.25);
      rect.setStrokeStyle(2, active ? 0xffffff : 0x4a5590, active ? 0.5 : 0.5);
      text.setAlpha(active ? 1 : 0.45);
    });
  }

  private refreshSequenceIcons(): void {
    if (!this.combatState) return;
    const { sequence, index } = this.combatState;
    this.sequenceIcons.forEach((box, i) => {
      const cmd = COMMANDS.find((c) => c.id === sequence[i]);
      const color = cmd?.color ?? 0xffffff;
      if (i < index) box.setFillStyle(color, 1).setStrokeStyle(2, color);
      else if (i === index) box.setFillStyle(0x2a2f4a, 1).setStrokeStyle(3, 0xf2c14e);
      else box.setFillStyle(0x2a2f4a, 1).setStrokeStyle(2, 0x4a5590);
    });
  }

  // ---- update loop --------------------------------------------------------

  update(time: number, delta: number): void {
    if (this.phase === "explore") {
      this.handleMovement(delta);
      this.updateVision();
      this.updateSquadTrail();
    } else if (this.phase === "combat" && this.combatState) {
      const elapsed = time - this.combatStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.combatState.timeLimitMs);
      this.timerFill.width = (PANEL_W - 24) * remaining;
      if (remaining <= 0) this.onCombatTimeout();
    }

    this.updateAmbientLight();
    this.updateProgressText();

    (window as unknown as { __gameDebug: unknown }).__gameDebug = {
      phase: this.phase,
      squadSize: this.squad.size,
      enemiesLeft: this.enemySprites.size,
      captivesLeft: this.captiveSprites.size,
      playerWorld: { x: this.player.x, y: this.player.y },
      combatIndex: this.combatState?.index ?? null,
      combatLength: this.combatState?.sequence.length ?? null,
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

  private handleMovement(delta: number): void {
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
    void delta;
    this.player.setVelocity(vx * SPEED, vy * SPEED);
  }

  // ---- combat (driven through the persistent action panel) ------------------

  private onEnemyContact(enemyObj: unknown): void {
    if (this.phase !== "explore") return;
    const obj = enemyObj as unknown as Phaser.GameObjects.GameObject;
    if (!this.enemySprites.has(obj)) return;

    this.phase = "combat";
    this.player.setVelocity(0, 0);
    this.currentEnemyObj = obj;
    this.combatState = createCombatEncounter(2);
    this.combatStartTime = this.time.now;

    this.actionPanelTitle.setText("전투 중!").setColor("#f2a0a0");
    this.timerBarBg.setVisible(true);
    this.timerFill.setVisible(true).setSize(PANEL_W - 24, 10);

    this.sequenceContainer.removeAll(true);
    const seq = this.combatState.sequence;
    const seqY = PANEL_TOP + 40;
    const spacing = 20;
    const startX = PANEL_X - ((seq.length - 1) * spacing) / 2;
    this.sequenceIcons = seq.map((_id, i) => {
      const box = this.add.rectangle(startX + i * spacing, seqY, 16, 16, 0x2a2f4a, 1).setStrokeStyle(2, 0x4a5590).setDepth(57);
      this.sequenceContainer.add(box);
      return box;
    });
    this.refreshSequenceIcons();
    this.refreshSlotStyles();
  }

  private onCommandPressed(commandId: string): void {
    if (this.phase !== "combat" || !this.combatState) return;
    const result = submitCommand(this.combatState, commandId);
    if (result === "wrong") return;
    this.refreshSequenceIcons();
    if (result === "complete") this.onCombatWin();
  }

  private onCombatWin(): void {
    this.phase = "resolving";
    this.removeCurrentEnemy();
    this.flashToast("전투 승리!", "#8fe08f");
    this.time.delayedCall(400, () => this.endCombat());
  }

  private onCombatTimeout(): void {
    this.phase = "resolving";
    this.removeCurrentEnemy();
    this.squad.removeFront();
    this.renderSquadTrail();
    this.flashToast("대열 손실...", "#f28a8a");
    this.time.delayedCall(400, () => this.endCombat());
  }

  private removeCurrentEnemy(): void {
    if (this.currentEnemyObj) {
      this.enemySprites.delete(this.currentEnemyObj);
      (this.currentEnemyObj as Phaser.Physics.Arcade.Sprite).destroy();
      this.currentEnemyObj = null;
    }
  }

  private endCombat(): void {
    this.combatState = null;
    this.sequenceContainer.removeAll(true);
    this.timerBarBg.setVisible(false);
    this.timerFill.setVisible(false);
    this.actionPanelTitle.setText("대기 중").setColor("#8890b0");
    this.refreshSlotStyles();

    if (this.squad.isWiped) {
      this.scene.start("gameover", { win: false, squadSize: 0 });
      return;
    }
    this.phase = "explore";
  }

  // ---- rescue / exit ------------------------------------------------------

  private onCaptiveContact(captiveObj: unknown): void {
    const obj = captiveObj as unknown as Phaser.GameObjects.GameObject;
    if (!this.captiveSprites.has(obj)) return;
    this.captiveSprites.delete(obj);
    (obj as Phaser.Physics.Arcade.Sprite).destroy();
    this.squad.add(DEFAULT_UNIT_TYPE_ID);
    this.renderSquadTrail();
    this.flashToast("대열 합류!", "#8fe0c8");
  }

  private onExitReached(): void {
    if (this.phase !== "explore") return;
    this.scene.start("gameover", { win: true, squadSize: this.squad.size });
  }

  private flashToast(text: string, color: string): void {
    const t = this.add
      .text(this.player.x, this.player.y - 20, text, { fontFamily: "sans-serif", fontSize: "13px", color })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }
}
