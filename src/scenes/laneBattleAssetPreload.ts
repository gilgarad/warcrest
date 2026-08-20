import Phaser from "phaser";
import type { TerrainRenderMode } from "../config/prototypeVisualConfig";
import { assetUrl } from "../config/assetUrl";
import { PROTOTYPE_TERRAIN_ASSETS } from "../gfx/battlefieldPrototypeRenderer";
import { PRODUCTION_PROP_ASSETS } from "../presentation/terrain/productionPropRegistry";
import { getProductionTerrainBaseKey, PRODUCTION_TERRAIN_ASSETS } from "../presentation/terrain/productionTerrainRegistry";
import { PRODUCTION_STRUCTURE_ASSETS } from "../presentation/structures/productionStructureRegistry";
import { UI_CHROME_ASSETS } from "../presentation/ui/uiChromeRegistry";
import { UNIT_ANIMATION_ASSETS } from "../presentation/units/unitAnimationRegistry";

const COMMON_IMAGE_ASSETS = [
  { key: "lane-battlefield-bg", path: assetUrl("assets/battle/lane-battlefield-object-base-v4.png") },
  { key: "lane-battlefield-bg-v2", path: assetUrl("assets/battle/lane-battlefield-object-base-v4-prototype-v2.png") },
  { key: "war-table-hud", path: assetUrl("assets/battle/war-table-hud.png") },
];

function queueImage(scene: Phaser.Scene, key: string, path: string): number {
  if (scene.textures.exists(key)) return 0;
  scene.load.image(key, path);
  return 1;
}

export function queueLaneBattleAssets(scene: Phaser.Scene, terrainMode: TerrainRenderMode): number {
  let queued = 0;
  COMMON_IMAGE_ASSETS.forEach((asset) => {
    queued += queueImage(scene, asset.key, asset.path);
  });
  UNIT_ANIMATION_ASSETS.forEach((asset) => {
    queued += queueImage(scene, asset.key, asset.path);
  });
  PRODUCTION_STRUCTURE_ASSETS.forEach((asset) => {
    queued += queueImage(scene, asset.key, asset.path);
  });
  PRODUCTION_PROP_ASSETS.forEach((asset) => {
    queued += queueImage(scene, asset.key, asset.path);
  });

  UI_CHROME_ASSETS.forEach((asset) => {
    queued += queueImage(scene, asset.key, asset.path);
  });

  if (terrainMode === "world-surface") {
    PRODUCTION_TERRAIN_ASSETS.forEach((asset) => {
      queued += queueImage(scene, asset.key, asset.path);
    });
  } else {
    PROTOTYPE_TERRAIN_ASSETS.forEach((asset) => {
      queued += queueImage(scene, asset.key, asset.path);
    });
  }

  return queued;
}

export function areLaneBattleAssetsReady(scene: Phaser.Scene, terrainMode: TerrainRenderMode): boolean {
  if (!scene.textures.exists("lane-battlefield-bg-v2")) return false;
  if (!scene.textures.exists("war-table-hud")) return false;
  if (!scene.textures.exists("stone-slinger-w-idle")) return false;
  if (!scene.textures.exists("main-base")) return false;
  if (!scene.textures.exists("rock-cluster")) return false;
  return terrainMode === "world-surface"
    ? scene.textures.exists(getProductionTerrainBaseKey("grass"))
    : scene.textures.exists(PROTOTYPE_TERRAIN_ASSETS[0].key);
}
