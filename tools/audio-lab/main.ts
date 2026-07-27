import {
  getAudioSystem,
  BGM_ASSETS,
  SFX_ASSETS,
  type BgmStateId,
  type SfxCategory,
} from "../../src/systems/audio";

// Reuses the real AudioSystem singleton — no duplicated audio logic here,
// per the "don't fake it twice" requirement in the task spec.
const audio = getAudioSystem();
void audio.initialize();

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const unlockBtn = $<HTMLButtonElement>("unlockBtn");
const unlockStatus = $<HTMLSpanElement>("unlockStatus");
const directorButtonsEl = $<HTMLDivElement>("directorButtons");
const crossfadeRange = $<HTMLInputElement>("crossfadeRange");
const crossfadeValue = $<HTMLSpanElement>("crossfadeValue");
const bgmButtonsEl = $<HTMLDivElement>("bgmButtons");
const stopBgmBtn = $<HTMLButtonElement>("stopBgmBtn");
const masterRange = $<HTMLInputElement>("masterRange");
const masterValue = $<HTMLSpanElement>("masterValue");
const bgmRange = $<HTMLInputElement>("bgmRange");
const bgmValue = $<HTMLSpanElement>("bgmValue");
const sfxRange = $<HTMLInputElement>("sfxRange");
const sfxValue = $<HTMLSpanElement>("sfxValue");
const muteCheck = $<HTMLInputElement>("muteCheck");
const unfocusCheck = $<HTMLInputElement>("unfocusCheck");
const combatSfxMode = $<HTMLSelectElement>("combatSfxMode");
const resetSettingsBtn = $<HTMLButtonElement>("resetSettingsBtn");
const reloadBtn = $<HTMLButtonElement>("reloadBtn");
const sfxContainerEl = $<HTMLDivElement>("sfxContainer");
const stopAllSfxBtn = $<HTMLButtonElement>("stopAllSfxBtn");
const spamTestBtn = $<HTMLButtonElement>("spamTestBtn");
const stateEl = $<HTMLPreElement>("state");

const DIRECTOR_STATES: BgmStateId[] = [
  "menu",
  "preparation",
  "battle-low",
  "battle-high",
  "fortress-under-attack",
  "victory",
  "defeat",
];

// ---- unlock -----------------------------------------------------------

unlockBtn.addEventListener("click", () => {
  void audio.unlock().then(() => {
    unlockStatus.textContent = audio.getState().unlocked ? "✅ 활성화됨" : "❌ 실패";
  });
});

// ---- director buttons ---------------------------------------------------

DIRECTOR_STATES.forEach((state) => {
  const btn = document.createElement("button");
  btn.textContent = state;
  btn.addEventListener("click", () => audio.setDirectorState(state));
  directorButtonsEl.appendChild(btn);
});

const resetDirectorBtn = document.createElement("button");
resetDirectorBtn.textContent = "reset()";
resetDirectorBtn.addEventListener("click", () => audio.resetDirector("menu"));
directorButtonsEl.appendChild(resetDirectorBtn);

crossfadeRange.addEventListener("input", () => {
  const ms = Number(crossfadeRange.value);
  crossfadeValue.textContent = String(ms);
  audio.setCrossfadeDuration(ms);
});

// ---- BGM buttons ----------------------------------------------------------

BGM_ASSETS.forEach((asset) => {
  const btn = document.createElement("button");
  btn.textContent = asset.label + (asset.missingAsset ? " (합성)" : "");
  if (asset.missingAsset) btn.classList.add("missing");
  btn.addEventListener("click", () => audio.playBgm(asset.id));
  btn.dataset.assetId = asset.id;
  bgmButtonsEl.appendChild(btn);
});

stopBgmBtn.addEventListener("click", () => audio.stopBgm());

// ---- volume / settings ----------------------------------------------------

function syncSettingsUi(): void {
  const s = audio.getState().settings;
  masterRange.value = String(s.masterVolume);
  masterValue.textContent = s.masterVolume.toFixed(2);
  bgmRange.value = String(s.bgmVolume);
  bgmValue.textContent = s.bgmVolume.toFixed(2);
  sfxRange.value = String(s.sfxVolume);
  sfxValue.textContent = s.sfxVolume.toFixed(2);
  muteCheck.checked = s.mute;
  unfocusCheck.checked = s.muteWhenUnfocused;
  combatSfxMode.value = s.combatSfxMode;
  crossfadeRange.value = String(s.crossfadeDurationMs);
  crossfadeValue.textContent = String(s.crossfadeDurationMs);
}

masterRange.addEventListener("input", () => {
  audio.setMasterVolume(Number(masterRange.value));
  masterValue.textContent = Number(masterRange.value).toFixed(2);
});
bgmRange.addEventListener("input", () => {
  audio.setBgmVolume(Number(bgmRange.value));
  bgmValue.textContent = Number(bgmRange.value).toFixed(2);
});
sfxRange.addEventListener("input", () => {
  audio.setSfxVolume(Number(sfxRange.value));
  sfxValue.textContent = Number(sfxRange.value).toFixed(2);
});
muteCheck.addEventListener("change", () => audio.setMuted(muteCheck.checked));
unfocusCheck.addEventListener("change", () => audio.setMuteWhenUnfocused(unfocusCheck.checked));
combatSfxMode.addEventListener("change", () => {
  audio.setCombatSfxMode(combatSfxMode.value as "off" | "reduced" | "full");
});
resetSettingsBtn.addEventListener("click", () => {
  audio.resetSettings();
  syncSettingsUi();
});
reloadBtn.addEventListener("click", () => location.reload());

// ---- SFX buttons ------------------------------------------------------

const categories: SfxCategory[] = ["ui", "wave", "combat", "capture", "construction", "state"];
categories.forEach((category) => {
  const items = SFX_ASSETS.filter((a) => a.category === category);
  if (items.length === 0) return;
  const label = document.createElement("div");
  label.className = "category";
  label.textContent = category;
  sfxContainerEl.appendChild(label);

  const grid = document.createElement("div");
  grid.className = "grid";
  items.forEach((asset) => {
    const btn = document.createElement("button");
    btn.textContent = asset.label;
    if (asset.missingAsset) {
      btn.classList.add("missing");
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "합성";
      btn.appendChild(badge);
    }
    btn.addEventListener("click", () => {
      const result = audio.playSfx(asset.id);
      if (result !== "played") {
        btn.title = `결과: ${result}`;
      }
    });
    btn.dataset.assetId = asset.id;
    grid.appendChild(btn);
  });
  sfxContainerEl.appendChild(grid);
});

stopAllSfxBtn.addEventListener("click", () => audio.stopAllSfx());

spamTestBtn.addEventListener("click", () => {
  // Deliberately fires far faster than the cooldown/concurrency caps allow —
  // exercises both limits at once. Watch "활성 SFX" in the state panel.
  let i = 0;
  const id = setInterval(() => {
    audio.playSfx("sfx.combat.unitHit");
    i += 1;
    if (i >= 20) clearInterval(id);
  }, 20);
});

// ---- state panel --------------------------------------------------------

function renderState(): void {
  const s = audio.getState();
  const missing = audio.getMissingAssets();
  stateEl.textContent = JSON.stringify(
    {
      unlocked: s.unlocked,
      currentBgmId: s.currentBgmId,
      bgmState: s.bgmState,
      activeBgmVoices: s.activeBgmVoices,
      activeSfxVoices: s.activeSfxVoices,
      lastError: s.lastError,
      missingAssetCounts: { bgm: missing.bgm.length, sfx: missing.sfx.length },
    },
    null,
    2
  );

  bgmButtonsEl.querySelectorAll("button").forEach((el) => {
    const btn = el as HTMLButtonElement;
    btn.classList.toggle("active", btn.dataset.assetId === s.currentBgmId);
  });
}

syncSettingsUi();
renderState();
setInterval(renderState, 300);
