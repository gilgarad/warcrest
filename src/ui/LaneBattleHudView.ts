import Phaser from "phaser";
import { MVP_ACTIVE_RESOURCE_IDS } from "../data/balance";
import type { CapturePointAction } from "../data/capturePointDefinitions";
import type { DefenseTowerAction } from "../data/defenseTowerDefinitions";
import { getResource, type ResourceId } from "../data/resources";
import type { AudioSystem } from "../systems/audio/audioSystem";
import type { WorkerRole } from "../systems/lane-economy/laneEconomy";
import { AudioSettingsPanel } from "./AudioSettingsPanel";
import {
  getResourceIconKey,
  getWorkerIconKey,
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
  costIcons: Phaser.GameObjects.Image[];
  costTexts: Phaser.GameObjects.Text[];
}

/** Max distinct resources shown in a single button's cost row (gold/wood/food/metal/research). */
const MAX_COST_ITEMS = 5;

type StrategicActionId = "hire-worker" | "hire-research-worker" | "use-instant-wave" | "age-up";

const HUD_SOURCE_WIDTH = 1672;
const HUD_TOP_SOURCE_HEIGHT = 160;
const HUD_BOTTOM_SOURCE_HEIGHT = 220;
const RESOURCE_BAR_XS = [448, 638, 828, 1018, 1208];

export interface LaneBattleHudCallbacks {
  hireWorker: () => void;
  hireResearchWorker: () => void;
  useInstantWave: () => void;
  ageUp: () => void;
  shiftWorker: (role: WorkerRole, delta: 1 | -1) => void;
  rebuildDefenseTower: () => void;
  buildDefenseTower: () => void;
  buildSupplyDepot: () => void;
  buildMint: () => void;
  dismantle: () => void;
  toggleDevMode: () => void;
  grantDevResearch: () => void;
  onAudioSettingsVisibilityChange: (visible: boolean) => void;
}

export class LaneBattleHudView {
  private readonly resourceTexts = new Map<string, Phaser.GameObjects.Text>();
  private readonly resourceLabelTexts = new Map<string, Phaser.GameObjects.Text>();
  private readonly workerRows = new Map<WorkerRole, WorkerUiRow>();
  private readonly captureActionButtons = new Map<CapturePointAction | DefenseTowerAction, ActionButton>();
  private readonly strategicActionButtons = new Map<StrategicActionId, ActionButton>();
  private ageText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private baseText!: Phaser.GameObjects.Text;
  private tokensText!: Phaser.GameObjects.Text;
  private rosterText!: Phaser.GameObjects.Text;
  private capturePanelTitle!: Phaser.GameObjects.Text;
  private capturePanelBody!: Phaser.GameObjects.Text;
  private playerBaseBar!: Phaser.GameObjects.Rectangle;
  private enemyBaseBar!: Phaser.GameObjects.Rectangle;
  private audioDebugText?: Phaser.GameObjects.Text;
  private audioSettingsPanel!: AudioSettingsPanel;
  private devToggleButton?: ActionButton;
  private devResearchButton?: ActionButton;
  private readonly lastResourceValues = new Map<ResourceId, number>();

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

  /**
   * Momentary action feedback (wave dispatched, food shortage, instant-wave
   * on cooldown, etc.) — the old fixed info panel that always showed this
   * text was removed as clutter, but the messages themselves are still the
   * only way a player learns *why* a button press did nothing, so they now
   * surface as a floating toast over the worker/action panel instead of a
   * static line that's either empty or stale.
   */
  setInfo(text: string): void {
    if (!text) return;
    const toast = this.scene.add.text(672, 676, text, {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#f4e6c5",
      stroke: "#132033",
      strokeThickness: 3,
      align: "center",
    }).setOrigin(0.5, 1).setDepth(this.depth + 30).setScrollFactor(0);
    this.scene.cameras.main.ignore(toast);
    this.scene.tweens.add({
      targets: toast,
      y: toast.y - 14,
      alpha: 0,
      delay: 700,
      duration: 500,
      onComplete: () => toast.destroy(),
    });
  }

  openAudioSettings(): void {
    this.audioSettingsPanel.open();
  }

  setAudioDebugLines(lines: string[]): void {
    this.audioDebugText?.setText(lines);
  }

  apply(snapshot: LaneBattleHudSnapshot, actions: readonly (CapturePointAction | DefenseTowerAction)[]): void {
    this.ageText.setText(snapshot.ageText);
    this.waveText.setText(snapshot.waveText);
    this.baseText.setText(snapshot.baseText);
    this.tokensText.setText(snapshot.tokensText);
    MVP_ACTIVE_RESOURCE_IDS.forEach((resourceId, index) => {
      this.resourceTexts.get(resourceId)?.setText(snapshot.resources[resourceId]);
      const current = Number(snapshot.resources[resourceId]);
      const previous = this.lastResourceValues.get(resourceId);
      if (previous !== undefined && current > previous) {
        this.spawnResourceGainPopup(resourceId, index, current - previous);
      }
      this.lastResourceValues.set(resourceId, current);
    });
    this.workerRows.forEach((row, role) => {
      const worker = snapshot.workers[role];
      row.value.setText(worker.value);
      row.plus.setFillStyle(worker.canIncrease ? 0x324a73 : 0x1d2634, 0.96);
      row.minus.setFillStyle(worker.canDecrease ? 0x324a73 : 0x1d2634, 0.96);
    });
    this.playerBaseBar.width = 180 * snapshot.playerBaseRatio;
    this.enemyBaseBar.width = 180 * snapshot.enemyBaseRatio;
    this.playerBaseBar.setOrigin(0, 0.5);
    this.enemyBaseBar.setOrigin(0, 0.5);
    this.rosterText.setVisible(false);
    this.captureActionButtons.forEach((button, action) => this.setActionVisible(button, actions.includes(action)));
    this.capturePanelTitle.setText(snapshot.captureTitle);
    this.capturePanelBody.setText(snapshot.captureLines);
  }

  /**
   * A momentary "+N" next to a resource number whenever it goes up (worker
   * production tick, kill reward, etc.) — the game had no way to see what a
   * worker actually produces, so this makes each production tick visible
   * where it happens instead of requiring a separate explainer screen.
   * Holds at full strength for 0.5s, then fades over the next 0.5s.
   */
  private spawnResourceGainPopup(resourceId: ResourceId, index: number, delta: number): void {
    const popup = this.scene.add.text(RESOURCE_BAR_XS[index] + 46, 64, `+${delta}`, {
      fontFamily: "Georgia, serif",
      fontSize: "19px",
      color: resourceId === "research" ? "#9df2ff" : "#8dffa8",
      stroke: "#08150c",
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(this.depth + 6).setScrollFactor(0);
    this.scene.cameras.main.ignore(popup);
    this.scene.tweens.add({ targets: popup, y: popup.y - 16, duration: 1000, ease: "Cubic.Out" });
    this.scene.tweens.add({
      targets: popup,
      alpha: 0,
      delay: 500,
      duration: 500,
      onComplete: () => popup.destroy(),
    });
  }

  getVisibleCaptureActions(): (CapturePointAction | DefenseTowerAction)[] {
    return [...this.captureActionButtons.entries()]
      .filter(([, button]) => button.rect.visible && button.text.visible)
      .map(([action]) => action);
  }

  getAgeLabelText(): string {
    return this.ageText.text;
  }

  setStrategicActionLabel(actionId: StrategicActionId, label: string): void {
    const button = this.strategicActionButtons.get(actionId);
    if (!button) return;
    button.text.setText(label);
  }

  setStrategicActionCost(actionId: StrategicActionId, cost: Partial<Record<ResourceId, number>>): void {
    this.applyCostRow(this.strategicActionButtons.get(actionId), cost);
  }

  setStrategicActionEnabled(actionId: StrategicActionId, enabled: boolean): void {
    const button = this.strategicActionButtons.get(actionId);
    if (!button) return;
    button.rect.setFillStyle(enabled ? 0x1d2d47 : 0x3b2222, enabled ? 0.95 : 0.92);
    button.rect.setStrokeStyle(2, enabled ? 0xd6b979 : 0xd07c7c, enabled ? 0.65 : 0.8);
    button.text.setColor(enabled ? "#f3f7fb" : "#ffd4d4");
  }

  setCaptureActionLabel(actionId: CapturePointAction | DefenseTowerAction, label: string): void {
    const button = this.captureActionButtons.get(actionId);
    if (!button) return;
    button.text.setText(label);
  }

  setCaptureActionCost(actionId: CapturePointAction | DefenseTowerAction, cost: Partial<Record<ResourceId, number>>): void {
    this.applyCostRow(this.captureActionButtons.get(actionId), cost);
  }

  setDevMode(active: boolean): void {
    if (!this.devToggleButton || !this.devResearchButton) return;
    this.devToggleButton.rect.setFillStyle(active ? 0x27503f : 0x3b2a2a, 0.96);
    this.devToggleButton.rect.setStrokeStyle(2, active ? 0x9fe3c4 : 0xd79b9b, 0.75);
    this.devToggleButton.text.setText(active ? "DEV ON" : "DEV OFF");
    this.devToggleButton.text.setColor(active ? "#eafff2" : "#ffe3e3");
    this.devResearchButton.rect.setVisible(active);
    this.devResearchButton.text.setVisible(active);
    if (active) {
      this.devResearchButton.rect.setInteractive({ useHandCursor: true });
    } else {
      this.devResearchButton.rect.disableInteractive();
    }
  }

  getCompositionMetrics(): { topHeight: number; bottomHeight: number; openWorldHeight: number; openWorldRatio: number } {
    const scale = this.canvasWidth / HUD_SOURCE_WIDTH;
    const topHeight = HUD_TOP_SOURCE_HEIGHT * scale;
    const bottomHeight = HUD_BOTTOM_SOURCE_HEIGHT * scale;
    const openWorldHeight = this.canvasHeight - topHeight - bottomHeight;
    return {
      topHeight,
      bottomHeight,
      openWorldHeight,
      openWorldRatio: openWorldHeight / this.canvasHeight,
    };
  }

  private create(audioDebugEnabled: boolean): void {
    const hudScale = this.canvasWidth / HUD_SOURCE_WIDTH;
    const bottomHeight = HUD_BOTTOM_SOURCE_HEIGHT * hudScale;
    this.scene.add.image(0, 0, "war-table-hud").setOrigin(0, 0).setScale(hudScale).setCrop(0, 0, HUD_SOURCE_WIDTH, HUD_TOP_SOURCE_HEIGHT).setDepth(this.depth).setScrollFactor(0).setAlpha(0.18);
    this.scene.add.image(0, this.canvasHeight - bottomHeight, "war-table-hud").setOrigin(0, 0).setScale(hudScale).setCrop(0, 721, HUD_SOURCE_WIDTH, HUD_BOTTOM_SOURCE_HEIGHT).setDepth(this.depth).setScrollFactor(0);
    this.scene.add.rectangle(this.canvasWidth / 2, 74, this.canvasWidth - 36, 126, 0x081119, 0.84)
      .setStrokeStyle(2, 0x233448, 0.54)
      .setDepth(this.depth + 1)
      .setScrollFactor(0);
    this.scene.add.rectangle(this.canvasWidth / 2, 24, this.canvasWidth - 80, 2, 0x557aa6, 0.28)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    this.scene.add.rectangle(this.canvasWidth / 2, 124, this.canvasWidth - 80, 2, 0xd0b073, 0.16)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    this.scene.add.rectangle(152, 74, 236, 112, 0x0b1621, 0.86)
      .setStrokeStyle(2, 0x476786, 0.42)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    this.scene.add.text(42, 18, "전선 지휘", { fontFamily: "Georgia, serif", fontSize: "24px", color: "#eef5ff", stroke: "#101b28", strokeThickness: 3 }).setDepth(this.depth + 3).setScrollFactor(0);
    this.ageText = this.scene.add.text(42, 48, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#dce8f4" }).setDepth(this.depth + 3).setScrollFactor(0);
    this.waveText = this.scene.add.text(42, 69, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#dce8f4" }).setDepth(this.depth + 3).setScrollFactor(0);
    this.baseText = this.scene.add.text(42, 90, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#dce8f4" }).setDepth(this.depth + 3).setScrollFactor(0);
    this.tokensText = this.scene.add.text(42, 111, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#f1d891" }).setDepth(this.depth + 3).setScrollFactor(0);

    this.scene.add.rectangle(this.canvasWidth / 2 + 60, 72, 1018, 82, 0x09131d, 0.64)
      .setStrokeStyle(1, 0x3f556f, 0.3)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    MVP_ACTIVE_RESOURCE_IDS.forEach((resourceId, index) => {
      this.scene.add.rectangle(RESOURCE_BAR_XS[index], 72, 172, 58, 0x101c28, 0.84)
        .setStrokeStyle(1, resourceId === "research" ? 0x63a9bb : 0x5c6f88, 0.42)
        .setDepth(this.depth + 3)
        .setScrollFactor(0);
      this.scene.add.image(RESOURCE_BAR_XS[index] - 54, 72, getResourceIconKey(resourceId)).setDisplaySize(28, 28).setAlpha(0.98).setDepth(this.depth + 4).setScrollFactor(0);
      this.resourceLabelTexts.set(
        resourceId,
        this.scene.add.text(RESOURCE_BAR_XS[index] - 8, 50, getResource(resourceId).label, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: resourceId === "research" ? "#b9f2ff" : "#aac1db",
        }).setDepth(this.depth + 4).setScrollFactor(0).setOrigin(0.5, 0.5),
      );
      this.resourceTexts.set(resourceId, this.scene.add.text(RESOURCE_BAR_XS[index] + 2, 80, "", {
        fontFamily: "Georgia, serif",
        fontSize: resourceId === "research" ? "30px" : "33px",
        color: resourceId === "research" ? "#d2fbff" : "#f5fbff",
      }).setDepth(this.depth + 4).setScrollFactor(0).setOrigin(0.5, 0.5));
    });

    // Worker panel + hire/instant-wave/age-up buttons live in the bottom-center
    // zone that used to show the tower/capture info panel and status text —
    // that panel was removed as redundant (the same info is available by
    // touching the structure directly), so this space now hosts the actions
    // the player needs most often instead of sitting empty.
    this.scene.add.text(672, 700, "일꾼 배치", { fontFamily: "Georgia, serif", fontSize: "16px", color: "#f4e6c5" }).setDepth(this.depth + 2).setScrollFactor(0).setOrigin(0.5, 0);
    const workerGrid: [WorkerRole, WorkerRole][] = [
      ["gold", "wood"],
      ["food", "metal"],
      ["research", "idle"],
    ];
    workerGrid.forEach(([left, right], row) => {
      const y = 724 + row * 24;
      this.workerRows.set(left, this.createWorkerRow(left, 548, y));
      this.workerRows.set(right, this.createWorkerRow(right, 748, y));
    });

    this.strategicActionButtons.set("hire-worker", this.createActionButton(500, 794, 164, 36, "일꾼 고용", this.callbacks.hireWorker));
    this.strategicActionButtons.set("hire-research-worker", this.createActionButton(681, 794, 164, 44, "연구 일꾼", this.callbacks.hireResearchWorker));
    this.strategicActionButtons.set("use-instant-wave", this.createActionButton(500, 844, 164, 36, "즉시 웨이브", this.callbacks.useInstantWave));
    this.strategicActionButtons.set("age-up", this.createActionButton(681, 844, 164, 44, "시대 업", this.callbacks.ageUp));

    // capturePanelTitle/capturePanelBody/rosterText are kept alive but never
    // shown on screen — `apply()` is still called from LaneBattleScene and
    // writes into them, so the objects must keep existing as harmless no-ops
    // rather than forcing every call site to change.
    this.rosterText = this.scene.add.text(-1000, -1000, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#d8e7f6" }).setVisible(false);
    this.capturePanelTitle = this.scene.add.text(-1000, -1000, "", { fontFamily: "Georgia, serif", fontSize: "18px", color: "#f4e6c5" }).setVisible(false);
    this.capturePanelBody = this.scene.add.text(-1000, -1000, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#d8e7f6" }).setVisible(false);

    this.captureActionButtons.set("rebuild-defense-tower", this.createActionButton(920, 708, 150, 32, "타워 재건", this.callbacks.rebuildDefenseTower));
    this.captureActionButtons.set("build-defense-tower", this.createActionButton(920, 748, 150, 32, "타워", this.callbacks.buildDefenseTower));
    this.captureActionButtons.set("build-supply-depot", this.createActionButton(920, 788, 150, 32, "병참", this.callbacks.buildSupplyDepot));
    this.captureActionButtons.set("build-mint", this.createActionButton(920, 828, 150, 32, "조달소", this.callbacks.buildMint));
    this.captureActionButtons.set("dismantle", this.createActionButton(920, 868, 150, 28, "폐기", this.callbacks.dismantle));
    this.devToggleButton = this.createActionButton(42, 846, 94, 34, "DEV OFF", this.callbacks.toggleDevMode);
    this.devResearchButton = this.createActionButton(42, 804, 94, 34, "연구 +25", this.callbacks.grantDevResearch);
    this.devResearchButton.rect.setVisible(false);
    this.devResearchButton.text.setVisible(false);

    this.playerBaseBar = this.scene.add.rectangle(304, 140, 180, 10, 0x58c5ff, 1).setOrigin(0, 0.5).setDepth(this.depth + 3);
    this.enemyBaseBar = this.scene.add.rectangle(1116, 140, 180, 10, 0xff7b7b, 1).setOrigin(0, 0.5).setDepth(this.depth + 3);
    this.scene.add.rectangle(304, 140, 180, 10, 0x000000, 0.14).setOrigin(0, 0.5).setStrokeStyle(2, 0x9cb1c8, 0.34).setDepth(this.depth + 2);
    this.scene.add.rectangle(1116, 140, 180, 10, 0x000000, 0.14).setOrigin(0, 0.5).setStrokeStyle(2, 0x9cb1c8, 0.34).setDepth(this.depth + 2);
    this.audioSettingsPanel = new AudioSettingsPanel(this.scene, { depth: this.depth + 60, onVisibilityChange: this.callbacks.onAudioSettingsVisibilityChange });
    if (audioDebugEnabled) {
      this.audioDebugText = this.scene.add.text(1160, 116, "", { fontFamily: "monospace", fontSize: "11px", color: "#d9f2ff", backgroundColor: "rgba(4, 13, 22, 0.84)", padding: { x: 9, y: 7 }, lineSpacing: 2 }).setDepth(this.depth + 50).setScrollFactor(0);
    }
    this.setDevMode(false);
  }

  private createWorkerRow(role: WorkerRole, x: number, y: number): WorkerUiRow {
    // No text label here — the icon is the same shared texture the top
    // resource bar uses for this resource, so it identifies the row on its
    // own without needing a redundant "금"/"목재"/etc. word next to it.
    this.scene.add.image(x, y, getWorkerIconKey(role)).setDisplaySize(18, 18).setDepth(this.depth + 2).setScrollFactor(0);
    const value = this.scene.add.text(x + 14, y, "0", { fontFamily: "monospace", fontSize: "13px", color: "#fff6dd" }).setOrigin(0, 0.5).setDepth(this.depth + 2).setScrollFactor(0);
    const minus = this.scene.add.circle(x + 42, y, 9, 0x283a55, 0.95).setStrokeStyle(1, 0x7ea0c9).setDepth(this.depth + 2).setScrollFactor(0);
    const plus = this.scene.add.circle(x + 64, y, 9, 0x283a55, 0.95).setStrokeStyle(1, 0x7ea0c9).setDepth(this.depth + 2).setScrollFactor(0);
    this.scene.add.text(minus.x, minus.y - 1, "-", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    this.scene.add.text(plus.x, plus.y - 1, "+", { fontFamily: "sans-serif", fontSize: "12px", color: "#ffffff" }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    if (role !== "research" && role !== "idle") {
      minus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.shiftWorker(role, -1));
      plus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.shiftWorker(role, 1));
    }
    return { value, plus, minus };
  }

  private createActionButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void): ActionButton {
    const rect = this.scene.add.rectangle(x + width / 2, y + height / 2, width, height, 0x1d2d47, 0.95).setStrokeStyle(2, 0xd6b979, 0.65).setDepth(this.depth + 2).setScrollFactor(0);
    const text = this.scene.add.text(rect.x, rect.y - height * 0.2, label, { fontFamily: "sans-serif", fontSize: "12px", color: "#f3f7fb", align: "center" }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    const costIcons: Phaser.GameObjects.Image[] = [];
    const costTexts: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < MAX_COST_ITEMS; i += 1) {
      costIcons.push(this.scene.add.image(0, 0, "icon-gold").setDisplaySize(17, 17).setDepth(this.depth + 3).setScrollFactor(0).setVisible(false));
      costTexts.push(this.scene.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "11px", color: "#d8e7f6" }).setOrigin(0, 0.5).setDepth(this.depth + 3).setScrollFactor(0).setVisible(false));
    }
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
    return { rect, text, costIcons, costTexts };
  }

  /**
   * Renders a cost as a row of icon+number pairs using the exact same
   * `getResourceIconKey` texture lookup as the top resource bar, instead of
   * a "10G 10W 10F" letter-abbreviation string — so a future icon redesign
   * only has to happen in one place and both stay in sync automatically.
   */
  private applyCostRow(button: ActionButton | undefined, cost: Partial<Record<ResourceId, number>>): void {
    if (!button) return;
    // Cost rows are refreshed on a separate pass from button visibility
    // (`refreshHudActionLabels()` runs after `apply()`), so re-check the
    // button's own visibility here instead of unconditionally showing —
    // otherwise a hidden capture-action button's cost icons would still
    // render, floating with no button behind them.
    const entries = button.rect.visible
      ? (Object.entries(cost) as [ResourceId, number][]).filter(([, amount]) => (amount ?? 0) > 0)
      : [];
    const itemWidth = 34;
    const rowWidth = entries.length * itemWidth;
    const startX = button.rect.x - rowWidth / 2 + itemWidth / 2;
    const y = button.rect.y + button.rect.height / 2 - 11;
    button.costIcons.forEach((icon, i) => {
      const costText = button.costTexts[i];
      const entry = entries[i];
      if (!entry) {
        icon.setVisible(false);
        costText.setVisible(false);
        return;
      }
      const [resourceId, amount] = entry;
      const itemX = startX + i * itemWidth;
      icon.setTexture(getResourceIconKey(resourceId)).setPosition(itemX - 9, y).setVisible(true);
      costText.setText(String(Math.round(amount))).setPosition(itemX + 1, y).setVisible(true);
    });
  }

  private setActionVisible(button: ActionButton, visible: boolean): void {
    button.rect.setVisible(visible);
    button.text.setVisible(visible);
    if (!visible) {
      button.costIcons.forEach((icon) => icon.setVisible(false));
      button.costTexts.forEach((costText) => costText.setVisible(false));
    }
    if (visible) {
      button.rect.setInteractive({ useHandCursor: true });
      button.text.disableInteractive();
    } else {
      button.rect.disableInteractive();
      button.text.disableInteractive();
    }
  }
}
