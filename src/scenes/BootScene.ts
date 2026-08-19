import Phaser from "phaser";
import { atLeastTouchable, measureScreen, splashPresentation, type ScreenMetrics } from "../ui/screenLayout";
import { assetUrl } from "../config/assetUrl";
import { parseTerrainRenderMode } from "../config/prototypeVisualConfig";
import { DIFFICULTIES, type DifficultyId } from "../data/difficulty";
import { GAME_SUBTITLE, GAME_TAGLINE, GAME_TITLE } from "../data/gameMeta";
import { createParallaxBackground, type ParallaxBackground } from "../gfx/parallax";
import { areLaneBattleAssetsReady, queueLaneBattleAssets } from "./laneBattleAssetPreload";
import { getAudioSystem } from "../systems/audio";
import { RelayMatchService, type RejoinedMatch } from "../systems/net/relayMatchService";
import { isMixedContentRelay, resolveRelayUrl } from "../config/relayUrl";
import type { MatchDescriptor } from "../systems/net/matchTypes";
import { OnlineLobbyPanel } from "../ui/OnlineLobbyPanel";

interface MenuLayout {
  panelWidth: number;
  panelHeight: number;
  panelCentreY: number;
  boxWidth: number;
  boxHeight: number;
  labelY: number;
  rowY: number;
  onlineWidth: number;
  onlineHeight: number;
  onlineY: number;
}

export class BootScene extends Phaser.Scene {
  /**
   * The title screen was never sized for a phone: at 0.43 CSS pixels to the
   * game unit its body text landed around five pixels, which is where the
   * mobile pass first shows itself -- before a player ever reaches the game.
   */
  private metrics: ScreenMetrics = measureScreen(1600, 900);
  private menuLayout!: MenuLayout;

  /**
   * Vertical stack for the menu's lower half, and the panel that has to contain
   * it.
   *
   * Worked out before anything is drawn, because the panel's height depends on
   * how tall the controls turn out to be, and on a phone they are more than
   * twice their desktop size.
   */
  private computeMenuLayout(height: number, contentBottom: number): MenuLayout {
    const boxWidth = atLeastTouchable(this.metrics, 128);
    const boxHeight = atLeastTouchable(this.metrics, 76);
    const onlineWidth = atLeastTouchable(this.metrics, 274);
    const onlineHeight = atLeastTouchable(this.metrics, 46);
    const gap = 14;
    const panelTop = height / 2 - 195;
    // Below whatever the prose actually ended up occupying, never above the
    // original position on a desktop where it already sat clear.
    const labelY = Math.max(height / 2 + 118, contentBottom + 18);
    const rowY = labelY + 26 + boxHeight / 2;
    const onlineY = rowY + boxHeight / 2 + gap + onlineHeight / 2;
    const panelBottom = onlineY + onlineHeight / 2 + 20;
    // Wide enough for the row it has to hold, never narrower than it was.
    const rowWidth = DIFFICULTIES.length * boxWidth + (DIFFICULTIES.length - 1) * gap;
    return {
      panelWidth: Math.max(560, rowWidth + 48, onlineWidth + 48),
      panelHeight: panelBottom - panelTop,
      panelCentreY: (panelTop + panelBottom) / 2,
      boxWidth,
      boxHeight,
      labelY,
      rowY,
      onlineWidth,
      onlineHeight,
      onlineY,
    };
  }

  private textPx(baseUnits: number): string {
    return `${Math.ceil(Math.max(baseUnits, this.metrics.minBodyTextUnits))}px`;
  }

  private bg!: ParallaxBackground;
  private battleAssetsReady = false;
  private pendingStart = false;
  private autoStart = false;
  private progressText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private loadingBox?: Phaser.GameObjects.Rectangle;
  private progressBarTrack?: Phaser.GameObjects.Rectangle;
  private progressBarFill?: Phaser.GameObjects.Rectangle;
  private difficultyLabel?: Phaser.GameObjects.Text;
  private difficultyButtons: { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [];
  private startBattle?: (difficultyId: DifficultyId) => Promise<void>;
  private startOnlineMatch?: (match: MatchDescriptor, resume?: RejoinedMatch) => void;
  private onlineButton?: { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };
  private lobby?: OnlineLobbyPanel;
  private relayService?: RelayMatchService;

  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.image("warcrest-splash", assetUrl("assets/title/warcrest-splash.png"));
  }

  create(): void {
    // Measured here rather than in a field initialiser: a Scene has no `scale`
    // in its constructor, so measuring there silently returns the desktop
    // fallback and the phone sizing never happens.
    this.metrics = measureScreen(this.scale.displaySize.width, this.scale.displaySize.height);
    const params = new URLSearchParams(window.location.search);
    if (params.get("golden") === "1") {
      this.scene.start("golden-reference");
      return;
    }
    if (params.get("sandbox") === "1") {
      this.scene.start("unit-sandbox");
      return;
    }
    if (params.get("sandbox") === "2") {
      this.scene.start("audio-lab");
      return;
    }
    this.autoStart = params.get("autostart") === "1" || params.get("scenario") === "visual-validation";
    const { width, height } = this.scale;
    const audio = getAudioSystem();
    void audio.initialize();
    audio.resetDirector("menu");
    (window as unknown as { __gameDebug: unknown }).__gameDebug = { phase: "boot" };
    this.bg = createParallaxBackground(this);
    this.bg.far.setAlpha(0.02);
    this.bg.near.setAlpha(0.03);
    // Explicitly behind the panel. The panel is drawn after the prose it frames
    // so it does not cover it, which puts it at a negative depth -- and without
    // this the splash would then sit on top of the panel and wash it out.
    const splash = splashPresentation(this.metrics);
    this.add.image(width / 2, height / 2, "warcrest-splash")
      .setDisplaySize(width * splash.zoom, height * splash.zoom)
      .setAlpha(splash.alpha)
      .setDepth(-2);
    this.cameras.main.fadeIn(300, 8, 10, 18);

    this.add.rectangle(width / 2, height / 2, width, height, 0x081018, 0.68);
    this.add.rectangle(width / 2, height / 2 - 104, 420, 1, 0xd2ab65, 0.34);

    const crest = this.add.container(width / 2, height / 2 - 82);
    crest.add(this.add.text(0, -6, GAME_TITLE, {
      fontFamily: "Georgia, serif",
      fontSize: this.textPx(50),
      color: "#fff3d3",
      stroke: "#2c1707",
      strokeThickness: 7,
    }).setOrigin(0.5));

    this.add
      .text(width / 2, height / 2 - 24, GAME_TAGLINE, {
        fontFamily: "serif",
        fontSize: this.textPx(18),
        color: "#e7eefb",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, height / 2 + 6, GAME_SUBTITLE, {
        fontFamily: "serif",
        fontSize: this.textPx(15),
        color: "#cbd8ea",
      })
      .setOrigin(0.5, 0);

    const hint = this.add.text(width / 2, height / 2 + 72, "웨이브, 거점, 시대 운영으로 북/남 전선을 함께 밀어붙이십시오.", {
      fontFamily: "sans-serif",
      fontSize: this.textPx(17),
      color: "#e9f1fd",
      align: "center",
      wordWrap: { width: 440 },
    }).setOrigin(0.5, 0);

    // Laid out now that the tallest piece of prose has been measured. Its
    // height is the thing that moves: the hint wraps to two or three lines
    // depending on how large the text had to be for this screen, and guessing
    // it is what put "난이도" on top of the last line.
    const menu = this.computeMenuLayout(height, hint.getBounds().bottom);
    this.menuLayout = menu;
    // Drawn after the prose it frames, so it is pushed behind rather than over.
    this.add.rectangle(width / 2, menu.panelCentreY, menu.panelWidth, menu.panelHeight, 0x0b1421, 0.86)
      .setStrokeStyle(2, 0xcfa75f, 0.28)
      .setDepth(-1);

    this.loadingBox = this.add
      .rectangle(width / 2, height / 2 + 178, 400, 112, 0x101a28, 0.92)
      .setStrokeStyle(2, 0xd39f3f, 0.62);
    this.promptText = this.add
      .text(width / 2, height / 2 + 144, "전장 준비 중...", {
        fontFamily: "sans-serif",
        fontSize: this.textPx(20),
        color: "#f7d46c",
      })
      .setOrigin(0.5, 0.5);
    // A real filled progress bar, not just a percentage number — first-visit
    // asset loading can take 10-25+ seconds, and a bare number is easy to
    // miss (users assumed the click did nothing and the game was broken).
    const barWidth = 300;
    const barHeight = 18;
    const barX = width / 2 - barWidth / 2;
    const barY = height / 2 + 174;
    this.progressBarTrack = this.add
      .rectangle(width / 2, barY, barWidth, barHeight, 0x0a0f18, 0.9)
      .setStrokeStyle(1, 0x5c7291, 0.6);
    this.progressBarFill = this.add
      .rectangle(barX, barY, 0, barHeight - 4, 0xf7d46c, 0.95)
      .setOrigin(0, 0.5);
    this.progressText = this.add
      .text(width / 2 + barWidth / 2 + 28, barY, "0%", {
        fontFamily: "sans-serif",
        fontSize: this.textPx(13),
        color: "#f7d46c",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(1);
    this.hintText = this.add
      .text(width / 2, height / 2 + 202, "최초 접속 시 자산을 내려받는 데 최대 30초 정도 걸릴 수 있습니다.\n버튼이 나타날 때까지 잠시만 기다려주세요.", {
        fontFamily: "sans-serif",
        fontSize: this.textPx(11),
        color: "#8fa3c2",
        align: "center",
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
    this.tweens.add({ targets: this.promptText, alpha: 0.45, duration: 750, yoyo: true, repeat: -1 });

    this.difficultyLabel = this.add
      .text(width / 2, this.menuLayout.labelY, "난이도", {
        fontFamily: "Georgia, serif",
        fontSize: this.textPx(17),
        color: "#f1e4c3",
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    // 128x76 is already comfortable on a monitor, so `atLeastTouchable` leaves
    // it alone there and only grows it where a finger would miss.
    const { boxWidth, boxHeight, rowY } = this.menuLayout;
    const gap = 14;
    const totalWidth = DIFFICULTIES.length * boxWidth + (DIFFICULTIES.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + boxWidth / 2;

    this.difficultyButtons = DIFFICULTIES.map((difficulty, index) => {
      const x = startX + index * (boxWidth + gap);
      const rect = this.add
        .rectangle(x, rowY, boxWidth, boxHeight, 0x101a28, 0.92)
        .setStrokeStyle(2, 0xd39f3f, 0.62)
        .setVisible(false);
      const text = this.add
        .text(x, rowY, difficulty.label, { fontFamily: "sans-serif", fontSize: this.textPx(20), color: "#f7d46c" })
        .setOrigin(0.5, 0.5)
        .setVisible(false);
      rect.on("pointerover", () => rect.setFillStyle(0x1c2d44, 0.96));
      rect.on("pointerout", () => rect.setFillStyle(0x101a28, 0.92));
      rect.on("pointerdown", () => void this.startBattle?.(difficulty.id));
      return { rect, text };
    });

    this.buildOnlineButton(width / 2, this.menuLayout.onlineY);

    let starting = false;
    this.startBattle = async (difficultyId: DifficultyId) => {
      if (starting) return;
      if (!this.battleAssetsReady) {
        this.pendingStart = true;
        return;
      }
      starting = true;
      if (!this.autoStart) {
        await audio.unlock();
        audio.playSfx("sfx.ui.confirm", { eventKey: `boot:start:${difficultyId}` });
      }
      audio.resetDirector("preparation");
      this.scene.stop("gameover");
      this.scene.stop("run");
      this.scene.start("run", { difficultyId, mode: "single" });
    };

    this.startOnlineMatch = (match: MatchDescriptor, resume?: RejoinedMatch) => {
      audio.resetDirector("preparation");
      this.scene.stop("gameover");
      this.scene.stop("run");
      // Same scene, same simulation — only the opponent source differs.
      this.scene.start("run", {
        difficultyId: DIFFICULTIES[0].id,
        mode: match.mode,
        match,
        relay: this.relayService ?? null,
        resume,
      });
    };

    this.events.once("shutdown", () => {
      this.load.off("progress");
      this.load.off("complete");
    });
    this.prepareBattleAssets();
  }

  update(): void {
    this.bg.update();
  }

  /**
   * "온라인 대전" entry point. Sits under the difficulty row because difficulty
   * only applies to the single-player AI — an online match has a human on the
   * other side, so it takes no difficulty setting.
   */
  private buildOnlineButton(x: number, y: number): void {
    const rect = this.add
      .rectangle(x, y, this.menuLayout.onlineWidth, this.menuLayout.onlineHeight, 0x16233a, 0.94)
      .setStrokeStyle(2, 0x6aa9e0, 0.7)
      .setVisible(false);
    const text = this.add
      .text(x, y, "온라인 대전", {
        fontFamily: "Georgia, serif", fontSize: this.textPx(20), color: "#bfe2ff",
      })
      .setOrigin(0.5)
      .setVisible(false);
    rect.on("pointerover", () => rect.setFillStyle(0x1f3454, 0.98));
    rect.on("pointerout", () => rect.setFillStyle(0x16233a, 0.94));
    rect.on("pointerdown", () => void this.openLobby());
    this.onlineButton = { rect, text };
  }

  private async openLobby(): Promise<void> {
    if (!this.battleAssetsReady || this.lobby?.isOpen()) return;
    if (!this.lobby) {
      const relayUrl = resolveRelayUrl();
      if (isMixedContentRelay(relayUrl)) {
        // Fail loudly here rather than letting the browser block the socket and
        // report an opaque connection error.
        console.warn(`[warcrest] HTTPS 페이지에서 ws:// 릴레이(${relayUrl})는 차단됩니다. wss:// 주소가 필요합니다.`);
      }
      this.relayService = new RelayMatchService(relayUrl);
      // A reconnect is recognised as soon as the socket identifies itself, which
      // is while the player is still looking at the lobby. Nothing was listening
      // for it before, so the relay held their seat and handed back the match
      // log to a client that dropped it on the floor.
      this.relayService.onRejoin((resume) => {
        this.lobby?.hide();
        this.startOnlineMatch?.({
          mode: "pvp",
          seed: resume.seed,
          opponentName: resume.opponentName,
          localTeam: resume.localTeam,
          matchKind: "auto",
        }, resume);
      });
      this.lobby = new OnlineLobbyPanel(this, this.relayService, {
        onMatchReady: (match) => {
          this.lobby?.hide();
          this.startOnlineMatch?.(match);
        },
        onClose: () => { /* panel tears itself down */ },
      });
    }
    await this.lobby.show();
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

    const barWidth = this.progressBarTrack?.width ?? 320;
    const barHeight = this.progressBarFill?.height ?? 14;
    this.load.on("progress", (progress: number) => {
      this.progressText?.setText(`${Math.round(progress * 100)}%`);
      this.progressBarFill?.setSize(barWidth * Phaser.Math.Clamp(progress, 0, 1), barHeight);
    });
    this.load.once("complete", () => {
      this.markBattleAssetsReady();
    });
    this.load.start();
  }

  private markBattleAssetsReady(): void {
    this.battleAssetsReady = true;
    this.loadingBox?.setVisible(false);
    this.promptText?.setVisible(false);
    this.progressText?.setVisible(false);
    this.progressBarTrack?.setVisible(false);
    this.progressBarFill?.setVisible(false);
    this.hintText?.setVisible(false);
    this.difficultyLabel?.setVisible(true);
    this.difficultyButtons.forEach(({ rect, text }) => {
      rect.setVisible(true).setInteractive({ useHandCursor: true });
      text.setVisible(true);
    });
    this.onlineButton?.rect.setVisible(true).setInteractive({ useHandCursor: true });
    this.onlineButton?.text.setVisible(true);
    if (this.autoStart) {
      this.time.delayedCall(60, () => void this.startBattle?.(DIFFICULTIES[0].id));
      return;
    }
    if (this.pendingStart) {
      this.pendingStart = false;
      this.time.delayedCall(60, () => void this.startBattle?.(DIFFICULTIES[0].id));
    }
  }
}
