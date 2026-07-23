import Phaser from "phaser";
import { createParallaxBackground, type ParallaxBackground } from "../gfx/parallax";
import { drawChibiTexture } from "../gfx/chibi";
import { UNIT_TYPES, getUnitType, DEFAULT_UNIT_TYPE_ID } from "../data/unitTypes";
import { COMMANDS } from "../data/commands";
import { getEncounterKindDef, type EncounterKind } from "../data/encounterTypes";
import { Squad } from "../systems/squad";
import { generateRunForks, type ForkCandidate, type ForkStep } from "../systems/runGenerator";
import { createCombatEncounter, submitCommand, type CombatEncounterState } from "../systems/combat";

type Phase = "fork" | "combat" | "rescue" | "mission" | "resolving";

const PANEL = { x: 480, y: 270, w: 560, h: 320 };
const CANVAS_W = 960;
const CANVAS_H = 540;

/**
 * Main gameplay loop: fork choice -> encounter (combat / rescue) -> repeat
 * -> guaranteed mission -> GameOverScene. Encounter-kind handling lives in
 * one method per kind (`startCombat`, `startRescue`, `startMission`); to add
 * a new kind, add it to `data/encounterTypes.ts` and write one more
 * `start*` method plus a case in `resolveForkChoice`.
 */
export class RunScene extends Phaser.Scene {
  private bg!: ParallaxBackground;
  private panelContent!: Phaser.GameObjects.Container;
  private progressText!: Phaser.GameObjects.Text;
  private squadImages: Phaser.GameObjects.Image[] = [];

  private squad!: Squad;
  private forks: ForkStep[] = [];
  private forkIndex = 0;
  private phase: Phase = "fork";

  private combatState: CombatEncounterState | null = null;
  private combatStartTime = 0;
  private timerFill?: Phaser.GameObjects.Rectangle;
  private sequenceIcons: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super("run");
  }

  create(): void {
    this.bg = createParallaxBackground(this);
    UNIT_TYPES.forEach((u) => drawChibiTexture(this, `chibi-${u.id}`, u.palette));
    drawChibiTexture(this, "chibi-enemy", { skin: 0xd9a5a0, outfit: 0x6b2d3c, accent: 0x8a3b4a });
    drawChibiTexture(this, "chibi-captive", { skin: 0xf2c299, outfit: 0x4a6b5a, accent: 0x8fbf9f });

    this.add
      .rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0x10152a, 0.7)
      .setStrokeStyle(2, 0x3a4570);
    this.panelContent = this.add.container(0, 0);

    this.progressText = this.add
      .text(CANVAS_W - 16, 16, "", { fontFamily: "sans-serif", fontSize: "16px", color: "#cfd3e6" })
      .setOrigin(1, 0);

    this.squad = new Squad(DEFAULT_UNIT_TYPE_ID);
    this.forks = generateRunForks();
    this.forkIndex = 0;

    this.renderSquadRow();
    this.showFork();
  }

  update(time: number): void {
    this.bg.update();
    this.squadImages.forEach((img, i) => {
      img.y = CANVAS_H - 14 + Math.sin(time * 0.004 + i) * 1.5;
    });

    if (this.phase === "combat" && this.combatState && this.timerFill) {
      const elapsed = time - this.combatStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.combatState.timeLimitMs);
      this.timerFill.width = 300 * remaining;
      if (remaining <= 0) this.onCombatTimeout();
    }

    // Debug hook for headless/Playwright smoke checks — see docs/rules/testing.md.
    // Harmless in production; not read by any gameplay code.
    (window as unknown as { __gameDebug: unknown }).__gameDebug = {
      phase: this.phase,
      forkIndex: this.forkIndex,
      forksTotal: this.forks.length,
      squadSize: this.squad.size,
      combatIndex: this.combatState?.index ?? null,
      combatLength: this.combatState?.sequence.length ?? null,
    };
  }

  // ---- squad visuals ----------------------------------------------------

  private renderSquadRow(): void {
    this.squadImages.forEach((img) => img.destroy());
    this.squadImages = this.squad.members.map((member, i) => {
      const tex = `chibi-${getUnitType(member.unitTypeId).id}`;
      return this.add.image(50 + i * 26, CANVAS_H - 14, tex).setOrigin(0.5, 1);
    });
  }

  private updateProgressText(): void {
    this.progressText.setText(`${Math.min(this.forkIndex + 1, this.forks.length)}/${this.forks.length}  대열 ${this.squad.size}`);
  }

  // ---- panel / button helpers --------------------------------------------

  private clearPanel(): void {
    this.panelContent.removeAll(true);
    this.timerFill = undefined;
    this.sequenceIcons = [];
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const rect = this.add.rectangle(0, 0, w, h, color, 1).setStrokeStyle(2, 0xffffff, 0.25);
    const text = this.add
      .text(0, 0, label, { fontFamily: "sans-serif", fontSize: "18px", color: "#ffffff" })
      .setOrigin(0.5);
    const container = this.add.container(x, y, [rect, text]);
    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerover", () => rect.setFillStyle(color, 0.8));
    rect.on("pointerout", () => rect.setFillStyle(color, 1));
    rect.on("pointerdown", onClick);
    this.panelContent.add(container);
    return container;
  }

  // ---- fork phase ---------------------------------------------------------

  private showFork(): void {
    this.phase = "fork";
    this.updateProgressText();
    this.clearPanel();

    const step = this.forks[this.forkIndex];
    this.panelContent.add(
      this.add
        .text(PANEL.x, PANEL.y - 130, "갈림길 — 어느 쪽으로 갈까?", {
          fontFamily: "sans-serif",
          fontSize: "18px",
          color: "#f2f2f2",
        })
        .setOrigin(0.5)
    );

    this.addForkOption(PANEL.x - 140, step.left, "왼쪽 길");
    this.addForkOption(PANEL.x + 140, step.right, "오른쪽 길");
  }

  private addForkOption(x: number, candidate: ForkCandidate, sideLabel: string): void {
    const def = getEncounterKindDef(candidate.kind);
    const rect = this.add
      .rectangle(x, PANEL.y, 240, 200, 0x1c2440, 1)
      .setStrokeStyle(2, 0x4a5590);
    const icon = this.add.text(x, PANEL.y - 40, def.hintIcon, { fontSize: "48px" }).setOrigin(0.5);
    const label = this.add
      .text(x, PANEL.y + 20, sideLabel, { fontFamily: "sans-serif", fontSize: "16px", color: "#cfd3e6" })
      .setOrigin(0.5);
    const hint = this.add
      .text(x, PANEL.y + 48, `예감: ${def.label}`, { fontFamily: "sans-serif", fontSize: "13px", color: "#8890b0" })
      .setOrigin(0.5);
    this.panelContent.add([rect, icon, label, hint]);

    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerover", () => rect.setStrokeStyle(2, 0xf2c14e));
    rect.on("pointerout", () => rect.setStrokeStyle(2, 0x4a5590));
    rect.on("pointerdown", () => this.resolveForkChoice(candidate));
  }

  private resolveForkChoice(candidate: ForkCandidate): void {
    this.phase = "resolving";
    this.dispatchEncounter(candidate.kind);
  }

  private dispatchEncounter(kind: EncounterKind): void {
    if (kind === "combat") this.startCombat();
    else if (kind === "rescue") this.startRescue();
    else this.startMission();
  }

  // ---- combat phase ---------------------------------------------------------

  private startCombat(): void {
    this.phase = "combat";
    this.clearPanel();
    this.combatState = createCombatEncounter(this.forkIndex);
    this.combatStartTime = this.time.now;

    this.panelContent.add(
      this.add.image(PANEL.x, PANEL.y - 110, "chibi-enemy").setScale(1.6)
    );
    this.panelContent.add(
      this.add
        .text(PANEL.x, PANEL.y - 150, "적과 조우!", { fontFamily: "sans-serif", fontSize: "16px", color: "#f2a0a0" })
        .setOrigin(0.5)
    );

    // timer bar
    const barBg = this.add.rectangle(PANEL.x, PANEL.y - 40, 300, 18, 0x2a2f4a, 1).setStrokeStyle(1, 0x4a5590);
    this.timerFill = this.add
      .rectangle(PANEL.x - 150, PANEL.y - 40, 300, 18, 0xf2c14e, 1)
      .setOrigin(0, 0.5);
    this.panelContent.add([barBg, this.timerFill]);

    // sequence icons
    const seq = this.combatState.sequence;
    const startX = PANEL.x - ((seq.length - 1) * 32) / 2;
    this.sequenceIcons = seq.map((_cmdId, i) => {
      const box = this.add
        .rectangle(startX + i * 32, PANEL.y + 10, 24, 24, 0x2a2f4a, 1)
        .setStrokeStyle(2, 0x4a5590);
      this.panelContent.add(box);
      return box;
    });
    this.refreshSequenceIcons();

    // command buttons (one per registered command)
    const btnStartX = PANEL.x - ((COMMANDS.length - 1) * 140) / 2;
    COMMANDS.forEach((cmd, i) => {
      this.makeButton(btnStartX + i * 140, PANEL.y + 70, 120, 50, cmd.label, cmd.color, () =>
        this.onCommandPressed(cmd.id)
      );
    });
  }

  private refreshSequenceIcons(): void {
    if (!this.combatState) return;
    const { sequence, index } = this.combatState;
    this.sequenceIcons.forEach((box, i) => {
      const cmd = COMMANDS.find((c) => c.id === sequence[i]);
      const color = cmd?.color ?? 0xffffff;
      if (i < index) box.setFillStyle(color, 1).setStrokeStyle(2, color);
      else if (i === index) box.setFillStyle(0x2a2f4a, 1).setStrokeStyle(3, 0xf2c14e);
      else box.setFillStyle(0x2a2f4a, 1).setStrokeStyle(2, 0x4a5590);
    });
  }

  private onCommandPressed(commandId: string): void {
    if (this.phase !== "combat" || !this.combatState) return;
    const result = submitCommand(this.combatState, commandId);
    if (result === "wrong") return;
    this.refreshSequenceIcons();
    if (result === "complete") this.onCombatWin();
  }

  private onCombatWin(): void {
    this.phase = "resolving";
    this.flashMessage("전투 승리!", "#8fe08f");
    this.time.delayedCall(700, () => this.advanceAfterEncounter());
  }

  private onCombatTimeout(): void {
    this.phase = "resolving";
    this.squad.removeFront();
    this.renderSquadRow();
    this.flashMessage("대열 손실...", "#f28a8a");
    this.time.delayedCall(700, () => this.advanceAfterEncounter());
  }

  private flashMessage(text: string, color: string): void {
    this.clearPanel();
    this.panelContent.add(
      this.add
        .text(PANEL.x, PANEL.y, text, { fontFamily: "sans-serif", fontSize: "28px", color })
        .setOrigin(0.5)
    );
  }

  // ---- rescue phase ---------------------------------------------------------

  private startRescue(): void {
    this.phase = "rescue";
    this.clearPanel();

    const cage = this.add.circle(PANEL.x, PANEL.y - 40, 50, 0x000000, 0).setStrokeStyle(3, 0x8fbf9f);
    const captive = this.add.image(PANEL.x, PANEL.y - 20, "chibi-captive").setScale(1.4);
    const label = this.add
      .text(PANEL.x, PANEL.y - 110, "붙잡힌 아군 발견!", { fontFamily: "sans-serif", fontSize: "16px", color: "#a8e0b8" })
      .setOrigin(0.5);
    this.panelContent.add([cage, captive, label]);

    this.makeButton(PANEL.x, PANEL.y + 70, 160, 50, "구출!", 0x2e7d5b, () => this.onRescueConfirmed());
  }

  private onRescueConfirmed(): void {
    this.phase = "resolving";
    this.squad.add(DEFAULT_UNIT_TYPE_ID);
    this.renderSquadRow();
    this.flashMessage("대열 합류!", "#8fe0c8");
    this.time.delayedCall(700, () => this.advanceAfterEncounter());
  }

  // ---- mission phase ---------------------------------------------------------

  private startMission(): void {
    this.phase = "mission";
    this.clearPanel();

    this.panelContent.add(
      this.add.text(PANEL.x, PANEL.y - 40, "🚩", { fontSize: "56px" }).setOrigin(0.5)
    );
    this.panelContent.add(
      this.add
        .text(PANEL.x, PANEL.y - 110, "미션 지점 도달", { fontFamily: "sans-serif", fontSize: "18px", color: "#f2f2f2" })
        .setOrigin(0.5)
    );

    this.makeButton(PANEL.x, PANEL.y + 60, 160, 50, "돌파!", 0xf2c14e, () => this.onMissionComplete());
  }

  private onMissionComplete(): void {
    this.scene.start("gameover", { win: true, squadSize: this.squad.size });
  }

  // ---- shared progression ---------------------------------------------------

  private advanceAfterEncounter(): void {
    if (this.squad.isWiped) {
      this.scene.start("gameover", { win: false, squadSize: 0 });
      return;
    }
    this.forkIndex += 1;
    this.updateProgressText();
    if (this.forkIndex >= this.forks.length) this.startMission();
    else this.showFork();
  }
}
