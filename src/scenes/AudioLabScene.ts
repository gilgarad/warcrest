import Phaser from "phaser";
import {
  getAudioSystem,
  BGM_ASSETS,
  SFX_ASSETS,
  type AudioSystem,
  type BgmStateId,
  type CombatSfxMode,
  type SfxCategory,
} from "../systems/audio";

/**
 * In-game audio listening/preview tool, reachable via `?sandbox=2` the same
 * way `?sandbox=1` reaches `UnitSandboxScene`. Ports `tools/audio-lab/`'s
 * standalone (non-bundled, dev-only) HTML prototype into a real Phaser scene
 * against the same `src/systems/audio` module, so it works in the actual
 * built game (Playwright/mobile/deployed) instead of only via a manual
 * `vite` dev-server URL.
 */
const DIRECTOR_STATES: BgmStateId[] = [
  "menu",
  "preparation",
  "battle-low",
  "battle-high",
  "fortress-under-attack",
  "victory",
  "defeat",
];

const CATEGORY_LABELS: Record<SfxCategory, string> = {
  ui: "UI",
  wave: "웨이브",
  combat: "전투/타격음",
  capture: "점령",
  construction: "건설",
  state: "상태",
};

const COMBAT_SFX_MODES: CombatSfxMode[] = ["off", "reduced", "full"];

export class AudioLabScene extends Phaser.Scene {
  private audio!: AudioSystem;
  private stateText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer = 0;
  private masterValueText!: Phaser.GameObjects.Text;
  private bgmValueText!: Phaser.GameObjects.Text;
  private sfxValueText!: Phaser.GameObjects.Text;
  private muteButton!: { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };
  private unfocusButton!: { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };
  private combatModeButton!: { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text };
  private bgmButtons: { id: string; rect: Phaser.GameObjects.Rectangle }[] = [];
  private unlockStatusText!: Phaser.GameObjects.Text;

  constructor() {
    super("audio-lab");
  }

  create(): void {
    this.audio = getAudioSystem();
    void this.audio.initialize();
    this.cameras.main.setBackgroundColor("#0b0e16");

    this.add.text(24, 16, "오디오 랩 — SFX/BGM 미리듣기", {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: "#f4ebd3",
      stroke: "#1a0f07",
      strokeThickness: 4,
    });
    this.add.text(24, 46, "실제 게임의 src/systems/audio를 그대로 사용합니다. 파일 있음 = 실제 mp3 재생, 없음(합성) = Web Audio 런타임 합성.", {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#8890b0",
    });

    this.createUnlockRow();
    const afterSettingsY = this.createVolumeAndSettingsPanel();
    const afterDirectorY = this.createDirectorPanel(afterSettingsY + 16);
    this.createBgmPanel(afterDirectorY);
    this.createSfxPanel();

    this.toastText = this.add.text(800, 900 - 70, "", {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#f4d35e",
    }).setOrigin(0.5, 1);

    this.stateText = this.add.text(24, 900 - 46, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#9dc1e4",
    });
  }

  update(_time: number, delta: number): void {
    this.refreshState();
    if (this.toastTimer > 0) {
      this.toastTimer -= delta;
      if (this.toastTimer <= 0) this.toastText.setText("");
    }
  }

  private showToast(text: string): void {
    this.toastText.setText(text);
    this.toastTimer = 1600;
  }

  private createUnlockRow(): void {
    this.makeButton(24, 74, 180, 34, "🔓 오디오 활성화", () => {
      void this.audio.unlock().then(() => {
        this.unlockStatusText.setText(this.audio.getState().unlocked ? "✅ 활성화됨" : "❌ 실패");
      });
    });
    this.unlockStatusText = this.add.text(216, 82, "", { fontFamily: "sans-serif", fontSize: "13px", color: "#8dffa8" });
  }

  private createVolumeAndSettingsPanel(): number {
    const x = 1180;
    let y = 74;
    this.add.text(x, y, "볼륨 / 설정", { fontFamily: "sans-serif", fontSize: "16px", color: "#f2f6ff" });
    y += 28;

    const stepper = (label: string, get: () => number, set: (v: number) => void): Phaser.GameObjects.Text => {
      this.add.text(x, y + 6, label, { fontFamily: "sans-serif", fontSize: "13px", color: "#c5d6e8" });
      const valueText = this.add.text(x + 90, y + 6, get().toFixed(2), { fontFamily: "monospace", fontSize: "13px", color: "#edf5ff" });
      this.makeButton(x + 150, y, 26, 26, "-", () => {
        set(Phaser.Math.Clamp(get() - 0.05, 0, 1));
        valueText.setText(get().toFixed(2));
      });
      this.makeButton(x + 182, y, 26, 26, "+", () => {
        set(Phaser.Math.Clamp(get() + 0.05, 0, 1));
        valueText.setText(get().toFixed(2));
      });
      y += 34;
      return valueText;
    };

    const s = this.audio.getState().settings;
    this.masterValueText = stepper("Master", () => this.audio.getState().settings.masterVolume, (v) => this.audio.setMasterVolume(v));
    this.bgmValueText = stepper("BGM", () => this.audio.getState().settings.bgmVolume, (v) => this.audio.setBgmVolume(v));
    this.sfxValueText = stepper("SFX", () => this.audio.getState().settings.sfxVolume, (v) => this.audio.setSfxVolume(v));

    this.muteButton = this.makeToggleButton(x, y, 220, 30, "전체 음소거", s.mute, (next) => this.audio.setMuted(next));
    y += 36;
    this.unfocusButton = this.makeToggleButton(x, y, 220, 30, "탭 비활성화 시 음소거", s.muteWhenUnfocused, (next) => this.audio.setMuteWhenUnfocused(next));
    y += 36;

    const cycleCombatMode = (): void => {
      const current = this.audio.getState().settings.combatSfxMode;
      const idx = COMBAT_SFX_MODES.indexOf(current);
      const next = COMBAT_SFX_MODES[(idx + 1) % COMBAT_SFX_MODES.length];
      this.audio.setCombatSfxMode(next);
      this.combatModeButton.text.setText(`전투 효과음: ${next}`);
    };
    this.combatModeButton = this.makeButton(x, y, 220, 30, `전투 효과음: ${s.combatSfxMode}`, cycleCombatMode);
    y += 40;

    this.makeButton(x, y, 220, 30, "설정 초기화", () => {
      this.audio.resetSettings();
      const reset = this.audio.getState().settings;
      this.masterValueText.setText(reset.masterVolume.toFixed(2));
      this.bgmValueText.setText(reset.bgmVolume.toFixed(2));
      this.sfxValueText.setText(reset.sfxVolume.toFixed(2));
      this.muteButton.text.setText(`전체 음소거: ${reset.mute ? "ON" : "OFF"}`);
      this.unfocusButton.text.setText(`탭 비활성화 시 음소거: ${reset.muteWhenUnfocused ? "ON" : "OFF"}`);
      this.combatModeButton.text.setText(`전투 효과음: ${reset.combatSfxMode}`);
    });
    y += 30;
    return y;
  }

  private createDirectorPanel(startY: number): number {
    const x = 1180;
    const y = startY;
    this.add.text(x, y, "AudioDirector — 상황별 음악", { fontFamily: "sans-serif", fontSize: "16px", color: "#f2f6ff" });
    const cols = 2;
    const w = 108;
    const h = 30;
    const rows = Math.ceil((DIRECTOR_STATES.length + 1) / cols);
    [...DIRECTOR_STATES, "reset"].forEach((state, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = x + col * (w + 8);
      const by = y + 28 + row * (h + 6);
      this.makeButton(bx, by, w, h, state, () => {
        if (state === "reset") this.audio.resetDirector("menu");
        else this.audio.setDirectorState(state as BgmStateId);
      }, 10);
    });
    return y + 28 + rows * (h + 6) + 10;
  }

  private createBgmPanel(startY: number): void {
    const x = 1180;
    let y = startY;
    this.add.text(x, y, "BGM 개별 재생", { fontFamily: "sans-serif", fontSize: "16px", color: "#f2f6ff" });
    y += 26;
    BGM_ASSETS.forEach((asset) => {
      const label = asset.label + (asset.missingAsset ? " (합성)" : "");
      const { rect } = this.makeButton(x, y, 356, 24, label, () => this.audio.playBgm(asset.id), 12);
      this.bgmButtons.push({ id: asset.id, rect });
      y += 27;
    });
    this.makeButton(x, y + 4, 140, 28, "■ BGM 정지", () => this.audio.stopBgm());
  }

  private createSfxPanel(): void {
    const x = 24;
    let y = 120;
    this.add.text(x, y, "SFX (카테고리별)", { fontFamily: "sans-serif", fontSize: "16px", color: "#f2f6ff" });
    y += 26;

    const cols = 6;
    const btnW = 172;
    const btnH = 24;
    const gap = 6;
    const categories: SfxCategory[] = ["ui", "wave", "combat", "capture", "construction", "state"];
    categories.forEach((category) => {
      const items = SFX_ASSETS.filter((a) => a.category === category);
      if (items.length === 0) return;
      this.add.text(x, y, CATEGORY_LABELS[category], { fontFamily: "sans-serif", fontSize: "12px", color: "#8890b0" });
      y += 18;
      items.forEach((asset, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = x + col * (btnW + gap);
        const by = y + row * (btnH + gap);
        const label = asset.label + (asset.missingAsset ? " 🔧" : "");
        this.makeButton(bx, by, btnW, btnH, label, () => {
          const result = this.audio.playSfx(asset.id);
          if (result !== "played") this.showToast(`${asset.label}: ${result}`);
        }, 11);
      });
      y += Math.ceil(items.length / cols) * (btnH + gap) + 10;
    });

    this.makeButton(x, y, 160, 30, "■ 모든 SFX 정지", () => this.audio.stopAllSfx());
    this.makeButton(x + 170, y, 200, 30, "⚡ 연타 테스트 (unitHit x20)", () => {
      let i = 0;
      const timer = this.time.addEvent({
        delay: 20,
        repeat: 19,
        callback: () => {
          this.audio.playSfx("sfx.combat.unitHit");
          i += 1;
          if (i >= 20) timer.remove();
        },
      });
    }, 12);
  }

  private refreshState(): void {
    const s = this.audio.getState();
    const missing = this.audio.getMissingAssets();
    this.stateText.setText(
      `unlocked=${s.unlocked} bgm=${s.currentBgmId ?? "-"} bgmState=${s.bgmState ?? "-"} `
      + `voices(bgm=${s.activeBgmVoices},sfx=${s.activeSfxVoices}) missing(bgm=${missing.bgm.length},sfx=${missing.sfx.length}) `
      + `err=${s.lastError ?? "-"}`,
    );
    this.bgmButtons.forEach(({ id, rect }) => {
      rect.setStrokeStyle(2, id === s.currentBgmId ? 0xf2c14e : 0x3a4570, id === s.currentBgmId ? 1 : 0.7);
    });
  }

  private makeButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    fontSize = 13,
  ): { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
    const rect = this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x1c2438, 0.95)
      .setStrokeStyle(2, 0x3a4570, 0.7)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x + width / 2, y + height / 2, label, {
      fontFamily: "sans-serif",
      fontSize: `${fontSize}px`,
      color: "#e6e9f2",
      align: "center",
      wordWrap: { width: width - 8 },
    }).setOrigin(0.5);
    rect.on("pointerover", () => rect.setFillStyle(0x263153, 1));
    rect.on("pointerout", () => rect.setFillStyle(0x1c2438, 0.95));
    rect.on("pointerdown", () => {
      rect.setFillStyle(0xd39f3f, 1);
      this.time.delayedCall(90, () => rect.setFillStyle(0x1c2438, 0.95));
      onClick();
    });
    return { rect, text };
  }

  private makeToggleButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    initial: boolean,
    onChange: (next: boolean) => void,
  ): { rect: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
    let value = initial;
    const button = this.makeButton(x, y, width, height, `${label}: ${value ? "ON" : "OFF"}`, () => {
      value = !value;
      button.text.setText(`${label}: ${value ? "ON" : "OFF"}`);
      onChange(value);
    }, 12);
    return button;
  }
}
