import Phaser from "phaser";
import { createParallaxBackground, type ParallaxBackground } from "../gfx/parallax";
import { drawChibiTexture } from "../gfx/chibi";
import { UNIT_TYPES } from "../data/unitTypes";

/** Title screen: parallax backdrop, a small preview squad, start prompt. */
export class BootScene extends Phaser.Scene {
  private bg!: ParallaxBackground;

  constructor() {
    super("boot");
  }

  create(): void {
    const { width, height } = this.scale;
    this.bg = createParallaxBackground(this);

    const soldierTex = drawChibiTexture(this, "chibi-soldier", UNIT_TYPES[0].palette);
    const baseY = height - 90;
    for (let i = 0; i < 3; i++) {
      this.add.image(120 + i * 34, baseY, soldierTex).setOrigin(0.5, 1);
    }

    this.add
      .text(width / 2, 60, "갈림길 정찰대", {
        fontFamily: "sans-serif",
        fontSize: "32px",
        color: "#f2f2f2",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 104, "(가제 · 프로토타입)", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#9aa0b4",
      })
      .setOrigin(0.5, 0);

    const prompt = this.add
      .text(width / 2, height / 2 + 40, "스페이스바 또는 클릭으로 시작", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#f2c14e",
      })
      .setOrigin(0.5, 0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.input.keyboard?.once("keydown-SPACE", () => this.scene.start("run"));
    this.input.once("pointerdown", () => this.scene.start("run"));
  }

  update(): void {
    this.bg.update();
  }
}
