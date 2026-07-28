import Phaser from "phaser";
import {
  GOLDEN_PATH_CONTROL_ROWS,
  GOLDEN_PATH_HALF_WIDTH_ROWS,
  GOLDEN_TERRAIN_COLUMNS,
  GOLDEN_TERRAIN_MASKS,
  GOLDEN_TERRAIN_TILE_SIZE,
} from "../data/terrain/goldenReferenceTerrain";
import { getMarchingPolygons } from "../systems/terrain/marchingSquares";

const ASSET_ROOT = "/assets/golden-reference";
const BOARD_X = 288;
const BOARD_Y = 130;

const GOLDEN_ASSETS = {
  idle: "prototype-golden-bronze-spearman-idle-v1",
  walkA: "prototype-golden-bronze-spearman-walk-a-v2",
  walkB: "prototype-golden-bronze-spearman-walk-b-v2",
  attack: "prototype-golden-bronze-spearman-attack-v2",
  boulder: "prototype-golden-field-boulder-v1",
  tower: "prototype-golden-defense-tower-v1",
} as const;

type GoldenPose = "idle" | "walk-a" | "walk-b" | "attack";

const GOLDEN_POSE_TEXTURES: Record<GoldenPose, string> = {
  idle: GOLDEN_ASSETS.idle,
  "walk-a": GOLDEN_ASSETS.walkA,
  "walk-b": GOLDEN_ASSETS.walkB,
  attack: GOLDEN_ASSETS.attack,
};

interface GoldenReferenceDebug {
  ready: boolean;
  projection: string;
  terrainMasks: number[];
  uniqueTerrainStates: number[];
  assets: string[];
  camera: { width: number; height: number; focus: string };
  animationProbe: {
    enabled: boolean;
    currentPose: GoldenPose | null;
    currentTexture: string | null;
    interpolation: "none-atomic-texture-swap";
  };
}

function seededNoise(x: number, y: number, salt: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 31.37) * 43758.5453;
  return value - Math.floor(value);
}

export class GoldenReferenceScene extends Phaser.Scene {
  constructor() {
    super("golden-reference");
  }

  preload(): void {
    Object.values(GOLDEN_ASSETS).forEach((key) => {
      this.load.image(key, `${ASSET_ROOT}/${key}.png`);
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#11170f");
    this.createTerrainTextures();
    this.drawTerrainBoard();
    this.drawGoldenObjects();
    this.drawLabels();
    const debug: GoldenReferenceDebug = {
      ready: true,
      projection: "terrain:orthographic-top-down; objects:weak-three-quarter-top-down",
      terrainMasks: GOLDEN_TERRAIN_MASKS.flat(),
      uniqueTerrainStates: [...new Set(GOLDEN_TERRAIN_MASKS.flat())].sort((a, b) => a - b),
      assets: Object.values(GOLDEN_ASSETS),
      camera: { width: 1600, height: 900, focus: "central-structure" },
      animationProbe: {
        enabled: false,
        currentPose: null,
        currentTexture: null,
        interpolation: "none-atomic-texture-swap",
      },
    };
    (window as unknown as { __goldenReferenceDebug: GoldenReferenceDebug }).__goldenReferenceDebug = debug;
    if (new URLSearchParams(window.location.search).get("sequence") === "1") {
      this.createAnimationProbe(debug);
    }
  }

  private createTerrainTextures(): void {
    for (let mask = 0; mask < 16; mask += 1) {
      const key = `golden-terrain-${mask}`;
      if (this.textures.exists(key)) continue;
      const texture = this.textures.createCanvas(key, GOLDEN_TERRAIN_TILE_SIZE, GOLDEN_TERRAIN_TILE_SIZE);
      if (!texture) continue;
      const context = texture.context;
      context.fillStyle = "#526238";
      context.fillRect(0, 0, GOLDEN_TERRAIN_TILE_SIZE, GOLDEN_TERRAIN_TILE_SIZE);
      for (let y = 2; y < GOLDEN_TERRAIN_TILE_SIZE; y += 4) {
        for (let x = 2; x < GOLDEN_TERRAIN_TILE_SIZE; x += 4) {
          const noise = seededNoise(x, y, 1);
          context.fillStyle = noise > 0.62 ? "rgba(111,124,68,0.38)" : "rgba(48,65,35,0.22)";
          context.fillRect(x, y, 2, 2);
        }
      }
      context.fillStyle = "#715337";
      for (const polygon of getMarchingPolygons(mask, GOLDEN_TERRAIN_TILE_SIZE)) {
        context.beginPath();
        polygon.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
        context.closePath();
        context.fill();
      }
      context.globalAlpha = 0.36;
      context.fillStyle = "#a48254";
      for (let y = 3; y < GOLDEN_TERRAIN_TILE_SIZE; y += 7) {
        for (let x = 3; x < GOLDEN_TERRAIN_TILE_SIZE; x += 7) {
          if (seededNoise(x, y, mask + 7) > 0.58) context.fillRect(x, y, 2, 1);
        }
      }
      context.globalAlpha = 1;
      texture.refresh();
    }
  }

  private drawTerrainBoard(): void {
    const shadow = this.add.rectangle(800, 466, 1056, 672, 0x020402, 0.5).setDepth(-10);
    shadow.setStrokeStyle(2, 0x9b7b46, 0.34);
    GOLDEN_TERRAIN_MASKS.forEach((row, rowIndex) => {
      row.forEach((mask, columnIndex) => {
        this.add.image(
          BOARD_X + columnIndex * GOLDEN_TERRAIN_TILE_SIZE + GOLDEN_TERRAIN_TILE_SIZE / 2,
          BOARD_Y + rowIndex * GOLDEN_TERRAIN_TILE_SIZE + GOLDEN_TERRAIN_TILE_SIZE / 2,
          `golden-terrain-${mask}`,
        ).setDepth(0);
      });
    });
    this.drawSmoothedDirtPath();

    const plaza = this.add.graphics().setDepth(2);
    plaza.fillStyle(0x5c5e55, 1);
    plaza.fillCircle(928, 450, 106);
    plaza.lineStyle(7, 0x343b35, 0.9);
    plaza.strokeCircle(928, 450, 106);
    plaza.lineStyle(3, 0x8d8268, 0.72);
    plaza.strokeCircle(928, 450, 82);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      plaza.lineBetween(928 + Math.cos(angle) * 82, 450 + Math.sin(angle) * 82, 928 + Math.cos(angle) * 104, 450 + Math.sin(angle) * 104);
    }

    const legendY = 812;
    for (let mask = 0; mask < 16; mask += 1) {
      this.add.image(416 + mask * 48, legendY, `golden-terrain-${mask}`)
        .setDisplaySize(44, 44)
        .setDepth(50);
      this.add.text(416 + mask * 48, legendY + 28, mask.toString(16).toUpperCase(), {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#d6c7a2",
      }).setOrigin(0.5).setDepth(51);
    }
  }

  private drawSmoothedDirtPath(): void {
    const toPoint = (column: number, row: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(
      BOARD_X + column * GOLDEN_TERRAIN_TILE_SIZE,
      BOARD_Y + row * GOLDEN_TERRAIN_TILE_SIZE,
    );
    const curve = new Phaser.Curves.CubicBezier(
      toPoint(-0.5, GOLDEN_PATH_CONTROL_ROWS[0]),
      toPoint(GOLDEN_TERRAIN_COLUMNS * 0.34, GOLDEN_PATH_CONTROL_ROWS[1]),
      toPoint(GOLDEN_TERRAIN_COLUMNS * 0.66, GOLDEN_PATH_CONTROL_ROWS[2]),
      toPoint(GOLDEN_TERRAIN_COLUMNS + 0.5, GOLDEN_PATH_CONTROL_ROWS[3]),
    );
    const fullWidth = GOLDEN_PATH_HALF_WIDTH_ROWS * GOLDEN_TERRAIN_TILE_SIZE * 2;
    const path = this.add.graphics().setDepth(1);
    const clipShape = this.make.graphics({ x: 0, y: 0 });
    clipShape.fillStyle(0xffffff).fillRect(
      BOARD_X,
      BOARD_Y,
      GOLDEN_TERRAIN_COLUMNS * GOLDEN_TERRAIN_TILE_SIZE,
      GOLDEN_TERRAIN_MASKS.length * GOLDEN_TERRAIN_TILE_SIZE,
    );
    path.setMask(clipShape.createGeometryMask());
    path.lineStyle(fullWidth + 18, 0x493a2a, 0.28);
    curve.draw(path, 96);
    path.lineStyle(fullWidth - 14, 0x715337, 0.76);
    curve.draw(path, 96);
    path.lineStyle(fullWidth - 38, 0x94704a, 0.16);
    curve.draw(path, 96);
  }

  private addGroundedAsset(
    key: string,
    x: number,
    y: number,
    displayWidth: number,
    displayHeight: number,
    originX: number,
    originY: number,
    shadowWidth: number,
  ): Phaser.GameObjects.Image {
    this.add.ellipse(x + 7, y + 5, shadowWidth, Math.max(14, shadowWidth * 0.22), 0x11100c, 0.46)
      .setRotation(0.18)
      .setDepth(y - 1);
    return this.add.image(x, y, key)
      .setOrigin(originX, originY)
      .setDisplaySize(displayWidth, displayHeight)
      .setDepth(y);
  }

  private drawGoldenObjects(): void {
    this.addGroundedAsset(GOLDEN_ASSETS.boulder, 475, 315, 150, 150, 0.5, 224 / 256, 118);
    this.addGroundedAsset(GOLDEN_ASSETS.tower, 928, 450, 300, 300, 0.5, 448 / 512, 206);

    const poses = [
      { key: GOLDEN_ASSETS.idle, x: 590, y: 625, width: 150, label: "IDLE" },
      { key: GOLDEN_ASSETS.walkA, x: 730, y: 565, width: 150, label: "WALK A" },
      { key: GOLDEN_ASSETS.walkB, x: 1090, y: 330, width: 150, label: "WALK B" },
      { key: GOLDEN_ASSETS.attack, x: 1215, y: 270, width: 200, label: "ATTACK" },
    ];
    poses.forEach((pose) => {
      const isWide = pose.key === GOLDEN_ASSETS.attack;
      this.addGroundedAsset(
        pose.key,
        pose.x,
        pose.y,
        pose.width,
        150,
        0.5,
        336 / 384,
        86,
      );
      this.add.text(pose.x, pose.y + 20, pose.label, {
        fontFamily: "Georgia, serif",
        fontSize: "13px",
        color: "#f2dfad",
        backgroundColor: "rgba(14,18,13,0.76)",
        padding: { x: 5, y: 2 },
      }).setOrigin(0.5, 0).setDepth(pose.y + 10);
      if (isWide) this.add.text(pose.x, pose.y + 42, "512 x 384 wide pose", {
        fontFamily: "monospace", fontSize: "10px", color: "#b9aa84",
      }).setOrigin(0.5).setDepth(pose.y + 11);
    });
  }

  private drawLabels(): void {
    this.add.rectangle(800, 54, 1120, 76, 0x0b100d, 0.92).setStrokeStyle(2, 0xa98545, 0.7).setDepth(1000);
    this.add.text(800, 36, "WARCREST GOLDEN REFERENCE", {
      fontFamily: "Georgia, serif", fontSize: "25px", color: "#f0d89b",
    }).setOrigin(0.5).setDepth(1001);
    this.add.text(800, 68, "orthographic terrain + weak 3/4 top-down assets | upper-left key light | prototype only", {
      fontFamily: "monospace", fontSize: "12px", color: "#bac6ad",
    }).setOrigin(0.5).setDepth(1001);
    this.add.text(300, 790, "16-STATE DIRT OVERLAY FAMILY", {
      fontFamily: "Georgia, serif", fontSize: "14px", color: "#e5d4ac",
    }).setDepth(1001);
  }

  private createAnimationProbe(debug: GoldenReferenceDebug): void {
    const centerX = 800;
    const groundY = 660;
    this.add.rectangle(centerX, 450, 560, 610, 0x080c09, 0.94)
      .setStrokeStyle(3, 0xd0a85b, 0.9)
      .setDepth(2000);
    this.add.text(centerX, 174, "ATOMIC POSE TRANSITION PROBE", {
      fontFamily: "Georgia, serif",
      fontSize: "22px",
      color: "#f0d89b",
    }).setOrigin(0.5).setDepth(2001);
    this.add.text(centerX, 205, "idle -> walk-a -> walk-b -> attack -> idle | no tween / no blend", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#bac6ad",
    }).setOrigin(0.5).setDepth(2001);
    this.add.ellipse(centerX + 10, groundY + 8, 170, 34, 0x11100c, 0.5)
      .setRotation(0.18)
      .setDepth(2001);
    const sprite = this.add.image(centerX, groundY, GOLDEN_ASSETS.idle)
      .setOrigin(0.5, 336 / 384)
      .setDisplaySize(260, 260)
      .setDepth(2002);
    const label = this.add.text(centerX, 730, "IDLE", {
      fontFamily: "Georgia, serif",
      fontSize: "20px",
      color: "#f2dfad",
      backgroundColor: "rgba(14,18,13,0.84)",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(2003);

    const setPose = (pose: GoldenPose): void => {
      const texture = GOLDEN_POSE_TEXTURES[pose];
      sprite.setTexture(texture).setDisplaySize(pose === "attack" ? 347 : 260, 260);
      label.setText(pose.toUpperCase());
      debug.animationProbe.enabled = true;
      debug.animationProbe.currentPose = pose;
      debug.animationProbe.currentTexture = texture;
    };
    setPose("idle");
    (window as unknown as {
      __goldenReferenceControl: { setPose: (pose: GoldenPose) => void };
    }).__goldenReferenceControl = { setPose };
  }
}
