import Phaser from "phaser";
import { AGES, getAge, type AgeId } from "../data/ages";
import { assetUrl } from "../config/assetUrl";
import {
  ACTIVE_UNIT_FACING_DIRECTIONS,
  UNIT_ANIMATION_ASSETS,
  getUnitAnimationDefinition,
  isMechanizedUnit,
  resolveHorizontalPresentationDirection,
  resolveTeamUnitTextureKey,
  shouldFlipUnitFrame,
  type UnitFacingDirection,
} from "../presentation/units/unitAnimationRegistry";
import { resolveWalkMotion } from "../presentation/units/combatPresentation";
import { resolveAnimatedUnitPresentation } from "../presentation/units/unitPresentation";
import {
  PRODUCTION_STRUCTURE_ASSETS,
  STRUCTURE_GROUND_ORIGIN,
  getDefenseTowerTexture,
  getDefenseTowerVisibleHeightRatio,
} from "../presentation/structures/productionStructureRegistry";
import {
  getSupportWagonAgeStats,
  UNIT_STATS,
  type LaneUnitId,
} from "../systems/lane-units/unitStats";

type SandboxTeam = "player" | "enemy";
type SandboxAnimationMode = "idle" | "walk" | "attack";

interface SandboxState {
  unitId: LaneUnitId;
  team: SandboxTeam;
  ageId: AgeId;
  direction: UnitFacingDirection;
  mode: SandboxAnimationMode;
  autoplay: boolean;
  manualPhase: number;
}

interface UnitSandboxSnapshot extends SandboxState {
  textureKey: string;
  textureKeyResolved: string;
  directionMode: "direct" | "legacy-mirrored" | "none";
  flipX: boolean;
  spriteWidth: number;
  spriteHeight: number;
  spriteX: number;
  spriteY: number;
}

interface UnitSandboxControl {
  setUnit: (unitId: LaneUnitId) => void;
  setTeam: (team: SandboxTeam) => void;
  setAge: (ageId: AgeId) => void;
  setDirection: (direction: UnitFacingDirection) => void;
  setMode: (mode: SandboxAnimationMode) => void;
  setAutoplay: (autoplay: boolean) => void;
  setManualPhase: (phase: number) => void;
  cycleUnit: (delta: number) => void;
  cycleAge: (delta: number) => void;
  cycleDirection: (delta: number) => void;
  snapshot: () => UnitSandboxSnapshot;
}

interface SandboxListEntry {
  unitId: LaneUnitId;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

const SANDBOX_UNITS = Object.keys(UNIT_STATS) as LaneUnitId[];
const SANDBOX_BG_KEY = "unit-sandbox-bg";
const PREVIEW_CENTER_X = 870;
const PREVIEW_CENTER_Y = 470;
const DIRECTION_RING_RADIUS = 118;
const TOWER_PREVIEW_X = 1378;
const TOWER_PREVIEW_Y = 724;

function clampPhase(value: number): number {
  return Phaser.Math.Clamp(value, 0, 1);
}

function cycleIndex(index: number, delta: number, size: number): number {
  return (index + delta + size) % size;
}

function directionVector(direction: UnitFacingDirection): Phaser.Math.Vector2 {
  switch (direction) {
    case "n": return new Phaser.Math.Vector2(0, -1);
    case "ne": return new Phaser.Math.Vector2(1, -1).normalize();
    case "e": return new Phaser.Math.Vector2(1, 0);
    case "se": return new Phaser.Math.Vector2(1, 1).normalize();
    case "s": return new Phaser.Math.Vector2(0, 1);
    case "sw": return new Phaser.Math.Vector2(-1, 1).normalize();
    case "w": return new Phaser.Math.Vector2(-1, 0);
    case "nw": return new Phaser.Math.Vector2(-1, -1).normalize();
  }
}

export class UnitSandboxScene extends Phaser.Scene {
  private state: SandboxState = {
    unitId: "stone_slinger",
    team: "player",
    ageId: "stone",
    direction: "e",
    mode: "walk",
    autoplay: true,
    manualPhase: 0,
  };

  private sprite!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Ellipse;
  private groundRing!: Phaser.GameObjects.Ellipse;
  private towerSprite!: Phaser.GameObjects.Image;
  private towerShadow!: Phaser.GameObjects.Ellipse;
  private infoText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private listEntries: SandboxListEntry[] = [];
  private elapsed = 0;

  constructor() {
    super("unit-sandbox");
  }

  preload(): void {
    if (!this.textures.exists(SANDBOX_BG_KEY)) {
      this.load.image(SANDBOX_BG_KEY, assetUrl("assets/battle/lane-battlefield-object-base-v4-prototype-v2.png"));
    }
    UNIT_ANIMATION_ASSETS.forEach((asset) => {
      if (!this.textures.exists(asset.key)) {
        this.load.image(asset.key, asset.path);
      }
    });
    PRODUCTION_STRUCTURE_ASSETS.forEach((asset) => {
      if (!this.textures.exists(asset.key)) {
        this.load.image(asset.key, asset.path);
      }
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#10181f");
    this.add.image(800, 450, SANDBOX_BG_KEY).setDisplaySize(1600, 900).setAlpha(0.36);
    this.add.rectangle(800, 450, 1600, 900, 0x07111a, 0.52);

    this.add.text(42, 28, "유닛 E/W 포즈 샌드박스", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#f4ebd3",
      stroke: "#1a0f07",
      strokeThickness: 5,
    });

    this.drawPanels();
    this.drawPreviewBoard();
    this.createUnitList();
    this.createButtons();
    this.createInfoPanels();
    this.bindKeyboard();
    this.publishControl();
    this.refreshView();

    this.events.once("shutdown", () => {
      delete (window as unknown as { __unitSandboxControl?: UnitSandboxControl }).__unitSandboxControl;
      delete (window as unknown as { __unitSandboxDebug?: UnitSandboxSnapshot }).__unitSandboxDebug;
    });
  }

  update(_time: number, delta: number): void {
    this.elapsed += delta / 1000;
    if (this.state.autoplay) {
      this.refreshView();
      return;
    }
    this.updatePresentation();
  }

  private drawPanels(): void {
    this.drawPanel(28, 74, 318, 804);
    this.drawPanel(366, 74, 812, 804);
    this.drawPanel(1198, 74, 374, 804);
  }

  private drawPanel(x: number, y: number, width: number, height: number): void {
    this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x0b1622, 0.88)
      .setStrokeStyle(2, 0x4a6480, 0.7)
      .setOrigin(0.5);
  }

  private drawPreviewBoard(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x34506a, 0.54);
    graphics.strokeLineShape(new Phaser.Geom.Line(PREVIEW_CENTER_X - 160, PREVIEW_CENTER_Y, PREVIEW_CENTER_X + 160, PREVIEW_CENTER_Y));
    graphics.lineStyle(1, 0x34506a, 0.36);
    graphics.strokeCircle(PREVIEW_CENTER_X, PREVIEW_CENTER_Y, DIRECTION_RING_RADIUS);

    ACTIVE_UNIT_FACING_DIRECTIONS.forEach((direction) => {
      const vector = directionVector(direction).scale(DIRECTION_RING_RADIUS + 34);
      this.add.text(PREVIEW_CENTER_X + vector.x, PREVIEW_CENTER_Y + vector.y, direction.toUpperCase(), {
        fontFamily: "monospace",
        fontSize: "17px",
        color: "#9dc1e4",
      }).setOrigin(0.5);
    });

    this.shadow = this.add.ellipse(PREVIEW_CENTER_X, PREVIEW_CENTER_Y + 16, 84, 22, 0x05080d, 0.34);
    this.groundRing = this.add.ellipse(PREVIEW_CENTER_X, PREVIEW_CENTER_Y + 8, 126, 34, 0x6fcaff, 0.08)
      .setStrokeStyle(2, 0x8fd9ff, 0.72);
    this.sprite = this.add.image(PREVIEW_CENTER_X, PREVIEW_CENTER_Y, resolveTeamUnitTextureKey("stone-slinger-w-idle", "player"));
    this.towerShadow = this.add.ellipse(TOWER_PREVIEW_X, TOWER_PREVIEW_Y + 26, 168, 36, 0x05080d, 0.3);
    this.towerSprite = this.add.image(TOWER_PREVIEW_X, TOWER_PREVIEW_Y, getDefenseTowerTexture("stone", "full", "player"))
      .setOrigin(STRUCTURE_GROUND_ORIGIN.x, STRUCTURE_GROUND_ORIGIN.y);
    this.phaseText = this.add.text(1118, 846, "", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#d7e5f6",
    }).setOrigin(1, 1);
  }

  private createUnitList(): void {
    this.add.text(48, 92, "유닛 목록", {
      fontFamily: "sans-serif",
      fontSize: "20px",
      color: "#f2f6ff",
    });

    const startX = 48;
    const startY = 128;
    const colWidth = 132;
    const rowHeight = 28;

    SANDBOX_UNITS.forEach((unitId, index) => {
      const col = Math.floor(index / 16);
      const row = index % 16;
      const x = startX + col * colWidth;
      const y = startY + row * rowHeight;
      const bg = this.add.rectangle(x + 56, y + 10, 112, 22, 0x142434, 0.72)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x48617a, 0.46)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(x, y, UNIT_STATS[unitId].label, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#d8e5f4",
      });
      bg.on("pointerdown", () => this.setUnit(unitId));
      bg.on("pointerover", () => {
        if (this.state.unitId !== unitId) bg.setFillStyle(0x1b3146, 0.92);
      });
      bg.on("pointerout", () => {
        if (this.state.unitId !== unitId) bg.setFillStyle(0x142434, 0.72);
      });
      this.listEntries.push({ unitId, bg, text });
    });
  }

  private createButtons(): void {
    this.add.text(1218, 92, "컨트롤", {
      fontFamily: "sans-serif",
      fontSize: "20px",
      color: "#f2f6ff",
    });

    const buttons: Array<{ x: number; y: number; width?: number; label: string; onClick: () => void }> = [
      { x: 1218, y: 132, label: "유닛 <", onClick: () => this.cycleUnit(-1) },
      { x: 1336, y: 132, label: "유닛 >", onClick: () => this.cycleUnit(1) },
      { x: 1454, y: 132, label: "팀 전환", onClick: () => this.setTeam(this.state.team === "player" ? "enemy" : "player") },
      { x: 1218, y: 188, label: "시대 <", onClick: () => this.cycleAge(-1) },
      { x: 1336, y: 188, label: "시대 >", onClick: () => this.cycleAge(1) },
      { x: 1218, y: 244, label: "방향 <", onClick: () => this.cycleDirection(-1) },
      { x: 1336, y: 244, label: "방향 >", onClick: () => this.cycleDirection(1) },
      { x: 1218, y: 314, label: "Idle", onClick: () => this.setMode("idle") },
      { x: 1336, y: 314, label: "Walk", onClick: () => this.setMode("walk") },
      { x: 1454, y: 314, label: "Attack", onClick: () => this.setMode("attack") },
      { x: 1218, y: 370, label: "Auto", onClick: () => this.setAutoplay(!this.state.autoplay) },
      { x: 1336, y: 370, label: "Phase -", onClick: () => this.setManualPhase(this.state.manualPhase - 0.1) },
      { x: 1454, y: 370, label: "Phase +", onClick: () => this.setManualPhase(this.state.manualPhase + 0.1) },
    ];

    buttons.forEach((button) => this.createButton(button.x, button.y, button.width ?? 104, 40, button.label, button.onClick));
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
  ): void {
    const bg = this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x163047, 0.96)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x7b98b7, 0.74)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x + width / 2, y + height / 2, label, {
      fontFamily: "sans-serif",
      fontSize: "15px",
      color: "#edf5ff",
    }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setFillStyle(0x21415c, 1));
    bg.on("pointerout", () => bg.setFillStyle(0x163047, 0.96));
    bg.on("pointerdown", onClick);
    text.setDepth(bg.depth + 1);
  }

  private createInfoPanels(): void {
    this.add.text(48, 596, "현재 상태", {
      fontFamily: "sans-serif",
      fontSize: "20px",
      color: "#f2f6ff",
    });
    this.infoText = this.add.text(48, 630, "", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#d9e7f8",
      lineSpacing: 6,
      wordWrap: { width: 270 },
    });

    this.helpText = this.add.text(1218, 454, "", {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#c5d6e8",
      lineSpacing: 6,
      wordWrap: { width: 320 },
    });
    this.add.text(1218, 640, "현재 시대 타워", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#f2f6ff",
    });
  }

  private bindKeyboard(): void {
    this.input.keyboard?.on("keydown-LEFT", () => this.cycleDirection(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.cycleDirection(1));
    this.input.keyboard?.on("keydown-UP", () => this.cycleUnit(1));
    this.input.keyboard?.on("keydown-DOWN", () => this.cycleUnit(-1));
    this.input.keyboard?.on("keydown-Q", () => this.cycleAge(-1));
    this.input.keyboard?.on("keydown-E", () => this.cycleAge(1));
    this.input.keyboard?.on("keydown-ONE", () => this.setMode("idle"));
    this.input.keyboard?.on("keydown-TWO", () => this.setMode("walk"));
    this.input.keyboard?.on("keydown-THREE", () => this.setMode("attack"));
    this.input.keyboard?.on("keydown-T", () => this.setTeam(this.state.team === "player" ? "enemy" : "player"));
    this.input.keyboard?.on("keydown-SPACE", () => this.setAutoplay(!this.state.autoplay));
    this.input.keyboard?.on("keydown-OPEN_BRACKET", () => this.setManualPhase(this.state.manualPhase - 0.1));
    this.input.keyboard?.on("keydown-CLOSED_BRACKET", () => this.setManualPhase(this.state.manualPhase + 0.1));
  }

  private publishControl(): void {
    const control: UnitSandboxControl = {
      setUnit: (unitId) => this.setUnit(unitId),
      setTeam: (team) => this.setTeam(team),
      setAge: (ageId) => this.setAge(ageId),
      setDirection: (direction) => this.setDirection(direction),
      setMode: (mode) => this.setMode(mode),
      setAutoplay: (autoplay) => this.setAutoplay(autoplay),
      setManualPhase: (phase) => this.setManualPhase(phase),
      cycleUnit: (delta) => this.cycleUnit(delta),
      cycleAge: (delta) => this.cycleAge(delta),
      cycleDirection: (delta) => this.cycleDirection(delta),
      snapshot: () => this.snapshot(),
    };
    (window as unknown as { __unitSandboxControl?: UnitSandboxControl }).__unitSandboxControl = control;
  }

  private setUnit(unitId: LaneUnitId): void {
    this.state.unitId = unitId;
    this.refreshView();
  }

  private setTeam(team: SandboxTeam): void {
    this.state.team = team;
    this.refreshView();
  }

  private setAge(ageId: AgeId): void {
    this.state.ageId = ageId;
    this.refreshView();
  }

  private setDirection(direction: UnitFacingDirection): void {
    this.state.direction = resolveHorizontalPresentationDirection(direction, this.state.direction as "e" | "w");
    this.refreshView();
  }

  private setMode(mode: SandboxAnimationMode): void {
    this.state.mode = mode;
    this.refreshView();
  }

  private setAutoplay(autoplay: boolean): void {
    this.state.autoplay = autoplay;
    this.refreshView();
  }

  private setManualPhase(phase: number): void {
    this.state.manualPhase = clampPhase(phase);
    this.refreshView();
  }

  private cycleUnit(delta: number): void {
    const index = SANDBOX_UNITS.indexOf(this.state.unitId);
    this.state.unitId = SANDBOX_UNITS[cycleIndex(index, delta, SANDBOX_UNITS.length)];
    this.refreshView();
  }

  private cycleAge(delta: number): void {
    const index = AGES.findIndex((age) => age.id === this.state.ageId);
    this.state.ageId = AGES[cycleIndex(index, delta, AGES.length)].id;
    this.refreshView();
  }

  private cycleDirection(delta: number): void {
    const current = resolveHorizontalPresentationDirection(this.state.direction);
    const index = ACTIVE_UNIT_FACING_DIRECTIONS.indexOf(current);
    this.state.direction = ACTIVE_UNIT_FACING_DIRECTIONS[
      cycleIndex(index, delta, ACTIVE_UNIT_FACING_DIRECTIONS.length)
    ];
    this.refreshView();
  }

  private refreshView(): void {
    this.updatePresentation();
    this.updateText();
    this.updateUnitListSelection();
    (window as unknown as { __unitSandboxDebug?: UnitSandboxSnapshot }).__unitSandboxDebug = this.snapshot();
  }

  private updatePresentation(): void {
    const logicalTextureKey = this.resolveLogicalTextureKey();
    const phase = this.state.autoplay ? (this.elapsed * 0.8) % 1 : this.state.manualPhase;
    const attackProgress = this.state.mode === "attack" ? phase : 0;
    const moving = this.state.mode === "walk";
    const targetVisibleWorldHeight = this.state.unitId === "supply_wagon" ? 118 : 112;
    const resolved = resolveAnimatedUnitPresentation(
      this.state.unitId,
      logicalTextureKey,
      moving,
      phase,
      attackProgress,
      this.state.direction,
      targetVisibleWorldHeight,
    );
    const { textureKey, framePresentation, idleFramePresentation } = resolved;
    this.sprite.setTexture(resolveTeamUnitTextureKey(textureKey, this.state.team));

    const facing = directionVector(this.state.direction);
    const flipX = shouldFlipUnitFrame(this.state.unitId, facing.x, this.state.direction);
    const locomotionFacingX: -1 | 1 = facing.x >= 0 ? 1 : -1;
    const mechanized = isMechanizedUnit(this.state.unitId);
    const walkMotion = moving && !mechanized
      ? resolveWalkMotion(phase, locomotionFacingX)
      : { swayX: 0, lift: 0, rotationRad: 0 };
    const attackEase = this.state.mode === "attack" && !mechanized
      ? Math.sin(attackProgress * Math.PI)
      : 0;
    const attackOffsetX = facing.x * 12 * attackEase;
    const attackOffsetY = facing.y * 8 * attackEase - attackEase * 4;
    const attackRotation = facing.x * 0.08 * attackEase;
    const shadowWidth = Math.max(44, idleFramePresentation.spriteWidth * 0.8);
    const shadowHeight = Math.max(14, framePresentation.spriteHeight * 0.12);

    this.sprite
      .setOrigin(framePresentation.originX, framePresentation.originY)
      .setFlipX(flipX)
      .setRotation(walkMotion.rotationRad + attackRotation)
      .setPosition(
        PREVIEW_CENTER_X + walkMotion.swayX + attackOffsetX,
        PREVIEW_CENTER_Y + walkMotion.lift + attackOffsetY,
      )
      .setDisplaySize(framePresentation.spriteWidth, framePresentation.spriteHeight);

    this.shadow
      .setPosition(PREVIEW_CENTER_X + attackOffsetX * 0.4, PREVIEW_CENTER_Y + 18)
      .setSize(shadowWidth - attackEase * 10, shadowHeight - attackEase * 2);

    this.groundRing
      .setPosition(PREVIEW_CENTER_X, PREVIEW_CENTER_Y + 8)
      .setSize(Math.max(64, shadowWidth * 1.18), Math.max(18, shadowHeight * 1.4))
      .setStrokeStyle(2, this.state.team === "player" ? 0x8fd9ff : 0xffa2a2, 0.82);

    const towerTexture = getDefenseTowerTexture(this.state.ageId, "full", this.state.team);
    const visibleHeightRatio = getDefenseTowerVisibleHeightRatio(this.state.ageId, "full");
    const towerVisibleHeight = 158;
    const towerHeight = towerVisibleHeight / visibleHeightRatio;
    this.towerSprite
      .setTexture(towerTexture)
      .setPosition(TOWER_PREVIEW_X, TOWER_PREVIEW_Y + 6)
      .setDisplaySize(towerHeight, towerHeight);
    this.towerShadow
      .setPosition(TOWER_PREVIEW_X, TOWER_PREVIEW_Y + 28)
      .setFillStyle(0x05080d, 0.26)
      .setSize(Math.max(120, towerHeight * 0.68), 30);
  }

  private updateText(): void {
    const logicalTextureKey = this.resolveLogicalTextureKey();
    const phase = this.state.autoplay ? (this.elapsed * 0.8) % 1 : this.state.manualPhase;
    const attackProgress = this.state.mode === "attack" ? phase : 0;
    const moving = this.state.mode === "walk";
    const textureKey = resolveAnimatedUnitPresentation(
      this.state.unitId,
      logicalTextureKey,
      moving,
      phase,
      attackProgress,
      this.state.direction,
      this.state.unitId === "supply_wagon" ? 118 : 112,
    ).textureKey;

    const definition = getUnitAnimationDefinition(this.state.unitId);
    const unitStats = UNIT_STATS[this.state.unitId];
    const age = getAge(this.state.ageId);

    this.infoText.setText([
      `유닛: ${unitStats.label}`,
      `id: ${this.state.unitId}`,
      `팀: ${this.state.team === "player" ? "아군" : "적군"}`,
      `방향: ${this.state.direction.toUpperCase()}`,
      `포즈: ${this.state.mode}`,
      `자동재생: ${this.state.autoplay ? "ON" : "OFF"}`,
      `시대: ${age.label}`,
      `규약: ${definition?.directionMode ?? "none"}`,
      `텍스처: ${textureKey}`,
      `표시 크기: ${Math.round(this.sprite.displayWidth)} x ${Math.round(this.sprite.displayHeight)}`,
      `flipX: ${this.sprite.flipX ? "true" : "false"}`,
      `공격 ${unitStats.attack} / 방어 ${unitStats.defense}`,
      `HP ${unitStats.hp} / 사거리 ${unitStats.rangeMultiplier}`,
      `타워: ${getDefenseTowerTexture(this.state.ageId, "full", this.state.team)}`,
    ].join("\n"));

    this.helpText.setText([
      "키보드",
      "↑/↓ 유닛 변경",
      "←/→ E/W 방향 변경",
      "Q/E 시대 변경",
      "1/2/3 idle/walk/attack",
      "T 팀 전환",
      "Space 자동재생 토글",
      "[ / ] 수동 phase 이동 (0.1)",
      "",
      "검수 기준",
      "- walk: 제자리 프레임 전환",
      "- attack: 제자리 전진/리코일",
      "- 우측 하단: 현재 시대/팀 타워 프리뷰",
      "- 실제 경로 이동은 표시하지 않음",
      "",
      "콘솔",
      "window.__unitSandboxControl.snapshot()",
    ].join("\n"));

    this.phaseText.setText(`phase ${phase.toFixed(3)}`);
  }

  private updateUnitListSelection(): void {
    this.listEntries.forEach((entry) => {
      const selected = entry.unitId === this.state.unitId;
      entry.bg
        .setFillStyle(selected ? 0x2a4d6e : 0x142434, selected ? 0.98 : 0.72)
        .setStrokeStyle(1, selected ? 0xa7d2ff : 0x48617a, selected ? 0.95 : 0.46);
      entry.text.setColor(selected ? "#ffffff" : "#d8e5f4");
    });
  }

  private resolveLogicalTextureKey(): string {
    if (this.state.unitId === "supply_wagon") {
      return getSupportWagonAgeStats(this.state.ageId).textureKey;
    }
    return UNIT_STATS[this.state.unitId].textureKey;
  }

  private snapshot(): UnitSandboxSnapshot {
    const logicalTextureKey = this.resolveLogicalTextureKey();
    const phase = this.state.autoplay ? (this.elapsed * 0.8) % 1 : this.state.manualPhase;
    const attackProgress = this.state.mode === "attack" ? phase : 0;
    const moving = this.state.mode === "walk";
    const textureKey = resolveAnimatedUnitPresentation(
      this.state.unitId,
      logicalTextureKey,
      moving,
      phase,
      attackProgress,
      this.state.direction,
      this.state.unitId === "supply_wagon" ? 118 : 112,
    ).textureKey;
    return {
      ...this.state,
      textureKey,
      textureKeyResolved: resolveTeamUnitTextureKey(textureKey, this.state.team),
      directionMode: getUnitAnimationDefinition(this.state.unitId)?.directionMode ?? "none",
      flipX: this.sprite.flipX,
      spriteWidth: this.sprite.displayWidth,
      spriteHeight: this.sprite.displayHeight,
      spriteX: this.sprite.x,
      spriteY: this.sprite.y,
    };
  }
}
