import Phaser from "phaser";
import type {
  BattlefieldMapSpec,
  StructureSocketSpec,
  TerrainMaterial,
  TerrainPatchSpec,
} from "../data/battlefieldMaps";
import type { StructureGroundPresentation } from "./battlefieldPrototypeRenderer";
import {
  getPatchMaterialMask,
  getProductionTerrainBaseKey,
  getProductionTerrainTextureKey,
  includesDirtShoulder,
  includesRoad,
  type ProductionTerrainMaterial,
} from "../presentation/terrain/productionTerrainRegistry";

const SURFACE_DEPTH = 2;
const PROP_SHADOW_COLOR = 0x172018;
const DIRT_BLEND_COLOR = 0x6d6047;
const DIRT_OUTER_BLEND_COLOR = 0x69744d;
const ROAD_DUST_COLOR = 0x8f846e;

type VisibleGameObject = Phaser.GameObjects.GameObject & {
  setVisible(visible: boolean): Phaser.GameObjects.GameObject;
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
        prop.position.x + prop.shadow.offsetX,
        prop.position.y + prop.shadow.offsetY,
        prop.footprint.width * prop.shadow.widthScale,
        prop.footprint.height * prop.shadow.heightScale,
        PROP_SHADOW_COLOR,
        prop.shadow.alpha,
      ).setRotation(prop.shadow.rotationRad).setDepth(this.groundDepth(prop.position.y, -2));
      const image = this.scene.add.image(prop.position.x, prop.position.y, prop.textureKey)
        .setDisplaySize(prop.displayWidth, prop.displayHeight)
        .setOrigin(0.5, prop.groundOriginY)
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
          getProductionTerrainBaseKey("grass"),
        )
          .setTilePosition(column * chunkSize, row * chunkSize)
          .setDepth(SURFACE_DEPTH);
        this.objects.push(chunk);
      }
    }
  }

  private createLaneSurface(patch: TerrainPatchSpec): void {
    this.createPatchBoundaryBlend(patch);
    this.createMaterialLayer(patch, "dirt", includesDirtShoulder, SURFACE_DEPTH + 2);
    this.createRoadShoulderBlend(patch);
    this.createMaterialLayer(patch, "road", includesRoad, SURFACE_DEPTH + 3);
  }

  private createPatchBoundaryBlend(patch: TerrainPatchSpec): void {
    const patchWidth = patch.columns * patch.cellWidth;
    const dirtHeight = patch.cellHeight * Math.max(4.2, patch.rows - 2.2);
    const outer = this.scene.add.graphics()
      .setPosition(patch.center.x, patch.center.y)
      .setRotation(patch.rotationRad)
      .setDepth(SURFACE_DEPTH + 1);
    outer.fillStyle(DIRT_OUTER_BLEND_COLOR, 0.17);
    outer.fillRoundedRect(
      -patchWidth / 2 - 52,
      -dirtHeight / 2 - 34,
      patchWidth + 104,
      dirtHeight + 68,
      112,
    );

    const inner = this.scene.add.graphics()
      .setPosition(patch.center.x, patch.center.y)
      .setRotation(patch.rotationRad)
      .setDepth(SURFACE_DEPTH + 1.5);
    inner.fillStyle(DIRT_BLEND_COLOR, 0.18);
    inner.fillRoundedRect(
      -patchWidth / 2 - 22,
      -dirtHeight / 2 - 16,
      patchWidth + 44,
      dirtHeight + 32,
      92,
    );
    this.objects.push(outer, inner);
  }

  private createRoadShoulderBlend(patch: TerrainPatchSpec): void {
    const patchWidth = patch.columns * patch.cellWidth;
    const roadHeight = patch.cellHeight * 3.1;
    const dust = this.scene.add.graphics()
      .setPosition(patch.center.x, patch.center.y)
      .setRotation(patch.rotationRad)
      .setDepth(SURFACE_DEPTH + 2.5);
    dust.fillStyle(ROAD_DUST_COLOR, 0.12);
    dust.fillRoundedRect(
      -patchWidth / 2 - 8,
      -roadHeight / 2 - 14,
      patchWidth + 16,
      roadHeight + 28,
      72,
    );
    this.objects.push(dust);
  }

  private createMaterialLayer(
    patch: TerrainPatchSpec,
    material: ProductionTerrainMaterial,
    includesMaterial: (material: TerrainMaterial) => boolean,
    depth: number,
  ): void {
    const cos = Math.cos(patch.rotationRad);
    const sin = Math.sin(patch.rotationRad);
    for (let row = 0; row < patch.rows; row += 1) {
      for (let column = 0; column < patch.columns; column += 1) {
        const mask = getPatchMaterialMask(patch, column, row, includesMaterial);
        const textureKey = getProductionTerrainTextureKey(material, mask);
        if (!textureKey) continue;
        const localX = (column - (patch.columns - 1) / 2) * patch.cellWidth;
        const localY = (row - (patch.rows - 1) / 2) * patch.cellHeight;
        const tile = this.scene.add.image(
          patch.center.x + localX * cos - localY * sin,
          patch.center.y + localX * sin + localY * cos,
          textureKey,
        )
          .setDisplaySize(patch.cellWidth + 1, patch.cellHeight + 1)
          .setRotation(patch.rotationRad)
          .setDepth(depth);
        this.objects.push(tile);
      }
    }
  }

  private createStructureGround(socket: StructureSocketSpec): void {
    const { x, y } = socket.position;
    const { width, height } = socket.footprint;
    const dirt = this.scene.add.image(x, y + 4, getProductionTerrainBaseKey("stone"))
      .setDisplaySize(width + 96, height + 54)
      .setDepth(SURFACE_DEPTH + 4);
    const dirtMask = this.scene.make.graphics({ x, y: y + 4 }, false);
    dirtMask.fillStyle(0xffffff, 1);
    dirtMask.fillEllipse(0, 0, width + 96, height + 54);
    dirt.setMask(dirtMask.createGeometryMask());
    const foundation = this.scene.add.ellipse(x, y, width + 34, height + 22, 0x77766c, 1)
      .setStrokeStyle(5, 0x3d4543, 1)
      .setDepth(SURFACE_DEPTH + 5);
    const top = this.scene.add.ellipse(x - 2, y - 4, width - 6, height - 4, 0xaaa693, 1)
      .setStrokeStyle(2, 0xc9c2a8, 0.9)
      .setDepth(SURFACE_DEPTH + 6);
    const shadow = this.scene.add.ellipse(x + 6, y + 2, width * 0.9, height * 0.54, 0x111918, 0.34)
      .setRotation(-0.08)
      .setDepth(this.groundDepth(y, -2));
    const foundationObjects = [dirt, foundation, top];
    this.objects.push(...foundationObjects, shadow);
    this.socketPresentations.set(socket.id, { foundation: foundationObjects, shadow });
  }
}
