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
  minus?: Phaser.GameObjects.Arc;
  plus?: Phaser.GameObjects.Arc;
}

interface ActionButton {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  costIcons: Phaser.GameObjects.Image[];
  costTexts: Phaser.GameObjects.Text[];
}

/** Max distinct resources shown in a single button's cost row (gold/wood/food/metal/research). */
const MAX_COST_ITEMS = 5;

/** Horizontal gap between the selected structure and its action menu. */
const CAPTURE_MENU_GAP_X = 150;
/** Keep the action menu this far from the screen edges. */
const CAPTURE_MENU_SCREEN_MARGIN = 24;
/** Top of the playable area, below the resource bar. */
const CAPTURE_MENU_TOP_LIMIT = 168;

type StrategicActionId = "hire-worker" | "hire-research-worker" | "use-instant-wave" | "age-up";

interface InfoMessageOptions {
  color?: string;
}

/**
 * Screen rows the HUD occupies, in game units.
 *
 * The battle scene needs these to tell a press on the HUD from a tap on open
 * ground. It used to carry its own guesses -- 250 and 640 -- which drifted from
 * what the HUD actually draws: the top guess reached 94 units past the last HUD
 * pixel, leaving a strip below the panel where taps did nothing at all.
 *
 * Measured from the drawn objects rather than derived from the art scale, since
 * the interactive controls extend past the painted frame. `hud-bands.spec.ts`
 * re-measures and fails if either number stops covering the HUD.
 */
const HUD_TOP_BAND_BOTTOM = 156;
const HUD_BOTTOM_BAND_TOP = 660;

const HUD_SOURCE_WIDTH = 1672;
const HUD_TOP_SOURCE_HEIGHT = 160;
const HUD_BOTTOM_SOURCE_HEIGHT = 220;
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
  private readonly resourceBarXs: number[] = [];
  private readonly workerRows = new Map<WorkerRole, WorkerUiRow>();
  private readonly captureActionButtons = new Map<CapturePointAction | DefenseTowerAction, ActionButton>();
  /** Fallback anchor for the capture-action stack (used when nothing on the
   * field is selected) and the spacing between its slots. */
  private captureActionOriginX = 0;
  private captureActionOriginY = 0;
  private captureActionGapY = 56;
  /** Screen position of the selected structure, if any; see
   * `setCaptureActionAnchor`. */
  private captureActionAnchor: { x: number; y: number } | null = null;
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
  private workerSummaryText?: Phaser.GameObjects.Text;
  private researchSummaryText?: Phaser.GameObjects.Text;
  private audioDebugText?: Phaser.GameObjects.Text;
  private networkStatusText?: Phaser.GameObjects.Text;
  private networkStatus = "";
  private audioSettingsPanel!: AudioSettingsPanel;
  private devToggleButton?: ActionButton;
  private devResearchButton?: ActionButton;
  private devToolsVisible = true;
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
   *
   * Every call spawns a new fading object, so this may only be called on
   * discrete events. Calling it from a per-frame path stacks a new toast every
   * frame — see `setNetworkStatus` for the standing-condition case.
   */
  setInfo(text: string, options: InfoMessageOptions = {}): void {
    if (!text) return;
    const toast = this.scene.add.text(672, 676, text, {
      fontFamily: "sans-serif",
      fontSize: "20px",
      color: options.color ?? "#f4e6c5",
      stroke: "#132033",
      strokeThickness: 4,
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

  /**
   * A standing condition rather than an event: waiting for the opponent,
   * reconnecting, desynced. One persistent line that is set and cleared, not a
   * toast — network state is evaluated every frame, and routing it through
   * `setInfo` created a fresh Text object per frame. Those piled up into a
   * permanently visible smear that never disappeared when the stall ended, and
   * each one forced a canvas re-raster.
   *
   * Passing an empty string (or null) clears it.
   */
  setNetworkStatus(text: string | null, options: InfoMessageOptions = {}): void {
    const next = text ?? "";
    if (next === this.networkStatus) return; // Restyling a Text re-rasterises it.
    this.networkStatus = next;
    if (!next) {
      this.networkStatusText?.setVisible(false);
      return;
    }
    if (!this.networkStatusText) {
      this.networkStatusText = this.scene.add.text(this.canvasWidth / 2, 168, "", {
        fontFamily: "sans-serif",
        fontSize: "22px",
        color: "#f4e6c5",
        stroke: "#132033",
        strokeThickness: 5,
        align: "center",
      }).setOrigin(0.5, 0).setDepth(this.depth + 32).setScrollFactor(0);
      this.scene.cameras.main.ignore(this.networkStatusText);
    }
    this.networkStatusText.setText(next).setColor(options.color ?? "#f4e6c5").setVisible(true);
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
      row.minus?.setFillStyle(worker.canDecrease ? 0x324a73 : 0x1d2634, 0.96);
      row.plus?.setFillStyle(worker.canIncrease ? 0x324a73 : 0x1d2634, 0.96);
    });
    this.workerSummaryText?.setText(`${snapshot.idleWorkersText} / ${snapshot.assignedWorkersText}`);
    this.researchSummaryText?.setText(`연구 ${snapshot.researchWorkersText}`);
    this.playerBaseBar.width = 180 * snapshot.playerBaseRatio;
    this.enemyBaseBar.width = 180 * snapshot.enemyBaseRatio;
    this.playerBaseBar.setOrigin(0, 0.5);
    this.enemyBaseBar.setOrigin(0, 0.5);
    this.rosterText.setVisible(false);
    this.layoutCaptureActions(actions);
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
    const x = this.resourceBarXs[index] ?? (this.canvasWidth / 2);
    const popup = this.scene.add.text(x + 62, 72, `+${delta}`, {
      fontFamily: "Georgia, serif",
      fontSize: "25px",
      color: resourceId === "research" ? "#9df2ff" : "#8dffa8",
      stroke: "#08150c",
      strokeThickness: 4,
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

  /**
   * Screen-space rectangles of the HUD action buttons.
   *
   * Validation specs used to hardcode button coordinates, so every HUD layout
   * change silently broke them — they kept clicking empty space and then
   * failed on an unrelated assertion further down. Reading the real positions
   * keeps a spec honest about clicking the actual button while surviving
   * layout changes.
   */
  getActionButtonLayout(): Record<string, { x: number; y: number; width: number; height: number; visible: boolean }> {
    const layout: Record<string, { x: number; y: number; width: number; height: number; visible: boolean }> = {};
    const record = (id: string, button: ActionButton): void => {
      layout[id] = {
        x: button.rect.x,
        y: button.rect.y,
        width: button.rect.width,
        height: button.rect.height,
        visible: button.rect.visible,
      };
    };
    this.strategicActionButtons.forEach((button, id) => record(id, button));
    this.captureActionButtons.forEach((button, id) => record(id, button));
    return layout;
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

  setCaptureActionEnabled(actionId: CapturePointAction | DefenseTowerAction, enabled: boolean): void {
    const button = this.captureActionButtons.get(actionId);
    if (!button) return;
    button.rect.setFillStyle(enabled ? 0x1d2d47 : 0x3b2222, enabled ? 0.95 : 0.92);
    button.rect.setStrokeStyle(2, enabled ? 0xd6b979 : 0xd07c7c, enabled ? 0.65 : 0.8);
    button.text.setColor(enabled ? "#f3f7fb" : "#ffd4d4");
  }

  setDevMode(active: boolean): void {
    if (!this.devToggleButton || !this.devResearchButton) return;
    if (!this.devToolsVisible) {
      this.devToggleButton.rect.setVisible(false);
      this.devToggleButton.text.setVisible(false);
      this.devResearchButton.rect.setVisible(false);
      this.devResearchButton.text.setVisible(false);
      this.devToggleButton.rect.disableInteractive();
      this.devResearchButton.rect.disableInteractive();
      return;
    }
    this.devToggleButton.rect.setFillStyle(active ? 0x27503f : 0x3b2a2a, 0.96);
    this.devToggleButton.rect.setStrokeStyle(2, active ? 0x9fe3c4 : 0xd79b9b, 0.75);
    this.devToggleButton.rect.setVisible(true);
    this.devToggleButton.text.setVisible(true);
    this.devToggleButton.text.setText(active ? "DEV ON" : "DEV OFF");
    this.devToggleButton.text.setColor(active ? "#eafff2" : "#ffe3e3");
    this.devResearchButton.rect.setVisible(active);
    this.devResearchButton.text.setVisible(active);
    this.devToggleButton.rect.setInteractive({ useHandCursor: true });
    if (active) {
      this.devResearchButton.rect.setInteractive({ useHandCursor: true });
    } else {
      this.devResearchButton.rect.disableInteractive();
    }
  }

  setDevToolsVisible(visible: boolean): void {
    this.devToolsVisible = visible;
    this.setDevMode(this.devToggleButton?.text.text === "DEV ON");
  }

  /**
   * The two screen bands the HUD owns. Anything outside them is battlefield.
   *
   * One source of truth for both drawing and hit-testing: the scene asking the
   * HUD where it is beats the scene remembering.
   */
  getUiBands(): { topBelow: number; bottomAbove: number } {
    return { topBelow: HUD_TOP_BAND_BOTTOM, bottomAbove: HUD_BOTTOM_BAND_TOP };
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
    const centerX = this.canvasWidth / 2;
    const uiScale = 1.24;
    this.scene.add.image(0, 0, "war-table-hud").setOrigin(0, 0).setScale(hudScale).setCrop(0, 0, HUD_SOURCE_WIDTH, HUD_TOP_SOURCE_HEIGHT).setDepth(this.depth).setScrollFactor(0).setAlpha(0.18);
    this.scene.add.image(0, this.canvasHeight - bottomHeight, "war-table-hud").setOrigin(0, 0).setScale(hudScale).setCrop(0, 721, HUD_SOURCE_WIDTH, HUD_BOTTOM_SOURCE_HEIGHT).setDepth(this.depth).setScrollFactor(0);
    this.scene.add.rectangle(centerX, 82, this.canvasWidth - 32, 148, 0x081119, 0.84)
      .setStrokeStyle(2, 0x233448, 0.54)
      .setDepth(this.depth + 1)
      .setScrollFactor(0);
    this.scene.add.rectangle(centerX, 28, this.canvasWidth - 72, 2, 0x557aa6, 0.28)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    this.scene.add.rectangle(centerX, 136, this.canvasWidth - 72, 2, 0xd0b073, 0.16)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    this.scene.add.rectangle(184, 82, 290, 124, 0x0b1621, 0.86)
      .setStrokeStyle(2, 0x476786, 0.42)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    this.ageText = this.scene.add.text(54, 38, "", { fontFamily: "sans-serif", fontSize: "19px", color: "#dce8f4" }).setDepth(this.depth + 3).setScrollFactor(0);
    this.waveText = this.scene.add.text(54, 64, "", { fontFamily: "sans-serif", fontSize: "19px", color: "#dce8f4" }).setDepth(this.depth + 3).setScrollFactor(0);
    this.baseText = this.scene.add.text(54, 90, "", { fontFamily: "sans-serif", fontSize: "19px", color: "#dce8f4" }).setDepth(this.depth + 3).setScrollFactor(0);
    this.tokensText = this.scene.add.text(54, 116, "", { fontFamily: "sans-serif", fontSize: "19px", color: "#f1d891" }).setDepth(this.depth + 3).setScrollFactor(0);

    this.scene.add.rectangle(centerX + 98, 82, 1088, 92, 0x09131d, 0.64)
      .setStrokeStyle(1, 0x3f556f, 0.3)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    const resourceBoxWidth = 190;
    const resourceGap = 18;
    const resourceTotalWidth = resourceBoxWidth * MVP_ACTIVE_RESOURCE_IDS.length + resourceGap * (MVP_ACTIVE_RESOURCE_IDS.length - 1);
    const resourceStartX = centerX + 90 - resourceTotalWidth / 2 + resourceBoxWidth / 2;
    this.resourceBarXs.length = 0;
    MVP_ACTIVE_RESOURCE_IDS.forEach((resourceId, index) => {
      const resourceX = resourceStartX + index * (resourceBoxWidth + resourceGap);
      this.resourceBarXs.push(resourceX);
      this.scene.add.rectangle(resourceX, 82, resourceBoxWidth, 72, 0x101c28, 0.84)
        .setStrokeStyle(1, resourceId === "research" ? 0x63a9bb : 0x5c6f88, 0.42)
        .setDepth(this.depth + 3)
        .setScrollFactor(0);
      this.scene.add.image(resourceX - 60, 82, getResourceIconKey(resourceId)).setDisplaySize(36, 36).setAlpha(0.98).setDepth(this.depth + 4).setScrollFactor(0);
      this.resourceLabelTexts.set(
        resourceId,
        this.scene.add.text(resourceX - 2, 58, getResource(resourceId).label, {
          fontFamily: "sans-serif",
          fontSize: "18px",
          color: resourceId === "research" ? "#b9f2ff" : "#aac1db",
        }).setDepth(this.depth + 4).setScrollFactor(0).setOrigin(0.5, 0.5),
      );
      this.resourceTexts.set(resourceId, this.scene.add.text(resourceX + 6, 94, "", {
        fontFamily: "Georgia, serif",
        fontSize: resourceId === "research" ? "38px" : "42px",
        color: resourceId === "research" ? "#d2fbff" : "#f5fbff",
      }).setDepth(this.depth + 4).setScrollFactor(0).setOrigin(0.5, 0.5));
    });

    // Worker panel + hire/instant-wave/age-up buttons live in the bottom-center
    // zone that used to show the tower/capture info panel and status text —
    // that panel was removed as redundant (the same info is available by
    // touching the structure directly), so this space now hosts the actions
    // the player needs most often instead of sitting empty.
    const workerTitleY = this.canvasHeight - 236;
    this.scene.add.text(centerX, workerTitleY, "일꾼 배치", {
      fontFamily: "Georgia, serif",
      fontSize: `${Math.round(16 * uiScale)}px`,
      color: "#f4e6c5",
    }).setDepth(this.depth + 3).setScrollFactor(0).setOrigin(0.5, 0);
    this.workerSummaryText = this.scene.add.text(centerX + 118, workerTitleY + 8, "0 / 0", {
      fontFamily: "Georgia, serif",
      fontSize: `${Math.round(18 * uiScale)}px`,
      color: "#fff6dd",
    }).setOrigin(0, 0.5).setDepth(this.depth + 3).setScrollFactor(0);
    const rowLeftX = centerX - 176;
    const rowRightX = centerX + 46;
    const topRowY = this.canvasHeight - 186;
    const rowGapY = 30;
    this.workerRows.set("gold", this.createWorkerRow("gold", rowLeftX, topRowY));
    this.workerRows.set("wood", this.createWorkerRow("wood", rowRightX, topRowY));
    this.workerRows.set("food", this.createWorkerRow("food", rowLeftX, topRowY + rowGapY));
    this.workerRows.set("metal", this.createWorkerRow("metal", rowRightX, topRowY + rowGapY));
    this.workerRows.set("research", this.createWorkerRow("research", rowLeftX, topRowY + rowGapY * 2));
    this.researchSummaryText = this.scene.add.text(-1000, -1000, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#fff6dd",
    }).setVisible(false).setOrigin(0, 0.5).setDepth(this.depth + 3).setScrollFactor(0);

    this.strategicActionButtons.set("hire-worker", this.createActionButton(centerX - 182, this.canvasHeight - 104, 198, 44, "일꾼 고용", this.callbacks.hireWorker));
    this.strategicActionButtons.set("hire-research-worker", this.createActionButton(centerX + 36, this.canvasHeight - 104, 198, 44, "연구 일꾼", this.callbacks.hireResearchWorker));
    this.strategicActionButtons.set("use-instant-wave", this.createActionButton(centerX - 182, this.canvasHeight - 48, 198, 44, "즉시 웨이브", this.callbacks.useInstantWave));
    this.strategicActionButtons.set("age-up", this.createActionButton(centerX + 36, this.canvasHeight - 48, 198, 44, "시대 업", this.callbacks.ageUp));

    // capturePanelTitle/capturePanelBody/rosterText are kept alive but never
    // shown on screen — `apply()` is still called from LaneBattleScene and
    // writes into them, so the objects must keep existing as harmless no-ops
    // rather than forcing every call site to change.
    this.rosterText = this.scene.add.text(-1000, -1000, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#d8e7f6" }).setVisible(false);
    this.capturePanelTitle = this.scene.add.text(-1000, -1000, "", { fontFamily: "Georgia, serif", fontSize: "18px", color: "#f4e6c5" }).setVisible(false);
    this.capturePanelBody = this.scene.add.text(-1000, -1000, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#d8e7f6" }).setVisible(false);

    const captureActionX = centerX + 256;
    const captureActionY = this.canvasHeight - 212;
    const captureActionGapY = 56;
    this.captureActionOriginX = captureActionX;
    this.captureActionOriginY = captureActionY;
    this.captureActionGapY = captureActionGapY;
    const captureActionWidth = 198;
    const captureActionHeight = 44;
    this.captureActionButtons.set("rebuild-defense-tower", this.createActionButton(captureActionX, captureActionY, captureActionWidth, captureActionHeight, "타워 재건", this.callbacks.rebuildDefenseTower));
    this.captureActionButtons.set("build-defense-tower", this.createActionButton(captureActionX, captureActionY + captureActionGapY, captureActionWidth, captureActionHeight, "타워", this.callbacks.buildDefenseTower));
    this.captureActionButtons.set("build-supply-depot", this.createActionButton(captureActionX, captureActionY + captureActionGapY * 2, captureActionWidth, captureActionHeight, "병참", this.callbacks.buildSupplyDepot));
    this.captureActionButtons.set("build-mint", this.createActionButton(captureActionX, captureActionY + captureActionGapY * 3, captureActionWidth, captureActionHeight, "조달소", this.callbacks.buildMint));
    this.captureActionButtons.set("dismantle", this.createActionButton(captureActionX, captureActionY + captureActionGapY * 4, captureActionWidth, captureActionHeight, "폐기", this.callbacks.dismantle));
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
    this.scene.add.image(x, y, getWorkerIconKey(role))
      .setDisplaySize(20, 20)
      .setDepth(this.depth + 3)
      .setScrollFactor(0);
    const value = this.scene.add.text(x + 16, y, "0", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#fff6dd",
    }).setOrigin(0, 0.5).setDepth(this.depth + 3).setScrollFactor(0);
    if (role === "research" || role === "idle") {
      return { value };
    }
    const minus = this.scene.add.circle(x + 56, y, 11, 0x283a55, 0.95)
      .setStrokeStyle(1, 0x7ea0c9)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    const plus = this.scene.add.circle(x + 84, y, 11, 0x283a55, 0.95)
      .setStrokeStyle(1, 0x7ea0c9)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    this.scene.add.text(minus.x, minus.y - 1, "-", { fontFamily: "sans-serif", fontSize: "14px", color: "#ffffff" })
      .setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    this.scene.add.text(plus.x, plus.y - 1, "+", { fontFamily: "sans-serif", fontSize: "14px", color: "#ffffff" })
      .setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    minus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.shiftWorker(role, -1));
    plus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.shiftWorker(role, 1));
    return { value, minus, plus };
  }

  private createActionButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void): ActionButton {
    const rect = this.scene.add.rectangle(x + width / 2, y + height / 2, width, height, 0x1d2d47, 0.95).setStrokeStyle(2, 0xd6b979, 0.65).setDepth(this.depth + 2).setScrollFactor(0);
    const text = this.scene.add.text(rect.x, rect.y - height * 0.18, label, { fontFamily: "sans-serif", fontSize: "14px", color: "#f3f7fb", align: "center" }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    const costIcons: Phaser.GameObjects.Image[] = [];
    const costTexts: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < MAX_COST_ITEMS; i += 1) {
      costIcons.push(this.scene.add.image(0, 0, "icon-gold").setDisplaySize(17, 17).setDepth(this.depth + 3).setScrollFactor(0).setVisible(false));
      costTexts.push(this.scene.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "12px", color: "#d8e7f6" }).setOrigin(0, 0.5).setDepth(this.depth + 3).setScrollFactor(0).setVisible(false));
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
    const itemWidth = 42;
    const rowWidth = entries.length * itemWidth;
    const startX = button.rect.x - rowWidth / 2 + itemWidth / 2;
    const y = button.rect.y + button.rect.height / 2 - 14;
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

  /**
   * Screen position of the structure whose actions are being shown, so the
   * action buttons can appear next to it instead of in a fixed corner. Pass
   * `null` when nothing is selected.
   */
  setCaptureActionAnchor(anchor: { x: number; y: number } | null): void {
    this.captureActionAnchor = anchor;
  }

  /**
   * Shows the available capture actions as a stack beside the selected
   * structure, packed into consecutive slots and kept fully on screen.
   *
   * Two things are deliberate here. Actions pack from the top of the stack
   * because at most three of the five are ever offered at once — with a fixed
   * slot each, the last one ("폐기") sat at y=934 in a 900px viewport and was
   * literally unclickable. And the whole stack is clamped inside the playable
   * area rather than simply following the structure, because a menu that
   * tracks a structure near the screen edge reintroduces exactly that bug.
   */
  private layoutCaptureActions(actions: readonly (CapturePointAction | DefenseTowerAction)[]): void {
    const visible: ActionButton[] = [];
    this.captureActionButtons.forEach((button, action) => {
      const isVisible = actions.includes(action);
      this.setActionVisible(button, isVisible);
      if (isVisible) visible.push(button);
    });
    if (visible.length === 0) return;

    const width = visible[0].rect.width;
    const height = visible[0].rect.height;
    const stackHeight = (visible.length - 1) * this.captureActionGapY + height;
    const anchor = this.captureActionAnchor;

    let centerX = this.captureActionOriginX + width / 2;
    let top = this.captureActionOriginY;
    if (anchor) {
      // Prefer the side of the structure with more room, so the menu does not
      // cover the structure the player just clicked.
      const towardRight = anchor.x < this.canvasWidth * 0.6;
      centerX = anchor.x + (towardRight ? CAPTURE_MENU_GAP_X : -CAPTURE_MENU_GAP_X);
      top = anchor.y - stackHeight / 2;
    }

    const minX = CAPTURE_MENU_SCREEN_MARGIN + width / 2;
    const maxX = this.canvasWidth - CAPTURE_MENU_SCREEN_MARGIN - width / 2;
    const minY = CAPTURE_MENU_TOP_LIMIT;
    const maxY = this.canvasHeight - this.bottomHudHeight() - CAPTURE_MENU_SCREEN_MARGIN - stackHeight;
    centerX = Phaser.Math.Clamp(centerX, minX, Math.max(minX, maxX));
    top = Phaser.Math.Clamp(top, minY, Math.max(minY, maxY));

    visible.forEach((button, slot) => {
      const targetY = top + this.captureActionGapY * slot + height / 2;
      button.text.x += centerX - button.rect.x;
      button.text.y += targetY - button.rect.y;
      button.rect.setPosition(centerX, targetY);
    });
  }

  /**
   * Whether a screen point lands on a visible action button.
   *
   * The scene's "is this pointer on UI" test is a coarse top/bottom band, which
   * stopped covering the capture-action buttons once they moved next to the
   * selected structure — so clicking "build" registered as a tap on empty
   * ground and dropped the selection the button belonged to.
   */
  isPointerOverActionButton(x: number, y: number): boolean {
    const hit = (button: ActionButton): boolean => {
      if (!button.rect.visible) return false;
      return Math.abs(x - button.rect.x) <= button.rect.width / 2
        && Math.abs(y - button.rect.y) <= button.rect.height / 2;
    };
    let over = false;
    this.captureActionButtons.forEach((button) => { over = over || hit(button); });
    this.strategicActionButtons.forEach((button) => { over = over || hit(button); });
    return over;
  }

  private bottomHudHeight(): number {
    return HUD_BOTTOM_SOURCE_HEIGHT * (this.canvasWidth / HUD_SOURCE_WIDTH);
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
