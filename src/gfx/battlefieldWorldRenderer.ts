import Phaser from "phaser";
import type {
  BattlefieldMapSpec,
  StructureSocketSpec,
  TerrainMaterial,
  TerrainPatchSpec,
} from "../data/battlefieldMaps";
import type { StructureGroundPresentation } from "./battlefieldPrototypeRenderer";

const SURFACE_DEPTH = 2;
const PROP_SHADOW_COLOR = 0x172018;

type VisibleGameObject = Phaser.GameObjects.GameObject & {
  setVisible(visible: boolean): Phaser.GameObjects.GameObject;
};

const TEXTURES: Record<TerrainMaterial, string> = {
  grass: "prototype-placeholder-grass",
  dirt: "prototype-placeholder-dirt",
  stone: "prototype-placeholder-stone",
};

const TINTS: Record<TerrainMaterial, number> = {
  grass: 0xa6b083,
  dirt: 0xa18c6f,
  stone: 0xaaa998,
};

/**
 * Opaque playable-world renderer. Unlike the prototype decal renderer, this
 * owns every visible ground pixel and never relies on the baked battlefield
 * matte for road, grass, props, or depth cues.
 */
export class BattlefieldWorldRenderer {
  private readonly objects: VisibleGameObject[] = [];
  private readonly socketPresentations = new Map<string, StructureGroundPresentation>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapSpec: BattlefieldMapSpec,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly groundDepth: (groundY: number, offset?: number) => number,
  ) {}

  create(): void {
    this.createOpaqueGroundChunks();
    this.mapSpec.terrainPatches.forEach((patch) => this.createLaneSurface(patch));
    this.mapSpec.structureSockets.forEach((socket) => this.createStructureGround(socket));
    this.mapSpec.terrainProps.forEach((prop) => {
      const shadow = this.scene.add.ellipse(
        prop.position.x + 18,
        prop.position.y + 10,
        prop.footprint.width * 1.08,
        prop.footprint.height * 0.72,
        PROP_SHADOW_COLOR,
        0.38,
      ).setRotation(-0.22).setDepth(this.groundDepth(prop.position.y, -2));
      const image = this.scene.add.image(prop.position.x, prop.position.y, prop.textureKey)
        .setDisplaySize(prop.displayWidth, prop.displayHeight)
        .setOrigin(0.5, prop.groundOriginY)
        .setTint(0xd5d5bd)
        .setDepth(this.groundDepth(prop.position.y));
      this.objects.push(shadow, image);
    });
  }

  setEnabled(enabled: boolean): void {
    this.objects.forEach((object) => object.setVisible(enabled));
  }

  getSocketPresentation(socketId: string): StructureGroundPresentation | undefined {
    return this.socketPresentations.get(socketId);
  }

  private createOpaqueGroundChunks(): void {
    const chunkSize = 1024;
    const columns = Math.ceil(this.worldWidth / chunkSize);
    const rows = Math.ceil(this.worldHeight / chunkSize);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const width = Math.min(chunkSize, this.worldWidth - column * chunkSize);
        const height = Math.min(chunkSize, this.worldHeight - row * chunkSize);
        const chunk = this.scene.add.tileSprite(
          column * chunkSize + width / 2,
          row * chunkSize + height / 2,
          width,
          height,
          TEXTURES.grass,
        )
          .setTilePosition(column * 311 + row * 97, row * 277 + column * 53)
          .setTileScale(0.58 + ((column + row) % 3) * 0.025)
          .setTint(TINTS.grass)
          .setDepth(SURFACE_DEPTH);
        this.objects.push(chunk);
      }
    }
  }

  private createLaneSurface(patch: TerrainPatchSpec): void {
    const length = patch.columns * patch.cellWidth + 36;
    const dirtWidth = patch.cellHeight * 6.2;
    const stoneWidth = patch.cellHeight * 3.15;
    this.createRoundedBand(patch, "dirt", length, dirtWidth, SURFACE_DEPTH + 2, 104);
    this.createRoundedBand(patch, "stone", length, stoneWidth, SURFACE_DEPTH + 3, 48);
  }

  private createRoundedBand(
    patch: TerrainPatchSpec,
    material: TerrainMaterial,
    width: number,
    height: number,
    depth: number,
    radius: number,
  ): void {
    const tile = this.scene.add.tileSprite(patch.center.x, patch.center.y, width, height, TEXTURES[material])
      .setRotation(patch.rotationRad)
      .setTilePosition(patch.center.x * 0.13, patch.center.y * 0.11)
      .setTileScale(material === "stone" ? 0.38 : 0.5)
      .setTint(TINTS[material])
      .setDepth(depth);
    const maskShape = this.scene.make.graphics({ x: patch.center.x, y: patch.center.y }, false)
      .setRotation(patch.rotationRad);
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRoundedRect(-width / 2, -height / 2, width, height, Math.min(radius, height / 2));
    tile.setMask(maskShape.createGeometryMask());
    this.objects.push(tile);
  }

  private createStructureGround(socket: StructureSocketSpec): void {
    const { x, y } = socket.position;
    const { width, height } = socket.footprint;
    const dirt = this.scene.add.ellipse(x, y + 4, width + 96, height + 54, 0x6e5d42, 1)
      .setDepth(SURFACE_DEPTH + 4);
    const foundation = this.scene.add.ellipse(x, y, width + 34, height + 22, 0x77766c, 1)
      .setStrokeStyle(5, 0x3d4543, 1)
      .setDepth(SURFACE_DEPTH + 5);
    const top = this.scene.add.ellipse(x - 2, y - 4, width - 6, height - 4, 0xaaa693, 1)
      .setStrokeStyle(2, 0xc9c2a8, 0.9)
      .setDepth(SURFACE_DEPTH + 6);
    const shadow = this.scene.add.ellipse(x + 22, y + 13, width + 24, height * 0.7, 0x111918, 0.42)
      .setRotation(-0.24)
      .setDepth(this.groundDepth(y, -2));
    const foundationObjects = [dirt, foundation, top];
    this.objects.push(...foundationObjects, shadow);
    this.socketPresentations.set(socket.id, { foundation: foundationObjects, shadow });
  }
}
