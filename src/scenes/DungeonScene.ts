import Phaser from "phaser";
import { drawChibiTexture } from "../gfx/chibi";
import { UNIT_TYPES, getUnitType, DEFAULT_UNIT_TYPE_ID } from "../data/unitTypes";
import { COMMANDS } from "../data/commands";
import { Squad } from "../systems/squad";
import { createCombatEncounter, submitCommand, type CombatEncounterState } from "../systems/combat";
import { generateDungeon, TILE, type DungeonResult, type TileCoord } from "../systems/dungeonGenerator";

const TILE_SIZE = 20;
const OFFSET_X = 30;
const OFFSET_Y = 86;
const VISION_RADIUS = 4; // tiles
const SPEED = 140; // px/s
const TRAIL_SPACING = 8; // history samples between followers
const HISTORY_MAX = 400;

type Phase = "explore" | "combat" | "resolving";

/**
 * Real-time top-down dungeon: the player walks the corridors (Diablo-style,
 * only nearby tiles visible + a minimap), bumps into enemies to fight them
 * (Patapon-style command/timer overlay, reused from the old combat system),
 * and auto-frees captives on contact to grow a trailing squad line. Reaching
 * the exit tile wins the run. Replaces the earlier menu/fork-based RunScene
 * after user feedback that the fork-menu UI lost the "actually moving
 * through a dungeon" feel the concept was built around.
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
  private exitZone!: Phaser.GameObjects.Rectangle;

  private fogTiles: Phaser.GameObjects.Rectangle[][] = [];
  private revealed: boolean[][] = [];
  private lastPlayerTile: TileCoord = { x: -1, y: -1 };

  private minimapGfx!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;

  // combat overlay state
  private combatState: CombatEncounterState | null = null;
  private combatStartTime = 0;
  private combatContainer!: Phaser.GameObjects.Container;
  private timerFill?: Phaser.GameObjects.Rectangle;
  private sequenceIcons: Phaser.GameObjects.Rectangle[] = [];
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

    UNIT_TYPES.forEach((u) => drawChibiTexture(this, `chibi-${u.id}`, u.palette));
    drawChibiTexture(this, "chibi-enemy", { skin: 0xd9a5a0, outfit: 0x6b2d3c, accent: 0x8a3b4a });
    drawChibiTexture(this, "chibi-captive", { skin: 0xf2c299, outfit: 0x4a6b5a, accent: 0x8fbf9f });

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0a0d1a).setOrigin(0, 0);
    this.progressText = this.add
      .text(this.scale.width - 16, 16, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#cfd3e6" })
      .setOrigin(1, 0);
    this.add
      .text(16, 16, "화살표/WASD로 이동 — 적과 부딪히면 전투, 동료는 닿으면 자동 구출", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#8890b0",
      })
      .setOrigin(0, 0);

    this.buildTilemapVisual();
    this.buildWallColliders();
    this.buildFog();

    const startWorld = this.tileToWorld(this.dungeon.playerStart);
    this.player = this.physics.add.sprite(startWorld.x, startWorld.y, "chibi-soldier");
    this.player.setCollideWorldBounds(false);
    // Body offset is relative to the frame's top-left, not its display
    // origin — center a small top-down footprint box on the sprite's
    // actual (x, y) instead of anchoring to the visual "feet" (that math
    // is for side-view games; here it just pushed the hitbox into the
    // tile row below and made the player snag on walls one row down).
    this.player.body!.setSize(16, 16).setOffset(12, 18);
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
      const s = this.enemyGroup.create(w.x, w.y, "chibi-enemy") as Phaser.Physics.Arcade.Sprite;
      this.enemySprites.set(s, tile);
    });

    this.captiveGroup = this.physics.add.staticGroup();
    this.dungeon.captives.forEach((tile) => {
      const w = this.tileToWorld(tile);
      const s = this.captiveGroup.create(w.x, w.y, "chibi-captive") as Phaser.Physics.Arcade.Sprite;
      this.captiveSprites.set(s, tile);
    });

    const exitWorld = this.tileToWorld(this.dungeon.exit);
    this.add.text(exitWorld.x, exitWorld.y, "🚩", { fontSize: "20px" }).setOrigin(0.5).setDepth(15);
    this.exitZone = this.add.rectangle(exitWorld.x, exitWorld.y, TILE_SIZE, TILE_SIZE, 0x000000, 0);
    this.physics.add.existing(this.exitZone, true);

    this.physics.add.overlap(this.player, this.enemyGroup, (_p, enemyObj) => this.onEnemyContact(enemyObj));
    this.physics.add.overlap(this.player, this.captiveGroup, (_p, captiveObj) => this.onCaptiveContact(captiveObj));
    this.physics.add.overlap(this.player, this.exitZone, () => this.onExitReached());

    this.minimapGfx = this.add.graphics().setDepth(50);
    this.combatContainer = this.add.container(0, 0).setDepth(60);

    this.renderSquadTrail();
    this.updateVision(true);
    this.updateMinimap();
    this.updateProgressText();
  }

  private wallGroup!: Phaser.Physics.Arcade.StaticGroup;

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
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isWall = grid[y][x] === TILE.WALL;
        const checker = (x + y) % 2 === 0;
        const color = isWall ? 0x1a1f33 : checker ? 0x2b3352 : 0x27304c;
        g.fillStyle(color, 1);
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
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

  private updateMinimap(): void {
    const { width, height } = this.dungeon;
    const boxW = 130;
    const boxH = 78;
    const boxX = this.scale.width - boxW - 12;
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
      const tex = `chibi-${getUnitType(member.unitTypeId).id}`;
      return this.add.image(this.player.x, this.player.y, tex).setDepth(30);
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

  // ---- update loop --------------------------------------------------------

  update(time: number, delta: number): void {
    if (this.phase === "explore") {
      this.handleMovement(delta);
      this.updateVision();
      this.updateSquadTrail();
    } else if (this.phase === "combat" && this.combatState && this.timerFill) {
      const elapsed = time - this.combatStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.combatState.timeLimitMs);
      this.timerFill.width = 220 * remaining;
      if (remaining <= 0) this.onCombatTimeout();
    }

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

  // ---- combat overlay -----------------------------------------------------

  private onEnemyContact(enemyObj: unknown): void {
    if (this.phase !== "explore") return;
    const obj = enemyObj as unknown as Phaser.GameObjects.GameObject;
    if (!this.enemySprites.has(obj)) return;

    this.phase = "combat";
    this.player.setVelocity(0, 0);
    this.currentEnemyObj = obj;
    this.combatState = createCombatEncounter(2);
    this.combatStartTime = this.time.now;

    this.combatContainer.removeAll(true);
    const cx = this.scale.width / 2;
    const cy = this.scale.height - 90;

    const bg = this.add.rectangle(cx, cy, 320, 130, 0x10152a, 0.92).setStrokeStyle(2, 0x3a4570);
    const label = this.add
      .text(cx, cy - 50, "적과 조우!", { fontFamily: "sans-serif", fontSize: "15px", color: "#f2a0a0" })
      .setOrigin(0.5);
    const barBg = this.add.rectangle(cx, cy - 25, 220, 14, 0x2a2f4a, 1).setStrokeStyle(1, 0x4a5590);
    this.timerFill = this.add.rectangle(cx - 110, cy - 25, 220, 14, 0xf2c14e, 1).setOrigin(0, 0.5);

    const seq = this.combatState.sequence;
    const startX = cx - ((seq.length - 1) * 26) / 2;
    this.sequenceIcons = seq.map((_id, i) => {
      const box = this.add.rectangle(startX + i * 26, cy + 5, 20, 20, 0x2a2f4a, 1).setStrokeStyle(2, 0x4a5590);
      this.combatContainer.add(box);
      return box;
    });
    this.refreshSequenceIcons();

    this.combatContainer.add([bg, label, barBg, this.timerFill]);

    const btnStartX = cx - ((COMMANDS.length - 1) * 130) / 2;
    COMMANDS.forEach((cmd, i) => {
      const rect = this.add.rectangle(btnStartX + i * 130, cy + 40, 110, 34, cmd.color, 1).setStrokeStyle(2, 0xffffff, 0.25);
      const text = this.add.text(btnStartX + i * 130, cy + 40, cmd.label, { fontFamily: "sans-serif", fontSize: "14px", color: "#fff" }).setOrigin(0.5);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.onCommandPressed(cmd.id));
      this.combatContainer.add([rect, text]);
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
    this.combatContainer.removeAll(true);
    this.flashToast("전투 승리!", "#8fe08f");
    this.time.delayedCall(400, () => this.endCombat());
  }

  private onCombatTimeout(): void {
    this.phase = "resolving";
    this.removeCurrentEnemy();
    this.squad.removeFront();
    this.renderSquadTrail();
    this.combatContainer.removeAll(true);
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
      .text(this.player.x, this.player.y - 30, text, { fontFamily: "sans-serif", fontSize: "14px", color })
      .setOrigin(0.5)
      .setDepth(70);
    this.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }
}
