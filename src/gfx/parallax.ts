import Phaser from "phaser";

export function makeStripeTexture(
  scene: Phaser.Scene,
  key: string,
  colorA: number,
  colorB: number
): string {
  if (scene.textures.exists(key)) return key;
  const w = 64;
  const h = 64;
  const g = scene.add.graphics();
  g.fillStyle(colorA, 1);
  g.fillRect(0, 0, w, h);
  g.fillStyle(colorB, 1);
  g.fillRect(0, 0, w / 2, h);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

export interface ParallaxBackground {
  far: Phaser.GameObjects.TileSprite;
  near: Phaser.GameObjects.TileSprite;
  update(farSpeed?: number, nearSpeed?: number): void;
}

/** Two-layer parallax strip, reused by every scene that wants the same backdrop. */
export function createParallaxBackground(scene: Phaser.Scene): ParallaxBackground {
  const { width, height } = scene.scale;
  const farTex = makeStripeTexture(scene, "far-stripe", 0x1c2440, 0x141a30);
  const nearTex = makeStripeTexture(scene, "near-stripe", 0x2c3a63, 0x24304f);

  const far = scene.add.tileSprite(0, 0, width, height, farTex).setOrigin(0, 0);
  const near = scene.add.tileSprite(0, height - 120, width, 120, nearTex).setOrigin(0, 0);

  return {
    far,
    near,
    update(farSpeed = 0.2, nearSpeed = 0.8) {
      far.tilePositionX += farSpeed;
      near.tilePositionX += nearSpeed;
    },
  };
}
