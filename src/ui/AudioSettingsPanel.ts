import Phaser from "phaser";
import { getAudioSystem, type CombatSfxMode } from "../systems/audio";

interface AudioSettingsPanelOptions {
  depth: number;
  onVisibilityChange?: (visible: boolean) => void;
}

interface SliderControl {
  key: "masterVolume" | "bgmVolume" | "sfxVolume";
  track: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  handle: Phaser.GameObjects.Arc;
  valueText: Phaser.GameObjects.Text;
}

const PANEL_W = 520;
const PANEL_H = 610;
const TRACK_W = 230;

export class AudioSettingsPanel {
  private readonly audio = getAudioSystem();
  private readonly root: Phaser.GameObjects.Container;
  private readonly openRect: Phaser.GameObjects.Rectangle;
  private readonly openText: Phaser.GameObjects.Text;
  private readonly sliders: SliderControl[] = [];
  private readonly muteText: Phaser.GameObjects.Text;
  private readonly focusText: Phaser.GameObjects.Text;
  private readonly modeButtons = new Map<CombatSfxMode, Phaser.GameObjects.Rectangle>();
  private activeSlider: SliderControl | null = null;
  private selectedSliderIndex = 0;
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: AudioSettingsPanelOptions,
  ) {
    const { width, height } = scene.scale;
    this.root = scene.add.container(width / 2, height / 2).setDepth(options.depth).setScrollFactor(0).setVisible(false);

    const dimmer = scene.add.rectangle(0, 0, width, height, 0x02070d, 0.58).setInteractive();
    const panel = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x0b1724, 0.98)
      .setStrokeStyle(3, 0xd0ad63, 0.86);
    const inner = scene.add.rectangle(0, 12, PANEL_W - 24, PANEL_H - 64, 0x112238, 0.72)
      .setStrokeStyle(1, 0x6f8fb5, 0.35);
    const title = scene.add.text(-220, -274, "오디오 설정", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#fff0c8",
    });
    const hint = scene.add.text(-220, -238, "Esc 닫기  ·  M 음소거  ·  선택한 슬라이더는 ← → 조절", {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#9fb5d0",
    });
    const close = this.makeButton(190, -270, 62, 34, "닫기", () => this.close(), false);
    this.root.add([dimmer, panel, inner, title, hint, ...close]);

    this.sliders.push(this.createSlider("masterVolume", "전체 음량", -170));
    this.sliders.push(this.createSlider("bgmVolume", "음악 음량", -104));
    this.sliders.push(this.createSlider("sfxVolume", "효과음 음량", -38));

    const muteButton = this.makeButton(0, 42, 420, 42, "", () => {
      this.audio.setMuted(!this.audio.getState().settings.mute);
      this.refresh();
      this.audio.playSfx("sfx.ui.settingsChange", { eventKey: "settings:mute" });
    });
    this.muteText = muteButton[1] as Phaser.GameObjects.Text;
    const focusButton = this.makeButton(0, 94, 420, 42, "", () => {
      const current = this.audio.getState().settings.muteWhenUnfocused;
      this.audio.setMuteWhenUnfocused(!current);
      this.refresh();
      this.audio.playSfx("sfx.ui.settingsChange", { eventKey: "settings:focus" });
    });
    this.focusText = focusButton[1] as Phaser.GameObjects.Text;
    this.root.add([...muteButton, ...focusButton]);

    this.root.add(scene.add.text(-210, 132, "고빈도 전투 효과음", {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#d9e7f5",
    }));
    (["off", "reduced", "full"] as CombatSfxMode[]).forEach((mode, index) => {
      const label = mode === "off" ? "끔" : mode === "reduced" ? "축소" : "전체";
      const [rect, text] = this.makeButton(-140 + index * 140, 174, 126, 40, label, () => {
        this.audio.setCombatSfxMode(mode);
        this.refresh();
        this.audio.playSfx("sfx.ui.settingsChange", { eventKey: `settings:combat:${mode}` });
      });
      this.modeButtons.set(mode, rect as Phaser.GameObjects.Rectangle);
      this.root.add([rect, text]);
    });

    const reset = this.makeButton(-108, 244, 190, 44, "기본값 복원", () => {
      this.audio.resetSettings();
      this.refresh();
      this.audio.playSfx("sfx.ui.confirm", { eventKey: "settings:reset" });
    });
    const test = this.makeButton(108, 244, 190, 44, "테스트 효과음", () => {
      this.audio.playSfx("sfx.ui.confirm", { eventKey: "settings:test" });
    });
    this.root.add([...reset, ...test]);

    this.openRect = scene.add.rectangle(width - 102, 86, 116, 50, 0x162a42, 0.94)
      .setStrokeStyle(2, 0xd0ad63, 0.72)
      .setDepth(options.depth)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.openText = scene.add.text(this.openRect.x, this.openRect.y, "소리", {
      fontFamily: "sans-serif",
      fontSize: "22px",
      color: "#f4e7c8",
    }).setOrigin(0.5).setDepth(options.depth + 1).setScrollFactor(0);
    this.openRect.on("pointerover", () => {
      this.openRect.setFillStyle(0x244667, 1);
      this.audio.playSfx("sfx.ui.hover", { eventKey: "audio-settings:open:hover" });
    });
    this.openRect.on("pointerout", () => this.openRect.setFillStyle(0x162a42, 0.94));
    this.openRect.on("pointerdown", () => this.open());

    scene.input.on("pointermove", this.handlePointerMove);
    scene.input.on("pointerup", this.handlePointerUp);
    scene.input.keyboard?.on("keydown-ESC", this.handleEscape);
    scene.input.keyboard?.on("keydown-M", this.handleMuteShortcut);
    scene.input.keyboard?.on("keydown-LEFT", this.handleSliderLeft);
    scene.input.keyboard?.on("keydown-RIGHT", this.handleSliderRight);
    scene.events.once("shutdown", () => this.destroy());
    this.refresh();
  }

  get isOpen(): boolean {
    return this.visible;
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [this.root, this.openRect, this.openText];
  }

  open(): void {
    if (this.visible) return;
    this.visible = true;
    this.root.setVisible(true);
    this.openRect.setVisible(false);
    this.openText.setVisible(false);
    this.refresh();
    this.audio.playSfx("sfx.ui.confirm", { eventKey: "audio-settings:open" });
    this.options.onVisibilityChange?.(true);
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.activeSlider = null;
    this.root.setVisible(false);
    this.openRect.setVisible(true);
    this.openText.setVisible(true);
    this.audio.playSfx("sfx.ui.cancel", { eventKey: "audio-settings:close" });
    this.options.onVisibilityChange?.(false);
  }

  private createSlider(
    key: SliderControl["key"],
    label: string,
    y: number,
  ): SliderControl {
    const labelText = this.scene.add.text(-210, y - 12, label, {
      fontFamily: "sans-serif",
      fontSize: "15px",
      color: "#e4edf7",
    });
    const track = this.scene.add.rectangle(50, y, TRACK_W, 10, 0x26364b, 1)
      .setStrokeStyle(1, 0x7d96b1, 0.55)
      .setInteractive({ useHandCursor: true });
    const fill = this.scene.add.rectangle(50 - TRACK_W / 2, y, TRACK_W, 8, 0x5eace0, 1).setOrigin(0, 0.5);
    const handle = this.scene.add.circle(50, y, 10, 0xf3d27a, 1).setStrokeStyle(2, 0xffffff, 0.65);
    const valueText = this.scene.add.text(198, y - 12, "", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#fff4d4",
    }).setOrigin(1, 0);
    const slider: SliderControl = { key, track, fill, handle, valueText };
    track.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.activeSlider = slider;
      this.selectedSliderIndex = this.sliders.indexOf(slider);
      this.setSliderFromPointer(slider, pointer.x);
    });
    handle.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.activeSlider = slider;
      this.selectedSliderIndex = this.sliders.indexOf(slider);
    });
    this.root.add([labelText, track, fill, handle, valueText]);
    return slider;
  }

  private makeButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    playHover = true,
  ): [Phaser.GameObjects.Rectangle, Phaser.GameObjects.Text] {
    const rect = this.scene.add.rectangle(x, y, width, height, 0x1b304b, 0.98)
      .setStrokeStyle(1, 0xc5a961, 0.65)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add.text(x, y, label, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#f3f7fb",
    }).setOrigin(0.5);
    rect.on("pointerover", () => {
      rect.setFillStyle(0x2b4b70, 1);
      if (playHover) this.audio.playSfx("sfx.ui.hover", { eventKey: `settings:hover:${x}:${y}` });
    });
    rect.on("pointerout", () => rect.setFillStyle(0x1b304b, 0.98));
    rect.on("pointerdown", onClick);
    return [rect, text];
  }

  private refresh(): void {
    const settings = this.audio.getState().settings;
    this.sliders.forEach((slider) => {
      const value = settings[slider.key];
      slider.fill.width = TRACK_W * value;
      slider.handle.x = 50 - TRACK_W / 2 + TRACK_W * value;
      slider.valueText.setText(`${Math.round(value * 100)}%`);
    });
    this.muteText.setText(`전체 음소거: ${settings.mute ? "켬" : "끔"}`);
    this.focusText.setText(`창을 벗어나면 음소거: ${settings.muteWhenUnfocused ? "켬" : "끔"}`);
    this.modeButtons.forEach((rect, mode) => {
      const active = settings.combatSfxMode === mode;
      rect.setFillStyle(active ? 0x486b3d : 0x1b304b, 1);
      rect.setStrokeStyle(active ? 2 : 1, active ? 0xf0d177 : 0xc5a961, active ? 0.95 : 0.65);
    });
  }

  private setSliderFromPointer(slider: SliderControl, pointerX: number): void {
    const trackLeft = this.root.x + slider.track.x - TRACK_W / 2;
    this.setSliderValue(slider, Phaser.Math.Clamp((pointerX - trackLeft) / TRACK_W, 0, 1));
  }

  private setSliderValue(slider: SliderControl, value: number): void {
    if (slider.key === "masterVolume") this.audio.setMasterVolume(value);
    else if (slider.key === "bgmVolume") this.audio.setBgmVolume(value);
    else this.audio.setSfxVolume(value);
    this.refresh();
  }

  private handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.visible || !pointer.isDown || !this.activeSlider) return;
    this.setSliderFromPointer(this.activeSlider, pointer.x);
  };

  private handlePointerUp = (): void => {
    if (this.activeSlider) {
      this.audio.playSfx("sfx.ui.settingsChange", { eventKey: `settings:slider:${this.activeSlider.key}` });
    }
    this.activeSlider = null;
  };

  private handleEscape = (): void => {
    if (this.visible) this.close();
    else this.open();
  };

  private handleMuteShortcut = (): void => {
    this.audio.setMuted(!this.audio.getState().settings.mute);
    this.refresh();
    this.audio.playSfx("sfx.ui.settingsChange", { eventKey: "settings:shortcut:mute" });
  };

  private handleSliderLeft = (): void => this.adjustSelectedSlider(-0.05);
  private handleSliderRight = (): void => this.adjustSelectedSlider(0.05);

  private adjustSelectedSlider(delta: number): void {
    if (!this.visible) return;
    const slider = this.sliders[this.selectedSliderIndex];
    if (!slider) return;
    const value = this.audio.getState().settings[slider.key];
    this.setSliderValue(slider, Phaser.Math.Clamp(value + delta, 0, 1));
    this.audio.playSfx("sfx.ui.settingsChange", { eventKey: `settings:key:${slider.key}` });
  }

  private destroy(): void {
    this.scene.input.off("pointermove", this.handlePointerMove);
    this.scene.input.off("pointerup", this.handlePointerUp);
    this.scene.input.keyboard?.off("keydown-ESC", this.handleEscape);
    this.scene.input.keyboard?.off("keydown-M", this.handleMuteShortcut);
    this.scene.input.keyboard?.off("keydown-LEFT", this.handleSliderLeft);
    this.scene.input.keyboard?.off("keydown-RIGHT", this.handleSliderRight);
  }
}
