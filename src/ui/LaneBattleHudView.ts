import Phaser from "phaser";
import { MVP_ACTIVE_RESOURCE_IDS } from "../data/balance";
import type { CapturePointAction } from "../data/capturePointDefinitions";
import { getResource } from "../data/resources";
import type { AudioSystem } from "../systems/audio/audioSystem";
import type { WorkerRole } from "../systems/lane-economy/laneEconomy";
import { AudioSettingsPanel } from "./AudioSettingsPanel";
import {
  getResourceIconKey,
  getWorkerIconKey,
  getWorkerRoleLabel,
  type LaneBattleHudSnapshot,
} from "./laneBattleHudModel";

interface WorkerUiRow {
  value: Phaser.GameObjects.Text;
  plus: Phaser.GameObjects.Arc;
  minus: Phaser.GameObjects.Arc;
}

interface ActionButton {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export interface LaneBattleHudCallbacks {
  hireWorker: () => void;
  hireResearchWorker: () => void;
  useInstantWave: () => void;
  ageUp: () => void;
  shiftWorker: (role: WorkerRole, delta: 1 | -1) => void;
  buildWatchtower: () => void;
  buildSupplyDepot: () => void;
  buildMint: () => void;
  dismantle: () => void;
  maintainFortress: () => void;
  onAudioSettingsVisibilityChange: (visible: boolean) => void;
}

export class LaneBattleHudView {
  private readonly resourceTexts = new Map<string, Phaser.GameObjects.Text>();
  private readonly workerRows = new Map<WorkerRole, WorkerUiRow>();
  private readonly captureActionButtons = new Map<CapturePointAction, ActionButton>();
  private ageText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private baseText!: Phaser.GameObjects.Text;
  private tokensText!: Phaser.GameObjects.Text;
  private rosterText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private capturePanelTitle!: Phaser.GameObjects.Text;
  private capturePanelBody!: Phaser.GameObjects.Text;
  private playerBaseBar!: Phaser.GameObjects.Rectangle;
  private enemyBaseBar!: Phaser.GameObjects.Rectangle;
  private audioDebugText?: Phaser.GameObjects.Text;
  private audioSettingsPanel!: AudioSettingsPanel;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioSystem,
    private readonly callbacks: LaneBattleHudCallbacks,
    private readonly canvasWidth: number,
    private readonly canvasHeight: number,
    private readonly depth: number,
    audioDebugEnabled: boolean,
  ) {
    this.create(audioDebugEnabled);
  }

  setInfo(text: string): void {
    this.infoText.setText(text);
  }

  openAudioSettings(): void {
    this.audioSettingsPanel.open();
  }

  setAudioDebugLines(lines: string[]): void {
    this.audioDebugText?.setText(lines);
  }

  apply(snapshot: LaneBattleHudSnapshot, actions: readonly CapturePointAction[]): void {
    this.ageText.setText(snapshot.ageText);
    this.waveText.setText(snapshot.waveText);
    this.baseText.setText(snapshot.baseText);
    this.tokensText.setText(snapshot.tokensText);
    MVP_ACTIVE_RESOURCE_IDS.forEach((resourceId) => {
      this.resourceTexts.get(resourceId)?.setText(snapshot.resources[resourceId]);
    });
    this.workerRows.forEach((row, role) => {
      const worker = snapshot.workers[role];
      row.value.setText(worker.value);
      row.plus.setFillStyle(worker.canIncrease ? 0x324a73 : 0x1d2634, 0.96);
      row.minus.setFillStyle(worker.canDecrease ? 0x324a73 : 0x1d2634, 0.96);
    });
    this.playerBaseBar.width = 220 * snapshot.playerBaseRatio;
    this.enemyBaseBar.width = 220 * snapshot.enemyBaseRatio;
    this.playerBaseBar.setOrigin(0, 0.5);
    this.enemyBaseBar.setOrigin(0, 0.5);
    this.rosterText.setText(snapshot.rosterLines);
    this.captureActionButtons.forEach((button, action) => this.setActionVisible(button, actions.includes(action)));
    this.capturePanelTitle.setText(snapshot.captureTitle);
    this.capturePanelBody.setText(snapshot.captureLines);
  }

  getVisibleCaptureActions(): CapturePointAction[] {
    return [...this.captureActionButtons.entries()]
      .filter(([, button]) => button.rect.visible && button.text.visible)
      .map(([action]) => action);
  }

  private create(audioDebugEnabled: boolean): void {
    const hudScale = this.canvasWidth / 1672;
    this.scene.add.image(0, 0, "war-table-hud").setOrigin(0, 0).setScale(hudScale).setCrop(0, 0, 1672, 188).setDepth(this.depth).setScrollFactor(0);
    this.scene.add.image(0, this.canvasHeight - 278 * hudScale, "war-table-hud").setOrigin(0, 0).setScale(hudScale).setCrop(0, 663, 1672, 278).setDepth(this.depth).setScrollFactor(0);
    this.scene.add.rectangle(150, 126, 230, 112, 0x07111a, 0.76).setStrokeStyle(2, 0x7ea0c9, 0.26).setDepth(this.depth + 1).setScrollFactor(0);
    this.scene.add.text(42, 78, "전선 지휘", { fontFamily: "Georgia, serif", fontSize: "24px", color: "#eaf3ff", stroke: "#182535", strokeThickness: 4 }).setDepth(this.depth + 2).setScrollFactor(0);
    this.ageText = this.scene.add.text(42, 108, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#d6e3f1" }).setDepth(this.depth + 2).setScrollFactor(0);
    this.waveText = this.scene.add.text(42, 128, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#d6e3f1" }).setDepth(this.depth + 2).setScrollFactor(0);
    this.baseText = this.scene.add.text(42, 148, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#d6e3f1" }).setDepth(this.depth + 2).setScrollFactor(0);
    this.tokensText = this.scene.add.text(42, 168, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#f3d27a" }).setDepth(this.depth + 2).setScrollFactor(0);

    const resourceXs = [360, 680, 1080, 1400];
    MVP_ACTIVE_RESOURCE_IDS.forEach((resourceId, index) => {
      this.scene.add.image(resourceXs[index], 34, getResourceIconKey(resourceId)).setDisplaySize(26, 26).setDepth(this.depth + 2).setScrollFactor(0);
      this.scene.add.text(resourceXs[index], 10, getResource(resourceId).label, { fontFamily: "sans-serif", fontSize: "11px", color: "#97abd0" }).setDepth(this.depth + 2).setScrollFactor(0).setOrigin(0.5, 0);
      this.resourceTexts.set(resourceId, this.scene.add.text(resourceXs[index], 48, "", { fontFamily: "Georgia, serif", fontSize: "22px", color: "#f5fbff" }).setDepth(this.depth + 2).setScrollFactor(0).setOrigin(0.5, 0));
    });

    this.scene.add.text(84, 640, "일꾼 배치", { fontFamily: "Georgia, serif", fontSize: "22px", color: "#f4e6c5" }).setDepth(this.depth + 2).setScrollFactor(0);
    let workerY = 676;
    (["gold", "wood", "food", "metal", "research", "idle"] as WorkerRole[]).forEach((role) => {
      this.workerRows.set(role, this.createWorkerRow(role, workerY));
      workerY += 28;
    });

    this.createActionButton(430, 668, 190, 42, "일꾼 고용", this.callbacks.hireWorker);
    this.createActionButton(430, 722, 190, 42, "연구 일꾼", this.callbacks.hireResearchWorker);
    this.createActionButton(1100, 668, 220, 42, "즉시 웨이브", this.callbacks.useInstantWave);
    this.createActionButton(1100, 722, 220, 42, "시대 업", this.callbacks.ageUp);

    this.rosterText = this.scene.add.text(790, 650, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#d8e7f6", lineSpacing: 4 }).setDepth(this.depth + 2).setScrollFactor(0);
    this.capturePanelTitle = this.scene.add.text(790, 744, "", { fontFamily: "Georgia, serif", fontSize: "18px", color: "#f4e6c5" }).setDepth(this.depth + 2).setScrollFactor(0).setOrigin(0.5, 0.5);
    this.capturePanelBody = this.scene.add.text(790, 784, "", { fontFamily: "sans-serif", fontSize: "12px", color: "#d8e7f6", align: "center", lineSpacing: 3 }).setDepth(this.depth + 2).setScrollFactor(0).setOrigin(0.5, 0.5);
    this.infoText = this.scene.add.text(790, 842, "", { fontFamily: "sans-serif", fontSize: "12px", color: "#a8bdd7" }).setDepth(this.depth + 2).setScrollFactor(0).setOrigin(0.5, 0.5);

    this.captureActionButtons.set("build-watchtower", this.createActionButton(882, 670, 150, 34, "요새", this.callbacks.buildWatchtower));
    this.captureActionButtons.set("build-supply-depot", this.createActionButton(882, 712, 150, 34, "병참", this.callbacks.buildSupplyDepot));
    this.captureActionButtons.set("build-mint", this.createActionButton(882, 754, 150, 34, "조달소", this.callbacks.buildMint));
    this.captureActionButtons.set("dismantle", this.createActionButton(882, 796, 150, 30, "폐기", this.callbacks.dismantle));
    this.captureActionButtons.set("repair-fortress", this.createActionButton(882, 670, 150, 34, "요새 수리", this.callbacks.maintainFortress));
    this.captureActionButtons.set("rebuild-fortress", this.createActionButton(882, 670, 150, 34, "요새 재건", this.callbacks.maintainFortress));

    this.playerBaseBar = this.scene.add.rectangle(160, 228, 220, 12, 0x4fc1ff, 1).setOrigin(0, 0.5).setDepth(this.depth + 2);
    this.enemyBaseBar = this.scene.add.rectangle(1218, 228, 220, 12, 0xff7373, 1).setOrigin(0, 0.5).setDepth(this.depth + 2);
    this.scene.add.rectangle(160, 228, 220, 12, 0, 0).setOrigin(0, 0.5).setStrokeStyle(2, 0xd6e3f1, 0.4).setDepth(this.depth + 1);
    this.scene.add.rectangle(1218, 228, 220, 12, 0, 0).setOrigin(0, 0.5).setStrokeStyle(2, 0xd6e3f1, 0.4).setDepth(this.depth + 1);
    this.scene.add.text(160, 204, "아군 본진", { fontFamily: "sans-serif", fontSize: "12px", color: "#c7e5ff" }).setDepth(this.depth + 2);
    this.scene.add.text(1218, 204, "적 본진", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffd0d0" }).setDepth(this.depth + 2);

    this.audioSettingsPanel = new AudioSettingsPanel(this.scene, { depth: this.depth + 60, onVisibilityChange: this.callbacks.onAudioSettingsVisibilityChange });
    if (audioDebugEnabled) {
      this.audioDebugText = this.scene.add.text(1160, 116, "", { fontFamily: "monospace", fontSize: "11px", color: "#d9f2ff", backgroundColor: "rgba(4, 13, 22, 0.84)", padding: { x: 9, y: 7 }, lineSpacing: 2 }).setDepth(this.depth + 50).setScrollFactor(0);
    }
  }

  private createWorkerRow(role: WorkerRole, y: number): WorkerUiRow {
    this.scene.add.image(72, y + 10, getWorkerIconKey(role)).setDisplaySize(22, 22).setDepth(this.depth + 2).setScrollFactor(0);
    this.scene.add.text(92, y, getWorkerRoleLabel(role), { fontFamily: "sans-serif", fontSize: "13px", color: "#e6dcc5" }).setDepth(this.depth + 2).setScrollFactor(0);
    const value = this.scene.add.text(198, y, "0", { fontFamily: "monospace", fontSize: "13px", color: "#fff6dd" }).setDepth(this.depth + 2).setScrollFactor(0).setOrigin(1, 0);
    const minus = this.scene.add.circle(224, y + 10, 10, 0x283a55, 0.95).setStrokeStyle(1, 0x7ea0c9).setDepth(this.depth + 2).setScrollFactor(0);
    const plus = this.scene.add.circle(252, y + 10, 10, 0x283a55, 0.95).setStrokeStyle(1, 0x7ea0c9).setDepth(this.depth + 2).setScrollFactor(0);
    this.scene.add.text(minus.x, minus.y - 1, "-", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    this.scene.add.text(plus.x, plus.y - 1, "+", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    minus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.shiftWorker(role, -1));
    plus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.shiftWorker(role, 1));
    return { value, plus, minus };
  }

  private createActionButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void): ActionButton {
    const rect = this.scene.add.rectangle(x + width / 2, y + height / 2, width, height, 0x1d2d47, 0.95).setStrokeStyle(2, 0xd6b979, 0.65).setDepth(this.depth + 2).setScrollFactor(0);
    const text = this.scene.add.text(rect.x, rect.y, label, { fontFamily: "sans-serif", fontSize: "13px", color: "#f3f7fb" }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerover", () => {
      rect.setFillStyle(0x274165, 0.98);
      this.audio.playSfx("sfx.ui.hover", { eventKey: `button:hover:${label}` });
    });
    rect.on("pointerout", () => rect.setFillStyle(0x1d2d47, 0.95));
    rect.on("pointerdown", () => {
      rect.setFillStyle(0x37567f, 1);
      this.scene.time.delayedCall(100, () => rect.setFillStyle(0x1d2d47, 0.95));
      onClick();
    });
    return { rect, text };
  }

  private setActionVisible(button: ActionButton, visible: boolean): void {
    button.rect.setVisible(visible);
    button.text.setVisible(visible);
    if (visible) {
      button.rect.setInteractive({ useHandCursor: true });
      button.text.disableInteractive();
    } else {
      button.rect.disableInteractive();
      button.text.disableInteractive();
    }
  }
}
