import Phaser from "phaser";
import { MVP_ACTIVE_RESOURCE_IDS } from "../data/balance";
import type { CapturePointAction } from "../data/capturePointDefinitions";
import type { DefenseTowerAction } from "../data/defenseTowerDefinitions";
import { getResource, type ResourceId } from "../data/resources";
import type { AudioSystem } from "../systems/audio/audioSystem";
import type { WorkerRole } from "../systems/lane-economy/laneEconomy";
import { AudioSettingsPanel } from "./AudioSettingsPanel";
import {
  UI_FRAME_CORNER,
  getUiFrameKey,
  getUiIconKey,
  type UiFrameId,
  type UiIconId,
} from "../presentation/ui/uiChromeRegistry";
import {
  HUD_TOP_BAND_BOTTOM,
  atLeastTouchable,
  hudBottomBandTop,
  measureScreen,
  type ScreenMetrics,
} from "./screenLayout";
import {
  getResourceIconKey,
  getWorkerIconKey,
  type LaneBattleHudSnapshot,
} from "./laneBattleHudModel";

interface WorkerUiRow {
  value: Phaser.GameObjects.Text;
  minus?: Phaser.GameObjects.Arc;
  plus?: Phaser.GameObjects.Arc;
  /** Every object the row drew, so the row can be shown or hidden as a unit. */
  objects: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible)[];
}

interface ActionButton {
  /**
   * The drawn frame. Separate from `rect`, which stays as an invisible hit
   * area: Phaser's nine-slice is not an input target, and keeping the two apart
   * means the interaction wiring did not have to change.
   */
  frame: Phaser.GameObjects.NineSlice;
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  costIcons: Phaser.GameObjects.Image[];
  costTexts: Phaser.GameObjects.Text[];
  /** Tracked so hover does not light up a button that cannot be pressed. */
  enabled?: boolean;
  /** Present on icon buttons; shown and hidden with the frame. */
  icon?: Phaser.GameObjects.Image;
  /** What the icon stands for, for anything that needs to name it. */
  label?: string;
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
 * Bottom band while the worker rows are showing.
 *
 * The top band and the folded bottom band live in `screenLayout`, because the
 * camera needs them before this view exists. `hud-bands.spec.ts` re-measures the
 * drawn objects and fails if any of these stop covering the HUD.
 */
const HUD_BOTTOM_BAND_TOP_EXPANDED = 660;
/**
 * Bottom band with the worker rows folded away.
 *
 * Folding them is what buys the space back: the rows are the tallest thing in
 * the bottom band and the least often touched, so collapsing them hands 130
 * units of screen -- 56 CSS pixels on a phone -- back to the battlefield.
 */
const HUD_BOTTOM_BAND_TOP_COLLAPSED = 790;

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
  /** Set once the button height is known; see `create`. */
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
  private workerPanelTitle?: Phaser.GameObjects.Text;
  private workerChip?: ActionButton;
  /**
   * Worker allocation starts folded.
   *
   * It is set once and then rarely revisited, while occupying more of the
   * bottom band than anything else -- the wrong trade for a permanent fixture,
   * and an impossible one on a phone, where the whole HUD has room for three
   * rows of touch-sized controls.
   */
  private workerPanelOpen = false;
  /**
   * How big the screen actually is, in the units a finger works in.
   *
   * Taken from the canvas rather than from the game's own 1600x900 space: those
   * two are the same thing only on a desktop monitor, and the difference is the
   * whole reason a 44-unit button is untappable on a phone.
   */
  private readonly metrics: ScreenMetrics;
  /** Bottom band top for each fold state, computed from the laid-out controls. */
  private bandTopCollapsed = HUD_BOTTOM_BAND_TOP_COLLAPSED;
  private bandTopExpanded = HUD_BOTTOM_BAND_TOP_EXPANDED;
  private actionRowBottomY = 0;
  private actionButtonHeight = 44;
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
    this.metrics = measureScreen(scene.scale.displaySize.width, scene.scale.displaySize.height);
    this.create(audioDebugEnabled);
    // Built visible, then folded, so the fold path is the only one that has to
    // know which objects belong to the rows.
    this.workerRows.forEach((row) => row.objects.forEach((object) => object.setVisible(false)));
    this.workerPanelTitle?.setVisible(false);
    this.workerSummaryText?.setVisible(false);
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
      fontSize: this.textPx(20),
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
        fontSize: this.textPx(22),
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
    // The chip is the only worker readout while the rows are folded, so it
    // carries the same figures rather than a bare icon.
    this.workerChip?.text.setText(`일꾼 ${snapshot.idleWorkersText}/${snapshot.assignedWorkersText}`);
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
      fontSize: this.textPx(25),
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
      .filter(([, button]) => button.frame.visible && button.text.visible)
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
        visible: button.frame.visible,
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
    button.enabled = enabled;
    this.setActionFrame(button, enabled ? "button" : "button-danger");
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
    button.enabled = enabled;
    this.setActionFrame(button, enabled ? "button" : "button-danger");
    button.text.setColor(enabled ? "#f3f7fb" : "#ffd4d4");
  }

  setDevMode(active: boolean): void {
    if (!this.devToggleButton || !this.devResearchButton) return;
    if (!this.devToolsVisible) {
      this.devToggleButton.frame.setVisible(false);
      this.devToggleButton.rect.setVisible(false);
      this.devToggleButton.text.setVisible(false);
      this.devResearchButton.frame.setVisible(false);
      this.devResearchButton.rect.setVisible(false);
      this.devResearchButton.text.setVisible(false);
      this.devToggleButton.rect.disableInteractive();
      this.devResearchButton.rect.disableInteractive();
      return;
    }
    this.setActionFrame(this.devToggleButton, active ? "button-hover" : "button");
    this.devToggleButton.frame.setVisible(true);
    this.devToggleButton.rect.setVisible(true);
    this.devToggleButton.text.setVisible(true);
    this.devToggleButton.text.setText(active ? "DEV ON" : "DEV OFF");
    this.devToggleButton.text.setColor(active ? "#eafff2" : "#ffe3e3");
    this.devResearchButton.frame.setVisible(active);
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
    return {
      topBelow: HUD_TOP_BAND_BOTTOM,
      bottomAbove: this.workerPanelOpen ? this.bandTopExpanded : this.bandTopCollapsed,
    };
  }

  /**
   * Every screen rectangle the HUD currently occupies.
   *
   * Regions rather than two fixed bands because the HUD changes shape: a panel
   * that folds open reaches into what was battlefield a moment earlier, and a
   * press there has to count as a press on the HUD. Getting that wrong is what
   * closed the research panel underneath its own buttons.
   */
  getUiRegions(): { left: number; top: number; right: number; bottom: number }[] {
    const bands = this.getUiBands();
    return [
      { left: 0, top: 0, right: this.canvasWidth, bottom: bands.topBelow },
      { left: 0, top: bands.bottomAbove, right: this.canvasWidth, bottom: this.canvasHeight },
    ];
  }

  isPointerOverUi(x: number, y: number): boolean {
    return this.getUiRegions().some(
      (region) => x >= region.left && x <= region.right && y >= region.top && y <= region.bottom,
    );
  }

  private setWorkerPanelOpen(open: boolean): void {
    if (this.workerPanelOpen === open) return;
    this.workerPanelOpen = open;
    this.workerRows.forEach((row) => row.objects.forEach((object) => object.setVisible(open)));
    this.workerPanelTitle?.setVisible(open);
    this.workerSummaryText?.setVisible(open);
    this.audio.playSfx(open ? "sfx.ui.buildSelect" : "sfx.ui.cancel", { eventKey: `hud:workers:${open}` });
  }

  /** Folds the worker rows away; called when the player touches the field. */
  closeWorkerPanel(): void {
    this.setWorkerPanelOpen(false);
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

  /**
   * Bottom-anchored geometry for the action rows, worked out before anything is
   * placed.
   *
   * `atLeastTouchable` returns 44 on a desktop -- the height these buttons
   * already were, so that layout is untouched -- and about 102 on a phone, where
   * 44 units reach the screen as 19 pixels. Anchoring to the bottom edge rather
   * than to fixed offsets is what lets the height change without the rows
   * walking off the screen.
   */
  /**
   * A font size that survives the screen it lands on.
   *
   * Returns the requested size on a desktop, where a game unit is a CSS pixel,
   * and raises it on a phone, where 12 units reach the eye as 5 pixels. Same
   * shape as `atLeastTouchable`: ask for what the design wants, get at least
   * what is legible.
   */
  private textPx(baseUnits: number): string {
    // Rounded up: rounding to nearest lands a unit short of the floor and the
    // text measures 10.8 CSS px against an 11px minimum, which is a fail for no
    // reason anyone can see.
    return `${Math.ceil(Math.max(baseUnits, this.metrics.minBodyTextUnits))}px`;
  }

  private computeActionGeometry(): void {
    // Four, not a round number: it reproduces the desktop layout exactly, so
    // this change is invisible on a monitor and only phones move.
    const bottomMargin = 4;
    this.actionButtonHeight = atLeastTouchable(this.metrics, 44);
    this.actionRowBottomY = this.canvasHeight - bottomMargin - this.actionButtonHeight;
    // The band has to start above the tallest thing in it, whatever that is now.
    this.bandTopCollapsed = hudBottomBandTop(this.metrics, false);
  }

  private create(audioDebugEnabled: boolean): void {
    this.computeActionGeometry();
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
    this.ageText = this.scene.add.text(54, 38, "", { fontFamily: "sans-serif", fontSize: this.textPx(19), color: "#dce8f4" }).setDepth(this.depth + 3).setScrollFactor(0);
    this.waveText = this.scene.add.text(54, 64, "", { fontFamily: "sans-serif", fontSize: this.textPx(19), color: "#dce8f4" }).setDepth(this.depth + 3).setScrollFactor(0);
    this.baseText = this.scene.add.text(54, 90, "", { fontFamily: "sans-serif", fontSize: this.textPx(19), color: "#dce8f4" }).setDepth(this.depth + 3).setScrollFactor(0);
    this.tokensText = this.scene.add.text(54, 116, "", { fontFamily: "sans-serif", fontSize: this.textPx(19), color: "#f1d891" }).setDepth(this.depth + 3).setScrollFactor(0);

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
          fontSize: this.textPx(18),
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
    this.workerPanelTitle = this.scene.add.text(centerX, workerTitleY, "일꾼 배치", {
      fontFamily: "Georgia, serif",
      fontSize: this.textPx(Math.round(16 * uiScale)),
      color: "#f4e6c5",
    }).setDepth(this.depth + 3).setScrollFactor(0).setOrigin(0.5, 0);
    this.workerSummaryText = this.scene.add.text(centerX + 118, workerTitleY + 8, "0 / 0", {
      fontFamily: "Georgia, serif",
      fontSize: this.textPx(Math.round(18 * uiScale)),
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
    // Placed on the same row as the hire buttons on purpose: the folded state
    // has to be genuinely shorter, and a chip left where the rows were would
    // give the band back nothing.
    this.researchSummaryText = this.scene.add.text(-1000, -1000, "", {
      fontFamily: "monospace",
      fontSize: this.textPx(18),
      color: "#fff6dd",
    }).setVisible(false).setOrigin(0, 0.5).setDepth(this.depth + 3).setScrollFactor(0);

    // Narrower than before. Height is held at the touch floor because that is
    // what a finger needs, but the width was well past it -- 198 units is 86 CSS
    // px on a phone -- and the block read as heavy for its content.
    // One row of square icon buttons along the bottom.
    //
    // These were four labelled buttons stacked two deep, which on a phone spent
    // two of the three rows the whole HUD has. An icon says the same thing in a
    // square, and the row it saves goes back to the battlefield.
    const iconSize = this.actionButtonHeight;
    const iconGap = 10;
    const strategic: [StrategicActionId, UiIconId, string, () => void][] = [
      ["hire-worker", "hire-worker", "일꾼 고용", this.callbacks.hireWorker],
      ["hire-research-worker", "hire-research-worker", "연구 일꾼", this.callbacks.hireResearchWorker],
      ["use-instant-wave", "use-instant-wave", "즉시 웨이브", this.callbacks.useInstantWave],
      ["age-up", "age-up", "시대 업", this.callbacks.ageUp],
    ];
    // Right-aligned: the left of the bottom band holds the dev controls, and
    // the player's own keep sits behind that corner of the field.
    const rowWidth = (strategic.length + 1) * iconSize + strategic.length * iconGap;
    let iconX = this.canvasWidth - 24 - rowWidth;
    this.workerChip = this.createIconButton(
      iconX, this.actionRowBottomY, iconSize, "workers", "일꾼 배치",
      () => this.setWorkerPanelOpen(!this.workerPanelOpen),
    );
    iconX += iconSize + iconGap;
    for (const [id, icon, label, handler] of strategic) {
      this.strategicActionButtons.set(id, this.createIconButton(iconX, this.actionRowBottomY, iconSize, icon, label, handler));
      iconX += iconSize + iconGap;
    }

    // capturePanelTitle/capturePanelBody/rosterText are kept alive but never
    // shown on screen — `apply()` is still called from LaneBattleScene and
    // writes into them, so the objects must keep existing as harmless no-ops
    // rather than forcing every call site to change.
    this.rosterText = this.scene.add.text(-1000, -1000, "", { fontFamily: "sans-serif", fontSize: this.textPx(13), color: "#d8e7f6" }).setVisible(false);
    this.capturePanelTitle = this.scene.add.text(-1000, -1000, "", { fontFamily: "Georgia, serif", fontSize: this.textPx(18), color: "#f4e6c5" }).setVisible(false);
    this.capturePanelBody = this.scene.add.text(-1000, -1000, "", { fontFamily: "sans-serif", fontSize: this.textPx(14), color: "#d8e7f6" }).setVisible(false);

    const captureActionX = centerX + 256;
    const captureActionY = this.canvasHeight - 212;
    const captureActionGapY = 56;
    this.captureActionOriginX = captureActionX;
    this.captureActionOriginY = captureActionY;
    this.captureActionGapY = captureActionGapY;
    // Sized for a finger like the rest. These were missed by the first touch
    // pass because they are built on their own path, and on a phone they came
    // out 19 CSS px tall -- less than half a comfortable target.
    const captureActionWidth = 156;
    const captureActionHeight = atLeastTouchable(this.metrics, 44);
    this.captureActionGapY = captureActionHeight + 12;
    this.captureActionButtons.set("rebuild-defense-tower", this.createActionButton(captureActionX, captureActionY, captureActionWidth, captureActionHeight, "타워 재건", this.callbacks.rebuildDefenseTower));
    this.captureActionButtons.set("build-defense-tower", this.createActionButton(captureActionX, captureActionY + captureActionGapY, captureActionWidth, captureActionHeight, "타워", this.callbacks.buildDefenseTower));
    this.captureActionButtons.set("build-supply-depot", this.createActionButton(captureActionX, captureActionY + captureActionGapY * 2, captureActionWidth, captureActionHeight, "병참", this.callbacks.buildSupplyDepot));
    this.captureActionButtons.set("build-mint", this.createActionButton(captureActionX, captureActionY + captureActionGapY * 3, captureActionWidth, captureActionHeight, "조달소", this.callbacks.buildMint));
    this.captureActionButtons.set("dismantle", this.createActionButton(captureActionX, captureActionY + captureActionGapY * 4, captureActionWidth, captureActionHeight, "폐기", this.callbacks.dismantle));
    // Sized like everything else, even though it only appears in development:
    // a control that is on screen is a control a finger will find, and dropping
    // it from the measurement to make the numbers pass would be measuring the
    // wrong thing.
    const devHeight = atLeastTouchable(this.metrics, 34);
    const devWidth = Math.max(94, devHeight * 2.4);
    // Bottom-left, inside the HUD band. Placed above it they became controls the
    // scene did not consider part of the HUD, which is the fall-through bug the
    // band model exists to prevent -- and the band test said so.
    const devBottomY = this.canvasHeight - 4 - devHeight;
    this.devToggleButton = this.createActionButton(42, devBottomY, devWidth, devHeight, "DEV OFF", this.callbacks.toggleDevMode);
    this.devResearchButton = this.createActionButton(42, devBottomY - devHeight - 8, devWidth, devHeight, "연구 +25", this.callbacks.grantDevResearch);
    // Hidden and unclickable. The frame and the hit area are separate objects
    // now, so hiding one without the other leaves an invisible button that
    // still takes presses.
    this.devResearchButton.frame.setVisible(false);
    this.devResearchButton.rect.setVisible(false);
    this.devResearchButton.text.setVisible(false);
    this.devResearchButton.rect.disableInteractive();

    this.playerBaseBar = this.scene.add.rectangle(304, 140, 180, 10, 0x58c5ff, 1).setOrigin(0, 0.5).setDepth(this.depth + 3);
    this.enemyBaseBar = this.scene.add.rectangle(1116, 140, 180, 10, 0xff7b7b, 1).setOrigin(0, 0.5).setDepth(this.depth + 3);
    this.scene.add.rectangle(304, 140, 180, 10, 0x000000, 0.14).setOrigin(0, 0.5).setStrokeStyle(2, 0x9cb1c8, 0.34).setDepth(this.depth + 2);
    this.scene.add.rectangle(1116, 140, 180, 10, 0x000000, 0.14).setOrigin(0, 0.5).setStrokeStyle(2, 0x9cb1c8, 0.34).setDepth(this.depth + 2);
    this.audioSettingsPanel = new AudioSettingsPanel(this.scene, { depth: this.depth + 60, onVisibilityChange: this.callbacks.onAudioSettingsVisibilityChange });
    if (audioDebugEnabled) {
      this.audioDebugText = this.scene.add.text(1160, 116, "", { fontFamily: "monospace", fontSize: this.textPx(11), color: "#d9f2ff", backgroundColor: "rgba(4, 13, 22, 0.84)", padding: { x: 9, y: 7 }, lineSpacing: 2 }).setDepth(this.depth + 50).setScrollFactor(0);
    }
    this.setDevMode(false);
  }

  private createWorkerRow(role: WorkerRole, x: number, y: number): WorkerUiRow {
    const objects: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible)[] = [];
    const icon = this.scene.add.image(x, y, getWorkerIconKey(role))
      .setDisplaySize(20, 20)
      .setDepth(this.depth + 3)
      .setScrollFactor(0);
    objects.push(icon);
    const value = this.scene.add.text(x + 16, y, "0", {
      fontFamily: "monospace",
      fontSize: this.textPx(18),
      color: "#fff6dd",
    }).setOrigin(0, 0.5).setDepth(this.depth + 3).setScrollFactor(0);
    objects.push(value);
    if (role === "research" || role === "idle") {
      return { value, objects };
    }
    // Radius from the screen, not from the design: at 11 units these were the
    // smallest thing in the HUD by some margin -- 9.5 CSS px on a phone, a fifth
    // of a comfortable target. The spacing follows so they do not overlap.
    const radius = atLeastTouchable(this.metrics, 22) / 2;
    const minusX = x + 56 + (radius - 11);
    const plusX = minusX + radius * 2 + 6;
    const minus = this.scene.add.circle(minusX, y, radius, 0x283a55, 0.95)
      .setStrokeStyle(1, 0x7ea0c9)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    const plus = this.scene.add.circle(plusX, y, radius, 0x283a55, 0.95)
      .setStrokeStyle(1, 0x7ea0c9)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    const minusLabel = this.scene.add.text(minus.x, minus.y - 1, "-", { fontFamily: "sans-serif", fontSize: this.textPx(14), color: "#ffffff" })
      .setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    const plusLabel = this.scene.add.text(plus.x, plus.y - 1, "+", { fontFamily: "sans-serif", fontSize: this.textPx(14), color: "#ffffff" })
      .setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    minus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.shiftWorker(role, -1));
    plus.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.shiftWorker(role, 1));
    objects.push(minus, plus, minusLabel, plusLabel);
    return { value, minus, plus, objects };
  }

  /** Swaps a button's drawn frame; the hit area never changes. */
  private setActionFrame(button: ActionButton, frame: UiFrameId): void {
    button.frame.setTexture(getUiFrameKey(frame));
  }

  /**
   * A square button carrying an icon instead of a label.
   *
   * Built on the same frame and hit area as the text buttons, so state,
   * visibility and cost rows keep working unchanged; only what is drawn inside
   * is different.
   */
  private createIconButton(
    x: number,
    y: number,
    size: number,
    icon: UiIconId,
    label: string,
    onClick: () => void,
  ): ActionButton {
    const button = this.createActionButton(x, y, size, size, "", onClick);
    // Nearest, like the terrain: these are 32px symbols and smoothing turns
    // them back into the blur they were drawn to avoid.
    this.scene.textures.get(getUiIconKey(icon)).setFilter(Phaser.Textures.FilterMode.NEAREST);
    button.icon = this.scene.add.image(button.rect.x, button.rect.y - size * 0.08, getUiIconKey(icon))
      .setDisplaySize(size * 0.56, size * 0.56)
      .setDepth(this.depth + 3)
      .setScrollFactor(0);
    button.label = label;
    // The icon is the label. Keeping the text as well printed "일꾼 고용" across
    // the drawing, and the cost row -- five items at forty-two units each --
    // ran three times the width of the square it sits in.
    //
    // Nothing is lost that the player needs: an action they cannot afford wears
    // the danger frame, and the instant-wave token count is already on the
    // status panel.
    button.text.setVisible(false);
    return button;
  }

  private createActionButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void): ActionButton {
    const frame = this.scene.add.nineslice(
      x + width / 2, y + height / 2, getUiFrameKey("button"), undefined,
      width, height, UI_FRAME_CORNER, UI_FRAME_CORNER, UI_FRAME_CORNER, UI_FRAME_CORNER,
    ).setDepth(this.depth + 2).setScrollFactor(0);
    // The old rectangle stays, invisible, purely as the input target.
    const rect = this.scene.add.rectangle(x + width / 2, y + height / 2, width, height, 0x000000, 0)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    const text = this.scene.add.text(rect.x, rect.y - height * 0.18, label, { fontFamily: "sans-serif", fontSize: this.textPx(14), color: "#f3f7fb", align: "center" }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    const costIcons: Phaser.GameObjects.Image[] = [];
    const costTexts: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < MAX_COST_ITEMS; i += 1) {
      costIcons.push(this.scene.add.image(0, 0, "icon-gold").setDisplaySize(17, 17).setDepth(this.depth + 3).setScrollFactor(0).setVisible(false));
      costTexts.push(this.scene.add.text(0, 0, "", { fontFamily: "monospace", fontSize: this.textPx(12), color: "#d8e7f6" }).setOrigin(0, 0.5).setDepth(this.depth + 3).setScrollFactor(0).setVisible(false));
    }
    const button: ActionButton = { frame, rect, text, costIcons, costTexts };
    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerover", () => {
      if (button.enabled) this.setActionFrame(button, "button-hover");
      this.audio.playSfx("sfx.ui.hover", { eventKey: `button:hover:${label}` });
    });
    rect.on("pointerout", () => this.setActionFrame(button, button.enabled ? "button" : "button-disabled"));
    rect.on("pointerdown", () => {
      this.setActionFrame(button, "button-hover");
      this.scene.time.delayedCall(
        100,
        () => this.setActionFrame(button, button.enabled ? "button" : "button-disabled"),
      );
      onClick();
    });
    return button;
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
    // Asked of the frame, not the hit area. The two used to be one object; the
    // hit area is now always "visible" because it is invisible by design, so
    // testing it brought back exactly the floating cost icons this guard was
    // written to prevent.
    const entries = button.frame.visible && !button.icon
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
      // The frame is what is shown; the hit area is invisible by design and
      // would answer "yes" for a button that is not on screen, letting a hidden
      // control swallow taps meant for the battlefield.
      if (!button.frame.visible) return false;
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
    button.frame.setVisible(visible);
    button.icon?.setVisible(visible);
    // The hit area is invisible by design, but its `visible` flag is still what
    // everything else reads to mean "on screen". Leaving it true made hidden
    // buttons count as present -- floating cost rows, and a mobile measurement
    // that failed on controls nobody could see.
    button.rect.setVisible(visible);
    if (button.icon) {
      // An icon button has no label of its own to show.
      button.text.setVisible(false);
    }
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
