import Phaser from "phaser";
import type {
  BattlefieldMapSpec,
  StructureSocketSpec,
  TerrainMaterial,
  TerrainPatchSpec,
} from "../data/battlefieldMaps";
import type { PrototypeVisualConfig } from "../config/prototypeVisualConfig";

const TERRAIN_DEPTH = 24;

type VisibleGameObject = Phaser.GameObjects.GameObject & {
  setVisible(visible: boolean): Phaser.GameObjects.GameObject;
};

const TERRAIN_TEXTURES: Record<TerrainMaterial, string> = {
  grass: "prototype-placeholder-grass",
  dirt: "prototype-placeholder-dirt",
  stone: "prototype-placeholder-stone",
};

const TERRAIN_ALPHA: Record<TerrainMaterial, number> = {
  grass: 0.1,
  dirt: 0.2,
  stone: 0.32,
};

const TERRAIN_TINT: Record<TerrainMaterial, number> = {
  grass: 0xa2a479,
  dirt: 0x9a8568,
  stone: 0xa9a590,
};

export const PROTOTYPE_TERRAIN_ASSETS = [
  {
    key: TERRAIN_TEXTURES.grass,
    path: "/assets/prototype-terrain/prototype-placeholder-grass-v1.png",
  },
  {
    key: TERRAIN_TEXTURES.dirt,
    path: "/assets/prototype-terrain/prototype-placeholder-dirt-v1.png",
  },
  {
    key: TERRAIN_TEXTURES.stone,
    path: "/assets/prototype-terrain/prototype-placeholder-stone-v1.png",
  },
] as const;

export interface StructureGroundPresentation {
  foundation: Phaser.GameObjects.GameObject[];
  shadow: Phaser.GameObjects.Ellipse;
}

export type BattlefieldPrototypeVariant = "v1" | "v2";

export class BattlefieldPrototypeRenderer {
  private readonly objects: VisibleGameObject[] = [];
  private readonly socketPresentations = new Map<string, StructureGroundPresentation>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapSpec: BattlefieldMapSpec,
    private readonly groundDepth: (groundY: number, offset?: number) => number,
    private readonly variant: BattlefieldPrototypeVariant = "v1",
    private readonly visualConfig?: PrototypeVisualConfig,
  ) {}

  create(): void {
    this.mapSpec.terrainPatches.forEach((patch) => {
      if (this.variant === "v2") {
        this.createTerrainPatchV2(patch);
      } else {
        this.createTerrainPatch(patch);
      }
    });
    this.mapSpec.structureSockets.forEach((socket) => {
      if (this.variant === "v2") {
        this.createStructureGroundV2(socket);
      } else {
        this.createStructureGround(socket);
      }
    });
  }

  setEnabled(enabled: boolean): void {
    this.objects.forEach((object) => object.setVisible(enabled));
  }

  getSocketPresentation(socketId: string): StructureGroundPresentation | undefined {
    return this.socketPresentations.get(socketId);
  }

  private createTerrainPatch(patch: TerrainPatchSpec): void {
    const patchWidth = patch.columns * patch.cellWidth;
    const cos = Math.cos(patch.rotationRad);
    const sin = Math.sin(patch.rotationRad);
    const halfRows = (patch.rows - 1) / 2;
    const materialRows = Array.from({ length: patch.rows }, (_, row) => {
      const material = patch.cells.find((cell) => cell.row === row)?.material;
      if (!material) throw new Error(`Terrain patch ${patch.id} has no material for row ${row}`);
      return material;
    });
    const bands: Array<{ startRow: number; endRow: number; material: TerrainMaterial }> = [];

    materialRows.forEach((material, row) => {
      const current = bands[bands.length - 1];
      if (current?.material === material) {
        current.endRow = row;
      } else {
        bands.push({ startRow: row, endRow: row, material });
      }
    });

    bands.forEach((band, index) => {
      const rowCenter = (band.startRow + band.endRow) / 2;
      const across = (rowCenter - halfRows) * patch.cellHeight;
      const x = patch.center.x - across * sin;
      const y = patch.center.y + across * cos;
      const bandHeight = (band.endRow - band.startRow + 1) * patch.cellHeight + 8;
      const isOuterBand = band.startRow === 0 || band.endRow === patch.rows - 1;
      const tile = this.scene.add.tileSprite(
        x,
        y,
        patchWidth + 12,
        bandHeight,
        TERRAIN_TEXTURES[band.material],
      )
        .setRotation(patch.rotationRad)
        .setTilePosition(index * 181, index * 113)
        .setTileScale(0.48)
        .setTint(TERRAIN_TINT[band.material])
        .setAlpha(TERRAIN_ALPHA[band.material] * (isOuterBand ? 0.72 : 1))
        .setDepth(TERRAIN_DEPTH);
      const maskShape = this.scene.make.graphics({ x, y }, false)
        .setRotation(patch.rotationRad);
      maskShape.fillStyle(0xffffff, 1);
      maskShape.fillRoundedRect(
        -(patchWidth + 12) / 2,
        -bandHeight / 2,
        patchWidth + 12,
        bandHeight,
        Math.min(62, bandHeight * 0.42),
      );
      tile.setMask(maskShape.createGeometryMask());

      this.objects.push(tile);
    });
  }

  private createTerrainPatchV2(patch: TerrainPatchSpec): void {
    const config = this.visualConfig;
    if (!config) throw new Error("Prototype V2 requires a visual config");

    const alongScale = config.terrain.patchLength / 760;
    const acrossScale = config.terrain.patchWidth / 300;
    const transitionScale = config.terrain.transitionWidth / 110;
    const cos = Math.cos(patch.rotationRad);
    const sin = Math.sin(patch.rotationRad);
    const fixedDecals = [
      { along: -330, across: -126, width: 164, height: 66, material: "grass" as const, rotation: -0.08 },
      { along: -260, across: 116, width: 128, height: 52, material: "dirt" as const, rotation: 0.12 },
      { along: -188, across: -94, width: 108, height: 42, material: "dirt" as const, rotation: -0.14 },
      { along: -116, across: 82, width: 92, height: 36, material: "stone" as const, rotation: 0.08 },
      { along: -48, across: -72, width: 82, height: 32, material: "stone" as const, rotation: -0.18 },
      { along: 38, across: 68, width: 104, height: 36, material: "stone" as const, rotation: 0.15 },
      { along: 126, across: -88, width: 96, height: 38, material: "dirt" as const, rotation: -0.1 },
      { along: 196, across: 106, width: 132, height: 50, material: "dirt" as const, rotation: 0.17 },
      { along: 286, across: -118, width: 148, height: 58, material: "grass" as const, rotation: -0.05 },
      { along: 344, across: 92, width: 112, height: 44, material: "grass" as const, rotation: 0.13 },
      { along: -18, across: 126, width: 74, height: 30, material: "dirt" as const, rotation: -0.21 },
      { along: 76, across: -132, width: 68, height: 28, material: "grass" as const, rotation: 0.19 },
      { along: -348, across: 32, width: 70, height: 26, material: "stone" as const, rotation: 0.09 },
      { along: 356, across: -20, width: 76, height: 28, material: "stone" as const, rotation: -0.12 },
      { along: -228, across: 34, width: 56, height: 24, material: "stone" as const, rotation: 0.2 },
      { along: 242, across: -28, width: 62, height: 24, material: "stone" as const, rotation: -0.2 },
      { along: -92, across: 144, width: 84, height: 31, material: "grass" as const, rotation: 0.06 },
      { along: 154, across: -146, width: 88, height: 32, material: "grass" as const, rotation: -0.07 },
    ];

    fixedDecals.slice(0, config.terrain.breakupCount).forEach((decal, index) => {
      const along = decal.along * alongScale;
      const across = decal.across * acrossScale;
      const width = decal.width * transitionScale;
      const height = decal.height * transitionScale;
      const x = patch.center.x + along * cos - across * sin;
      const y = patch.center.y + along * sin + across * cos;
      const alpha = decal.material === "stone"
        ? config.terrain.breakupAlpha
        : config.terrain.transitionAlpha;
      const tile = this.scene.add.tileSprite(x, y, width, height, TERRAIN_TEXTURES[decal.material])
        .setRotation(patch.rotationRad + decal.rotation)
        .setTilePosition(index * 83, index * 57)
        .setTileScale(0.42 + (index % 3) * 0.04)
        .setTint(TERRAIN_TINT[decal.material])
        .setAlpha(alpha * (0.78 + (index % 4) * 0.07))
        .setFlipX(index % 2 === 1)
        .setFlipY(index % 3 === 1)
        .setDepth(TERRAIN_DEPTH);
      const maskShape = this.scene.make.graphics({ x, y }, false)
        .setRotation(patch.rotationRad + decal.rotation);
      maskShape.fillStyle(0xffffff, 1);
      maskShape.fillEllipse(0, 0, width, height);
      tile.setMask(maskShape.createGeometryMask());
      this.objects.push(tile);
    });
  }

  private createStructureGround(socket: StructureSocketSpec): void {
    const { x, y } = socket.position;
    const { width, height } = socket.footprint;
    const foundationDepth = TERRAIN_DEPTH + 4;

    const outerFoundation = this.scene.add.ellipse(x, y + 3, width + 42, height + 28, 0x3e4039, 0.92)
      .setStrokeStyle(5, 0x1f292a, 0.72)
      .setDepth(foundationDepth);
    const middleFoundation = this.scene.add.ellipse(x, y + 1, width + 18, height + 14, 0x8c8878, 0.96)
      .setStrokeStyle(4, 0xc3baa0, 0.62)
      .setDepth(foundationDepth + 0.1);
    const innerFoundation = this.scene.add.ellipse(x, y - 1, width - 18, height - 8, 0x65665d, 0.96)
      .setStrokeStyle(3, 0x2e3738, 0.78)
      .setDepth(foundationDepth + 0.2);

    const seam = this.scene.add.graphics().setDepth(foundationDepth + 0.3);
    seam.lineStyle(3, 0x303737, 0.42);
    seam.beginPath();
    seam.moveTo(x - width * 0.34, y - height * 0.2);
    seam.lineTo(x - width * 0.16, y + height * 0.28);
    seam.moveTo(x + width * 0.06, y - height * 0.3);
    seam.lineTo(x + width * 0.22, y + height * 0.26);
    seam.moveTo(x + width * 0.34, y - height * 0.15);
    seam.lineTo(x + width * 0.42, y + height * 0.12);
    seam.strokePath();

    const shadow = this.scene.add.ellipse(
      x + 20,
      y + 12,
      width + 22,
      height * 0.68,
      0x071016,
      0.34,
    )
      .setRotation(-0.24)
      .setDepth(this.groundDepth(y, -2));

    const foundation = [outerFoundation, middleFoundation, innerFoundation, seam];
    this.objects.push(...foundation, shadow);
    this.socketPresentations.set(socket.id, { foundation, shadow });
  }

  private createStructureGroundV2(socket: StructureSocketSpec): void {
    const config = this.visualConfig;
    if (!config) throw new Error("Prototype V2 requires a visual config");

    const x = socket.position.x + config.terrain.foundationOffsetX;
    const y = socket.position.y + config.terrain.foundationOffsetY;
    const scale = config.terrain.foundationScale;
    const width = socket.footprint.width * scale;
    const height = socket.footprint.height * scale;
    const foundationDepth = TERRAIN_DEPTH + 4;

    const wornGround = this.scene.add.graphics().setDepth(foundationDepth - 1);
    wornGround.fillStyle(0x574d36, config.terrain.transitionAlpha * 0.72);
    wornGround.fillEllipse(x - width * 0.16, y + height * 0.1, width * 1.48, height * 1.36);
    wornGround.fillStyle(0x75804f, config.terrain.transitionAlpha * 0.55);
    wornGround.fillEllipse(x + width * 0.48, y + height * 0.18, width * 0.58, height * 0.52);
    wornGround.fillEllipse(x - width * 0.54, y - height * 0.04, width * 0.48, height * 0.42);

    const contactAo = this.scene.add.ellipse(
      x + 3,
      y + height * 0.12,
      width + 26,
      height + 17,
      0x101514,
      config.terrain.contactAoAlpha,
    ).setDepth(foundationDepth);

    const foundation = this.scene.add.ellipse(
      x,
      y,
      width + 10,
      height + 5,
      0x716e62,
      config.terrain.foundationAlpha,
    )
      .setStrokeStyle(4, 0x343a38, 0.8)
      .setDepth(foundationDepth + 0.1);

    const foundationTop = this.scene.add.ellipse(
      x - 2,
      y - 3,
      width - 10,
      height - 12,
      0x8c8878,
      Math.min(1, config.terrain.foundationAlpha + 0.04),
    )
      .setStrokeStyle(2, 0xb8af97, 0.52)
      .setDepth(foundationDepth + 0.2);

    const fragments = this.scene.add.graphics().setDepth(foundationDepth + 0.3);
    fragments.fillStyle(0x55594f, 0.82);
    fragments.fillTriangle(x - width * 0.55, y + 5, x - width * 0.43, y - 7, x - width * 0.38, y + 9);
    fragments.fillTriangle(x + width * 0.44, y + 13, x + width * 0.56, y + 4, x + width * 0.58, y + 17);
    fragments.lineStyle(2, 0x373e3c, 0.62);
    fragments.beginPath();
    fragments.moveTo(x - width * 0.3, y - height * 0.12);
    fragments.lineTo(x - width * 0.12, y + height * 0.18);
    fragments.lineTo(x - width * 0.02, y + height * 0.03);
    fragments.moveTo(x + width * 0.16, y - height * 0.2);
    fragments.lineTo(x + width * 0.28, y + height * 0.14);
    fragments.strokePath();

    const shadow = this.scene.add.ellipse(
      x + config.terrain.towerShadowOffsetX,
      y + config.terrain.towerShadowOffsetY,
      width * config.terrain.towerShadowScaleX,
      height * config.terrain.towerShadowScaleY,
      0x071016,
      config.terrain.directionalShadowAlpha,
    )
      .setRotation(-0.24)
      .setDepth(this.groundDepth(y, -2));

    const foundationObjects = [wornGround, contactAo, foundation, foundationTop, fragments];
    this.objects.push(...foundationObjects, shadow);
    this.socketPresentations.set(socket.id, {
      foundation: foundationObjects,
      shadow,
    });
  }
}
