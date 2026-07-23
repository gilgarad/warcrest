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

  create(data: GameOverData): void {
    const { width, height } = this.scale;
    this.bg = createParallaxBackground(this);

    const win = Boolean(data?.win);
    const squadSize = data?.squadSize ?? 0;

    // Debug hook for headless/Playwright smoke checks — see docs/rules/testing.md.
    (window as unknown as { __gameDebug: unknown }).__gameDebug = { phase: "gameover", win, squadSize };

    this.add
      .text(width / 2, height / 2 - 60, win ? "미션 성공!" : "전멸...", {
        fontFamily: "sans-serif",
        fontSize: "40px",
        color: win ? "#8fe08f" : "#f28a8a",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2, win ? `생존 대열: ${squadSize}명` : "정찰대가 전멸했습니다.", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#cfd3e6",
      })
      .setOrigin(0.5);

    const retryRect = this.add
      .rectangle(width / 2, height / 2 + 70, 180, 54, 0xf2c14e, 1)
      .setStrokeStyle(2, 0xffffff, 0.3);
    this.add
      .text(width / 2, height / 2 + 70, "다시 시작", {
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
