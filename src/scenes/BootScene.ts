import Phaser from "phaser";
import { GAME_SUBTITLE, GAME_TAGLINE, GAME_TITLE } from "../data/gameMeta";
import { createParallaxBackground, type ParallaxBackground } from "../gfx/parallax";
import { getMusicController } from "../systems/musicController";

export class BootScene extends Phaser.Scene {
  private bg!: ParallaxBackground;

  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.image("warcrest-splash", "/assets/title/warcrest-splash.png");
    this.load.image("war-table-hud", "/assets/battle/war-table-hud.png");
  }

  create(): void {
    const { width, height } = this.scale;
    getMusicController().setMode("boot");
    this.bg = createParallaxBackground(this);
    this.bg.far.setAlpha(0.03);
    this.bg.near.setAlpha(0.05);
    this.add.image(width / 2, height / 2, "warcrest-splash").setDisplaySize(width, height);
    this.cameras.main.fadeIn(300, 8, 10, 18);

    this.add.rectangle(width / 2, height / 2, width, height, 0x081018, 0.34);
    this.add.rectangle(width / 2, 0, width, 260, 0x050913, 0.54).setOrigin(0.5, 0);
    this.add.rectangle(width / 2, height, width, 190, 0x050913, 0.46).setOrigin(0.5, 1);

    const crest = this.add.container(width / 2, 118);
    crest.add(this.add.circle(0, 0, 78, 0x0a1320, 0.62));
    crest.add(this.add.circle(0, 0, 64, 0xcfa75f, 0.16).setStrokeStyle(3, 0xe8d39b, 0.65));
    crest.add(this.add.text(0, -2, GAME_TITLE, {
      fontFamily: "Georgia, serif",
      fontSize: "54px",
      color: "#fff3d3",
      stroke: "#2c1707",
      strokeThickness: 8,
    }).setOrigin(0.5));

    this.add
      .text(width / 2, 178, GAME_TAGLINE, {
        fontFamily: "serif",
        fontSize: "20px",
        color: "#ecf2ff",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 214, GAME_SUBTITLE, {
        fontFamily: "serif",
        fontSize: "16px",
        color: "#d7e2ef",
      })
      .setOrigin(0.5, 0);
    this.add
      .text(width / 2, 240, "1:1 기본형은 좌하단에서 우상단으로 길게 뻗는 단일 레인 구조를 사용한다", {
        fontFamily: "serif",
        fontSize: "14px",
        color: "#b9c7e2",
      })
      .setOrigin(0.5, 0);

    this.add.rectangle(width / 2, height - 192, 560, 74, 0x0b1421, 0.72).setStrokeStyle(2, 0xcfa75f, 0.6);
    this.add.text(width / 2, height - 211, "블루 요새에서 적 붉은 성채까지, 웨이브와 거점을 운영하며 전선을 밀어붙이십시오.", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#eff5ff",
      align: "center",
      wordWrap: { width: 500 },
    }).setOrigin(0.5, 0);

    this.add
      .rectangle(width / 2, height - 92, 380, 72, 0x101a28, 0.84)
      .setStrokeStyle(2, 0xd39f3f, 0.8);
    const prompt = this.add
      .text(width / 2, height - 94, "터치 / 클릭 / 스페이스바로 시작", {
        fontFamily: "sans-serif",
        fontSize: "22px",
        color: "#f7d46c",
      })
      .setOrigin(0.5, 0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    const startRun = async () => {
      await getMusicController().unlockAndStart("battle");
      this.scene.start("run");
    };

    this.input.keyboard?.once("keydown-SPACE", () => void startRun());
    this.input.once("pointerdown", () => void startRun());
  }

  update(): void {
    this.bg.update();
  }
}
