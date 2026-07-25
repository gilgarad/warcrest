import Phaser from "phaser";
import { createParallaxBackground, type ParallaxBackground } from "../gfx/parallax";

/** Title screen: parallax backdrop, a small preview squad, start prompt. */
export class BootScene extends Phaser.Scene {
  private bg!: ParallaxBackground;

  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.image("title-splash-dungeon", "/assets/title-splash-dungeon.png");
    this.load.image("leader-sprite", "/assets/characters/leader.png");
    this.load.image("soldier-sprite", "/assets/characters/soldier.png");
  }

  create(): void {
    const { width, height } = this.scale;
    this.bg = createParallaxBackground(this);
    this.bg.far.setAlpha(0.18);
    this.bg.near.setAlpha(0.2);
    this.add.image(width / 2, height / 2, "title-splash-dungeon").setDisplaySize(width, height);
    this.cameras.main.fadeIn(300, 8, 10, 18);

    this.add.rectangle(width / 2, height / 2, width, height, 0x081018, 0.3);

    const baseY = height - 58;
    this.add.image(132, baseY, "soldier-sprite").setOrigin(0.5, 1).setDisplaySize(34, 48);
    this.add.image(170, baseY - 2, "leader-sprite").setOrigin(0.5, 1).setDisplaySize(38, 54);
    this.add.image(208, baseY, "soldier-sprite").setOrigin(0.5, 1).setDisplaySize(34, 48);
    this.add.rectangle(170, baseY + 4, 116, 12, 0x000000, 0.24).setOrigin(0.5, 0.5);

    this.add
      .text(width / 2, 60, "갈림길 정찰대", {
        fontFamily: "Georgia, serif",
        fontSize: "36px",
        color: "#fff2c6",
        stroke: "#2a1608",
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 106, "깃발을 든 리더가 던전 깊숙이 분대를 이끈다", {
        fontFamily: "serif",
        fontSize: "14px",
        color: "#d7ddef",
      })
      .setOrigin(0.5, 0);

    this.add
      .rectangle(width / 2, height - 82, 320, 64, 0x0e1621, 0.72)
      .setStrokeStyle(2, 0xd39f3f, 0.8);
    const prompt = this.add
      .text(width / 2, height - 84, "터치 / 클릭 / 스페이스바로 시작", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#f7d46c",
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
