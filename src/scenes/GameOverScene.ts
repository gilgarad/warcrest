import Phaser from "phaser";
import { createParallaxBackground, type ParallaxBackground } from "../gfx/parallax";
import { getAudioSystem } from "../systems/audio";

interface GameOverData {
  win: boolean;
  squadSize: number;
  summary?: string;
}

export class GameOverScene extends Phaser.Scene {
  private bg!: ParallaxBackground;

  constructor() {
    super("gameover");
  }

  preload(): void {
    if (!this.textures.exists("lane-battlefield-bg")) this.load.image("lane-battlefield-bg", "/assets/battle/lane-battlefield-bg-wide-v2.png");
    if (!this.textures.exists("war-table-hud")) this.load.image("war-table-hud", "/assets/battle/war-table-hud.png");
  }

  create(data: GameOverData): void {
    const { width, height } = this.scale;
    const audio = getAudioSystem();
    void audio.initialize();
    this.bg = createParallaxBackground(this);
    this.bg.far.setAlpha(0.08);
    this.bg.near.setAlpha(0.08);
    const win = Boolean(data?.win);
    const squadSize = data?.squadSize ?? 0;
    const summary = data?.summary;
    audio.setDirectorState(win ? "victory" : "defeat");
    audio.playSfx(win ? "sfx.state.victory" : "sfx.state.defeat", {
      eventKey: `gameover:${win ? "victory" : "defeat"}`,
    });

    this.add.image(width / 2, height / 2, "lane-battlefield-bg").setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, win ? 0x081018 : 0x140810, win ? 0.42 : 0.58);
    this.add.image(width / 2, height / 2, "war-table-hud").setDisplaySize(width, height).setAlpha(0.92);

    // Debug hook for headless/Playwright smoke checks — see docs/rules/testing.md.
    (window as unknown as { __gameDebug: unknown }).__gameDebug = { phase: "gameover", win, squadSize };

    this.add.rectangle(width / 2, height / 2, 418, 228, win ? 0x0f1a29 : 0x1c1218, 0.72).setStrokeStyle(2, 0xd8b26e, 0.72);
    this.add
      .text(width / 2, height / 2 - 76, win ? "전선 승리" : "전선 붕괴", {
        fontFamily: "Georgia, serif",
        fontSize: "42px",
        color: win ? "#fff2c6" : "#ffd6d6",
        stroke: "#261208",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 12, summary ?? (win ? `생존 전력 ${squadSize}명` : "적의 파상 공세를 막지 못했습니다."), {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#cfd3e6",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 20, win ? "다음 시대와 다음 레인 구조를 위한 지휘 설계를 이어갈 수 있습니다." : "경제 배치와 웨이브 타이밍을 다시 조정해 반격하십시오.", {
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
    retryRect.on("pointerover", () => {
      retryRect.setFillStyle(0xf2c14e, 0.8);
      audio.playSfx("sfx.ui.hover", { eventKey: "gameover:retry:hover" });
    });
    retryRect.on("pointerout", () => retryRect.setFillStyle(0xf2c14e, 1));
    retryRect.on("pointerdown", () => {
      audio.playSfx("sfx.ui.confirm", { eventKey: "gameover:retry" });
      audio.resetDirector("menu");
      this.scene.start("boot");
    });
  }

  update(): void {
    this.bg.update();
  }
}
