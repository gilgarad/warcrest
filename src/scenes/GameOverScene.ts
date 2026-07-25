import Phaser from "phaser";
import { createParallaxBackground, type ParallaxBackground } from "../gfx/parallax";

interface GameOverData {
  win: boolean;
  squadSize: number;
}

export class GameOverScene extends Phaser.Scene {
  private bg!: ParallaxBackground;

  constructor() {
    super("gameover");
  }

  preload(): void {
    if (!this.textures.exists("fantasy-hud-panel")) {
      this.load.image("fantasy-hud-panel", "/assets/fantasy-hud-panel.png");
    }
    if (!this.textures.exists("victory-illustration")) {
      this.load.image("victory-illustration", "/assets/results/victory-illustration.png");
    }
    if (!this.textures.exists("defeat-illustration")) {
      this.load.image("defeat-illustration", "/assets/results/defeat-illustration.png");
    }
  }

  create(data: GameOverData): void {
    const { width, height } = this.scale;
    this.bg = createParallaxBackground(this);
    this.bg.far.setAlpha(0.16);
    this.bg.near.setAlpha(0.16);
    const win = Boolean(data?.win);
    const squadSize = data?.squadSize ?? 0;
    const backdropKey = win ? "victory-illustration" : "defeat-illustration";

    this.add.image(width / 2, height / 2, backdropKey).setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, win ? 0x081018 : 0x050913, win ? 0.34 : 0.5);

    // Debug hook for headless/Playwright smoke checks — see docs/rules/testing.md.
    (window as unknown as { __gameDebug: unknown }).__gameDebug = { phase: "gameover", win, squadSize };

    this.add.image(width / 2, height / 2 + 8, "fantasy-hud-panel").setDisplaySize(456, 286);
    this.add.rectangle(width / 2, height / 2, 392, 212, win ? 0x101a2a : 0x111521, 0.58);
    this.add
      .text(width / 2, height / 2 - 76, win ? "미션 성공!" : "정찰 실패", {
        fontFamily: "Georgia, serif",
        fontSize: "42px",
        color: win ? "#fff2c6" : "#ffd6d6",
        stroke: "#261208",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 14, win ? `생존 전력 ${squadSize}명` : "리더를 잃고 정찰대가 무너졌습니다.", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#cfd3e6",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 20, win ? "깃발은 다음 층으로 나아갈 준비를 마쳤다." : "다시 대열을 정비하고 던전으로 향하십시오.", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#aeb8d1",
      })
      .setOrigin(0.5);

    const retryRect = this.add
      .rectangle(width / 2, height / 2 + 82, 196, 56, 0xf2c14e, 1)
      .setStrokeStyle(2, 0xffffff, 0.3);
    this.add
      .text(width / 2, height / 2 + 82, "다시 출정", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#1c1c1c",
      })
      .setOrigin(0.5);
    retryRect.setInteractive({ useHandCursor: true });
    retryRect.on("pointerover", () => retryRect.setFillStyle(0xf2c14e, 0.8));
    retryRect.on("pointerout", () => retryRect.setFillStyle(0xf2c14e, 1));
    retryRect.on("pointerdown", () => this.scene.start("boot"));
  }

  update(): void {
    this.bg.update();
  }
}
