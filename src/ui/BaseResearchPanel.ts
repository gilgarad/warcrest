import Phaser from "phaser";
import { resolveUnitPortraitTextureKey } from "../presentation/units/unitAnimationRegistry";
import type { ResearchStatKey } from "../systems/lane-economy/researchRules";
import type { ResearchSubjectId } from "../systems/lane-economy/researchSubjects";
import type { BaseResearchPanelSnapshot } from "./baseResearchPanelModel";

/**
 * Panel geometry, derived from one frame rather than hand-placed per element.
 *
 * The buttons were previously positioned by eye and drifted out of the frame:
 * apply and revert hung below the bottom edge and overlapped each other, and
 * close sat above the header bar instead of on it. Naming the edges means an
 * element is placed relative to something real.
 */
const PANEL = {
  centreX: 800,
  centreY: 522,
  width: 792,
  height: 528,
  /** Header bar, measured from the panel's own top edge. */
  headerHeight: 78,
  /** Breathing room between the frame and anything inside it. */
  padding: 20,
  /** Space between two adjacent buttons. */
  gap: 12,
} as const;

const PANEL_LEFT = PANEL.centreX - PANEL.width / 2;
const PANEL_RIGHT = PANEL.centreX + PANEL.width / 2;
const PANEL_TOP = PANEL.centreY - PANEL.height / 2;
const PANEL_BOTTOM = PANEL.centreY + PANEL.height / 2;
const HEADER_CENTRE_Y = PANEL_TOP + PANEL.headerHeight / 2;
const FOOTER_HEIGHT = 48;
const FOOTER_CENTRE_Y = PANEL_BOTTOM - PANEL.padding - FOOTER_HEIGHT / 2;

export interface PanelBox {
  centreX: number;
  centreY: number;
  width: number;
  height: number;
}

const box = (centreX: number, centreY: number, width: number, height: number): PanelBox =>
  ({ centreX, centreY, width, height });

const rightAligned = (width: number, centreY: number, height: number, rightEdge: number): PanelBox =>
  box(rightEdge - width / 2, centreY, width, height);

/**
 * Where the framed elements sit, exported so the alignment can be asserted
 * instead of inspected in a screenshot. Every position is derived from the panel
 * frame, which is what stops them drifting outside it again.
 */
export const BASE_RESEARCH_PANEL_LAYOUT = (() => {
  const close = rightAligned(74, HEADER_CENTRE_Y, 38, PANEL_RIGHT - PANEL.padding);
  const revert = rightAligned(110, FOOTER_CENTRE_Y, FOOTER_HEIGHT, PANEL_RIGHT - PANEL.padding);
  const apply = rightAligned(
    206,
    FOOTER_CENTRE_Y,
    FOOTER_HEIGHT,
    revert.centreX - revert.width / 2 - PANEL.gap,
  );
  return {
    panel: box(PANEL.centreX, PANEL.centreY, PANEL.width, PANEL.height),
    header: box(PANEL.centreX, HEADER_CENTRE_Y, PANEL.width, PANEL.headerHeight),
    close,
    apply,
    revert,
  };
})();

export const panelBoxEdges = (target: PanelBox) => ({
  left: target.centreX - target.width / 2,
  right: target.centreX + target.width / 2,
  top: target.centreY - target.height / 2,
  bottom: target.centreY + target.height / 2,
});

interface PanelRowView {
  background: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  attackValue: Phaser.GameObjects.Text;
  attackMeta: Phaser.GameObjects.Text;
  defenseValue: Phaser.GameObjects.Text;
  defenseMeta: Phaser.GameObjects.Text;
  attackMinus: PanelButton;
  attackPlus: PanelButton;
  defenseMinus: PanelButton;
  defensePlus: PanelButton;
}

interface PanelButton {
  rect: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export interface BaseResearchPanelCallbacks {
  close: () => void;
  browseAge: (delta: 1 | -1) => void;
  adjustStat: (unitId: ResearchSubjectId, stat: ResearchStatKey, delta: 1 | -1) => void;
  apply: () => void;
  cancel: () => void;
}

export class BaseResearchPanel {
  private readonly objects: Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible> = [];
  private readonly rows: PanelRowView[] = [];
  private title!: Phaser.GameObjects.Text;
  private ageLabel!: Phaser.GameObjects.Text;
  private productionHint!: Phaser.GameObjects.Text;
  private researchText!: Phaser.GameObjects.Text;
  private capText!: Phaser.GameObjects.Text;
  private closeButton!: PanelButton;
  private prevButton!: PanelButton;
  private nextButton!: PanelButton;
  private applyButton!: PanelButton;
  private cancelButton!: PanelButton;
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: BaseResearchPanelCallbacks,
    private readonly depth: number,
  ) {
    this.create();
    this.setVisible(false);
  }

  /**
   * Whether the pointer is inside the open panel.
   *
   * The battle scene treats a tap on bare ground as "clear the selection", and
   * it decided what counted as UI from fixed screen bands. This panel floats in
   * the middle, outside those bands, so pressing one of its buttons registered
   * as a tap on the field: the stat did increment, and then the selection was
   * cleared and the panel closed itself. Coordinates are in the same space as
   * `Pointer.x`/`y`, since everything here is fixed to the camera.
   */
  isPointerOver(x: number, y: number): boolean {
    if (!this.visible) return false;
    return x >= PANEL_LEFT && x <= PANEL_RIGHT && y >= PANEL_TOP && y <= PANEL_BOTTOM;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.objects.forEach((object) => object.setVisible(visible));
    if (!visible) {
      this.disableRowInteractions();
      [this.closeButton, this.prevButton, this.nextButton, this.applyButton, this.cancelButton].forEach((button) => {
        button.rect.disableInteractive();
      });
    }
  }

  applySnapshot(snapshot: BaseResearchPanelSnapshot): void {
    this.setVisible(true);
    this.title.setText(snapshot.title);
    this.ageLabel.setText(snapshot.ageLabel);
    this.productionHint.setText(snapshot.productionHint);
    this.researchText.setText(snapshot.researchText);
    this.capText.setText(snapshot.capText);
    this.setButtonEnabled(this.closeButton, true);
    this.setButtonEnabled(this.prevButton, snapshot.canBrowsePrev);
    this.setButtonEnabled(this.nextButton, snapshot.canBrowseNext);
    this.setButtonEnabled(this.applyButton, snapshot.applyEnabled);
    this.applyButton.text.setText(snapshot.applyLabel);
    this.setButtonEnabled(this.cancelButton, true);
    this.rows.forEach((rowView, index) => {
      const row = snapshot.rows[index];
      const visible = Boolean(row);
      rowView.background.setVisible(visible);
      rowView.icon.setVisible(visible);
      rowView.label.setVisible(visible);
      rowView.attackValue.setVisible(visible);
      rowView.attackMeta.setVisible(visible);
      rowView.defenseValue.setVisible(visible);
      rowView.defenseMeta.setVisible(visible);
      [rowView.attackMinus, rowView.attackPlus, rowView.defenseMinus, rowView.defensePlus].forEach((button) => {
        button.rect.setVisible(visible);
        button.text.setVisible(visible);
      });
      if (!row) return;
      rowView.icon.setTexture(row.iconTextureKey);
      rowView.label.setText(row.label);
      rowView.attackValue.setText(String(row.attackLevel));
      rowView.attackMeta.setText(`${row.attackMultiplierText} · 기본 ${row.appliedAttackLevel}`);
      rowView.defenseValue.setText(String(row.defenseLevel));
      rowView.defenseMeta.setText(`${row.defenseMultiplierText} · 기본 ${row.appliedDefenseLevel}`);
      this.setStatButtonEnabled(rowView.attackMinus, row.attackCanDecrease, row.subjectId, "attack", -1);
      this.setStatButtonEnabled(rowView.attackPlus, true, row.subjectId, "attack", 1);
      this.setStatButtonEnabled(rowView.defenseMinus, row.defenseCanDecrease, row.subjectId, "defense", -1);
      this.setStatButtonEnabled(rowView.defensePlus, true, row.subjectId, "defense", 1);
    });
  }

  private create(): void {
    const background = this.scene.add.rectangle(PANEL.centreX, PANEL.centreY, PANEL.width, PANEL.height, 0x0a1320, 0.95)
      .setStrokeStyle(2, 0xc3b58a, 0.22)
      .setDepth(this.depth)
      .setScrollFactor(0);
    const panelTop = this.scene.add.rectangle(PANEL.centreX, HEADER_CENTRE_Y, PANEL.width, PANEL.headerHeight, 0x13263b, 0.98)
      .setDepth(this.depth + 1)
      .setScrollFactor(0);
    this.title = this.scene.add.text(472, 286, "", {
      fontFamily: "Georgia, serif",
      fontSize: "27px",
      color: "#f1e4c3",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    this.ageLabel = this.scene.add.text(472, 322, "", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#d7e9ff",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    this.productionHint = this.scene.add.text(472, 350, "", {
      fontFamily: "sans-serif",
      fontSize: "15px",
      color: "#9fd2ff",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    this.researchText = this.scene.add.text(472, 378, "", {
      fontFamily: "sans-serif",
      fontSize: "15px",
      color: "#c5f5ff",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    this.capText = this.scene.add.text(472, 402, "", {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#9ec2df",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    // Worker-production explainer: the HUD's worker panel only shows an
    // icon/count/+-, with no indication anywhere of what an extra worker
    // actually produces — this is the one detailed explanation for it.
    const workerInfoTitle = this.scene.add.text(700, 296, "일꾼 생산 안내", {
      fontFamily: "Georgia, serif",
      fontSize: "14px",
      color: "#f1e4c3",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    const workerInfoBody = this.scene.add.text(700, 318, "일꾼 1명당 자원 1개를 5초마다 생산합니다.\n연구는 일꾼 1명당 1포인트를 10초마다 생산합니다.\n자원이 오를 때 상단 자원 칸 옆에 잠깐 +N으로 표시됩니다.", {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#aac1db",
      lineSpacing: 3,
    }).setDepth(this.depth + 2).setScrollFactor(0);
    this.prevButton = this.createButton(1030, 320, 44, 40, "<", () => this.callbacks.browseAge(-1));
    this.nextButton = this.createButton(1086, 320, 44, 40, ">", () => this.callbacks.browseAge(1));
    const unitHeader = this.scene.add.text(522, 424, "병력", { fontFamily: "sans-serif", fontSize: "15px", color: "#a6bfdc" }).setDepth(this.depth + 2).setScrollFactor(0);
    const attackHeader = this.scene.add.text(730, 424, "공격", { fontFamily: "sans-serif", fontSize: "15px", color: "#a6bfdc" }).setDepth(this.depth + 2).setScrollFactor(0);
    const defenseHeader = this.scene.add.text(964, 424, "방어", { fontFamily: "sans-serif", fontSize: "15px", color: "#a6bfdc" }).setDepth(this.depth + 2).setScrollFactor(0);
    // Close sits centred on the header bar; apply and revert are laid out
    // right-to-left inside the footer so the two cannot overlap.
    // "취소" was the old label and read as "close this dialog". This button
    // discards the pending changes and leaves the panel open, so it says so.
    const layout = BASE_RESEARCH_PANEL_LAYOUT;
    this.closeButton = this.buttonFromBox(layout.close, "닫기", this.callbacks.close);
    this.applyButton = this.buttonFromBox(layout.apply, "적용", this.callbacks.apply);
    this.cancelButton = this.buttonFromBox(layout.revert, "되돌리기", this.callbacks.cancel);

    let rowY = 492;
    for (let index = 0; index < 6; index += 1) {
      this.rows.push(this.createRow(rowY));
      rowY += 84;
    }

    this.objects.push(
      background,
      panelTop,
      this.title,
      this.ageLabel,
      this.productionHint,
      workerInfoTitle,
      workerInfoBody,
      this.researchText,
      this.capText,
      unitHeader,
      attackHeader,
      defenseHeader,
      this.closeButton.rect,
      this.closeButton.text,
      this.prevButton.rect,
      this.prevButton.text,
      this.nextButton.rect,
      this.nextButton.text,
      this.applyButton.rect,
      this.applyButton.text,
      this.cancelButton.rect,
      this.cancelButton.text,
      ...this.rows.flatMap((row) => [
        row.background,
        row.icon,
        row.label,
        row.attackValue,
        row.attackMeta,
        row.defenseValue,
        row.defenseMeta,
        row.attackMinus.rect,
        row.attackMinus.text,
        row.attackPlus.rect,
        row.attackPlus.text,
        row.defenseMinus.rect,
        row.defenseMinus.text,
        row.defensePlus.rect,
        row.defensePlus.text,
      ]),
    );
  }

  private createRow(y: number): PanelRowView {
    const rowBackground = this.scene.add.rectangle(800, y, 712, 66, 0x142234, 0.66).setDepth(this.depth + 1).setScrollFactor(0);
    const icon = this.scene.add.image(538, y + 2, resolveUnitPortraitTextureKey("stone_axeman", "player"))
      .setDisplaySize(66, 66)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    const label = this.scene.add.text(590, y - 14, "", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#edf6ff",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    const attackValue = this.scene.add.text(718, y - 16, "0", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#fff0cf",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    const attackMeta = this.scene.add.text(716, y + 12, "", {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#9ec2df",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    const defenseValue = this.scene.add.text(952, y - 16, "0", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#d8f4ff",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    const defenseMeta = this.scene.add.text(950, y + 12, "", {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#9ec2df",
    }).setDepth(this.depth + 2).setScrollFactor(0);
    const attackMinus = this.createStatButton(822, y, "-");
    const attackPlus = this.createStatButton(866, y, "+");
    const defenseMinus = this.createStatButton(1058, y, "-");
    const defensePlus = this.createStatButton(1102, y, "+");
    this.objects.push(rowBackground);
    return {
      background: rowBackground,
      icon,
      label,
      attackValue,
      attackMeta,
      defenseValue,
      defenseMeta,
      attackMinus,
      attackPlus,
      defenseMinus,
      defensePlus,
    };
  }

  private buttonFromBox(target: PanelBox, label: string, onClick: () => void): PanelButton {
    return this.createButton(target.centreX, target.centreY, target.width, target.height, label, onClick);
  }

  private createButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void): PanelButton {
    const rect = this.scene.add.rectangle(x, y, width, height, 0x1f3550, 0.96)
      .setStrokeStyle(2, 0xcbb07a, 0.65)
      .setDepth(this.depth + 2)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add.text(x, y, label, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#f8fbff",
      align: "center",
    }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    rect.on("pointerdown", onClick);
    return { rect, text };
  }

  private createStatButton(x: number, y: number, label: string): PanelButton {
    const rect = this.scene.add.rectangle(x, y, 34, 30, 0x263d5c, 0.96)
      .setStrokeStyle(1, 0x8eb4da, 0.56)
      .setDepth(this.depth + 2)
      .setScrollFactor(0);
    const text = this.scene.add.text(x, y - 1, label, {
      fontFamily: "sans-serif",
      fontSize: "16px",
      color: "#ffffff",
    }).setOrigin(0.5).setDepth(this.depth + 3).setScrollFactor(0);
    return { rect, text };
  }

  private disableRowInteractions(): void {
    this.rows.forEach((row) => {
      [row.attackMinus, row.attackPlus, row.defenseMinus, row.defensePlus].forEach((button) => {
        button.rect.disableInteractive();
      });
    });
  }

  private setButtonEnabled(button: PanelButton, enabled: boolean): void {
    button.rect.setFillStyle(enabled ? 0x1f3550 : 0x2a2832, enabled ? 0.96 : 0.78);
    button.rect.setStrokeStyle(2, enabled ? 0xcbb07a : 0x7f7a72, enabled ? 0.65 : 0.35);
    button.text.setColor(enabled ? "#f8fbff" : "#b8b2a7");
    if (enabled) {
      button.rect.setInteractive({ useHandCursor: true });
    } else {
      button.rect.disableInteractive();
    }
  }

  private setStatButtonEnabled(
    button: PanelButton,
    enabled: boolean,
    unitId: ResearchSubjectId,
    stat: ResearchStatKey,
    delta: 1 | -1,
  ): void {
    button.rect.setFillStyle(enabled ? 0x263d5c : 0x242832, enabled ? 0.96 : 0.72);
    button.rect.setStrokeStyle(1, enabled ? 0x8eb4da : 0x5b6370, enabled ? 0.56 : 0.28);
    button.text.setColor(enabled ? "#ffffff" : "#9ba7b7");
    button.rect.removeAllListeners("pointerdown");
    if (enabled) {
      button.rect.setInteractive({ useHandCursor: true });
      button.rect.on("pointerdown", () => this.callbacks.adjustStat(unitId, stat, delta));
    } else {
      button.rect.disableInteractive();
    }
  }
}
