import Phaser from "phaser";

/**
 * Placeholder scene to prove the render/update pipeline works before any
 * real art or mechanics exist. See docs/dev-wiki/game-concept.md for the
 * intended core loop this will grow into.
 */
export class BootScene extends Phaser.Scene {
  private soldier!: Phaser.GameObjects.Rectangle;
  private farLayer!: Phaser.GameObjects.TileSprite;
  private nearLayer!: Phaser.GameObjects.TileSprite;

  constructor() {
    super("boot");
  }

  create(): void {
    const { width, height } = this.scale;

    const farTexture = this.makeStripeTexture("far-stripe", 0x1c2440, 0x141a30);
    const nearTexture = this.makeStripeTexture("near-stripe", 0x2c3a63, 0x24304f);

    this.farLayer = this.add.tileSprite(0, 0, width, height, farTexture).setOrigin(0, 0);
    this.nearLayer = this.add.tileSprite(0, height - 120, width, 120, nearTexture).setOrigin(0, 0);

    this.soldier = this.add.rectangle(80, height - 160, 24, 40, 0xf2c14e);

    this.add
      .text(width / 2, 40, "갈림길 정찰대 (프로토타입)", {
        fontFamily: "sans-serif",
        fontSize: "22px",
        color: "#f2f2f2",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, height - 24, "렌더/업데이트 파이프라인 확인용 placeholder — 실제 아트/전투 없음", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#9aa0b4",
      })
      .setOrigin(0.5, 1);
  }

  update(): void {
    this.farLayer.tilePositionX += 0.2;
    this.nearLayer.tilePositionX += 0.8;
    this.soldier.x += 0.6;
    if (this.soldier.x > this.scale.width - 40) {
      this.soldier.x = 40;
    }
  }

  private makeStripeTexture(key: string, colorA: number, colorB: number): string {
    const g = this.add.graphics();
    const w = 64;
    const h = 64;
    g.fillStyle(colorA, 1);
    g.fillRect(0, 0, w, h);
    g.fillStyle(colorB, 1);
    g.fillRect(0, 0, w / 2, h);
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }
}
