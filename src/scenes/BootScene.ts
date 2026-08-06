import Phaser from "phaser";
import { assetUrl } from "../config/assetUrl";
import { parseTerrainRenderMode } from "../config/prototypeVisualConfig";
import { GAME_SUBTITLE, GAME_TAGLINE, GAME_TITLE } from "../data/gameMeta";
import { createParallaxBackground, type ParallaxBackground } from "../gfx/parallax";
import { areLaneBattleAssetsReady, queueLaneBattleAssets } from "./laneBattleAssetPreload";
import { getAudioSystem } from "../systems/audio";

export class BootScene extends Phaser.Scene {
  private bg!: ParallaxBackground;
  private battleAssetsReady = false;
  private pendingStart = false;
  private autoStart = false;
  private progressText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;
  private startBattle?: () => Promise<void>;

  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.image("warcrest-splash", assetUrl("assets/title/warcrest-splash.png"));
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get("golden") === "1") {
      this.scene.start("golden-reference");
      return;
    }
    if (params.get("sandbox") === "1") {
      this.scene.start("unit-sandbox");
      return;
    }
    this.autoStart = params.get("autostart") === "1";
    const { width, height } = this.scale;
    const audio = getAudioSystem();
    void audio.initialize();
    audio.resetDirector("menu");
    (window as unknown as { __gameDebug: unknown }).__gameDebug = { phase: "boot" };
    this.bg = createParallaxBackground(this);
    this.bg.far.setAlpha(0.02);
    this.bg.near.setAlpha(0.03);
    this.add.image(width / 2, height / 2, "warcrest-splash").setDisplaySize(width, height).setAlpha(0.3);
    this.cameras.main.fadeIn(300, 8, 10, 18);

    this.add.rectangle(width / 2, height / 2, width, height, 0x081018, 0.68);
    this.add.rectangle(width / 2, height / 2, 560, 324, 0x0b1421, 0.86).setStrokeStyle(2, 0xcfa75f, 0.28);
    this.add.rectangle(width / 2, height / 2 - 104, 420, 1, 0xd2ab65, 0.34);

    const crest = this.add.container(width / 2, height / 2 - 82);
    crest.add(this.add.text(0, -6, GAME_TITLE, {
      fontFamily: "Georgia, serif",
      fontSize: "50px",
      color: "#fff3d3",
      stroke: "#2c1707",
      strokeThickness: 7,
    }).setOrigin(0.5));

    this.add
      .text(width / 2, height / 2 - 24, GAME_TAGLINE, {
        fontFamily: "serif",
        fontSize: "18px",
        color: "#e7eefb",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, height / 2 + 6, GAME_SUBTITLE, {
        fontFamily: "serif",
        fontSize: "15px",
        color: "#cbd8ea",
      })
      .setOrigin(0.5, 0);

    this.add.text(width / 2, height / 2 + 72, "웨이브, 거점, 시대 운영으로 북/남 전선을 함께 밀어붙이십시오.", {
      fontFamily: "sans-serif",
      fontSize: "17px",
      color: "#e9f1fd",
      align: "center",
      wordWrap: { width: 440 },
    }).setOrigin(0.5, 0);

    this.add
      .rectangle(width / 2, height / 2 + 166, 320, 62, 0x101a28, 0.92)
      .setStrokeStyle(2, 0xd39f3f, 0.62);
    this.promptText = this.add
      .text(width / 2, height / 2 + 150, "전장 준비 중...", {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#f7d46c",
      })
      .setOrigin(0.5, 0.5);
    this.progressText = this.add
      .text(width / 2, height / 2 + 182, "자산 0%", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#b9c7e2",
      })
      .setOrigin(0.5, 0.5);
    this.tweens.add({ targets: this.promptText, alpha: 0.45, duration: 750, yoyo: true, repeat: -1 });

    let starting = false;
    this.startBattle = async () => {
      if (starting) return;
      if (!this.battleAssetsReady) {
        this.pendingStart = true;
        this.promptText?.setText("전장 준비 중...");
        return;
      }
      starting = true;
      if (!this.autoStart) {
        await audio.unlock();
        audio.playSfx("sfx.ui.confirm", { eventKey: "boot:start" });
      }
      audio.resetDirector("preparation");
      this.scene.stop("gameover");
      this.scene.stop("run");
      this.scene.start("run");
    };

    this.input.keyboard?.on("keydown-SPACE", () => void this.startBattle?.());
    this.input.on("pointerdown", () => void this.startBattle?.());
    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown-SPACE");
      this.input.off("pointerdown");
      this.load.off("progress");
      this.load.off("complete");
    });
    this.prepareBattleAssets();
  }

  update(): void {
    this.bg.update();
  }

  private prepareBattleAssets(): void {
    const terrainMode = parseTerrainRenderMode(new URLSearchParams(window.location.search).get("terrain"));
    if (areLaneBattleAssetsReady(this, terrainMode)) {
      this.markBattleAssetsReady();
      return;
    }

    const queued = queueLaneBattleAssets(this, terrainMode);
    if (queued <= 0) {
      this.markBattleAssetsReady();
      return;
    }

    this.load.on("progress", (progress: number) => {
      this.progressText?.setText(`자산 ${Math.round(progress * 100)}%`);
    });
    this.load.once("complete", () => {
      this.markBattleAssetsReady();
    });
    this.load.start();
  }

  private markBattleAssetsReady(): void {
    this.battleAssetsReady = true;
    this.promptText?.setText("터치 / 클릭 / 스페이스바로 시작");
    this.progressText?.setText("전장 준비 완료");
    if (this.autoStart) {
      this.time.delayedCall(60, () => void this.startBattle?.());
      return;
    }
    if (this.pendingStart) {
      this.pendingStart = false;
      this.time.delayedCall(60, () => void this.startBattle?.());
    }
  }
}
