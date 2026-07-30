import { assetUrl } from "../../config/assetUrl";
import type { BgmAssetDef, SfxAssetDef } from "./types";

const NO_ASSET_YET = "실제 오디오 파일 없음 — 외부 자산 없이 Web Audio 런타임 합성으로 대체 중";

/**
 * BGM manifest. Every entry's `filePath` is where a real file *would* live —
 * none exist yet (`missingAsset: true` on all of them), so BgmManager falls
 * back to the paired `synth` profile. Once a real file is dropped at
 * `filePath`, flip `missingAsset` to `false` and playback switches to the
 * file automatically (see `backend.ts`).
 */
export const BGM_ASSETS: BgmAssetDef[] = [
  {
    id: "bgm.menu",
    label: "메뉴/타이틀",
    filePath: assetUrl("assets/audio/bgm/menu.mp3"),
    loop: true,
    baseVolume: 0.5,
    missingAsset: true,
    synth: { kind: "pad", frequency: 196, durationMs: 0 },
    licenseNote: NO_ASSET_YET,
  },
  {
    id: "bgm.preparation",
    label: "준비/배치 단계",
    filePath: assetUrl("assets/audio/bgm/preparation.mp3"),
    loop: true,
    baseVolume: 0.45,
    missingAsset: true,
    synth: { kind: "pad", frequency: 174.6, durationMs: 0 },
    licenseNote: NO_ASSET_YET,
  },
  {
    id: "bgm.battle.low",
    label: "전투 — 저강도",
    filePath: assetUrl("assets/audio/bgm/battle-low.mp3"),
    loop: true,
    baseVolume: 0.55,
    missingAsset: true,
    synth: { kind: "pad", frequency: 146.8, durationMs: 0 },
    licenseNote: NO_ASSET_YET,
  },
  {
    id: "bgm.battle.high",
    label: "전투 — 고강도",
    filePath: assetUrl("assets/audio/bgm/battle-high.mp3"),
    loop: true,
    baseVolume: 0.65,
    missingAsset: true,
    synth: { kind: "pulse", frequency: 146.8, durationMs: 0 },
    licenseNote: NO_ASSET_YET,
  },
  {
    id: "bgm.victory",
    label: "승리",
    filePath: assetUrl("assets/audio/bgm/victory.mp3"),
    loop: false,
    baseVolume: 0.6,
    missingAsset: true,
    synth: { kind: "chime", frequency: 261.6, durationMs: 0 },
    licenseNote: NO_ASSET_YET,
  },
  {
    id: "bgm.defeat",
    label: "패배",
    filePath: assetUrl("assets/audio/bgm/defeat.mp3"),
    loop: false,
    baseVolume: 0.5,
    missingAsset: true,
    synth: { kind: "pad", frequency: 98, durationMs: 0 },
    licenseNote: NO_ASSET_YET,
  },
];

export const SFX_ASSETS: SfxAssetDef[] = [
  // -- UI --
  sfx("sfx.ui.hover", "버튼 hover", "ui", { kind: "pluck", frequency: 880, durationMs: 60 }),
  sfx("sfx.ui.confirm", "버튼 confirm", "ui", { kind: "pluck", frequency: 660, durationMs: 120 }),
  sfx("sfx.ui.cancel", "버튼 cancel", "ui", { kind: "pluck", frequency: 330, durationMs: 120 }),
  sfx("sfx.ui.acknowledge", "선택/확인 응답", "ui", { kind: "pluck", frequency: 587.3, durationMs: 90 }, { cooldownMs: 80, baseVolume: 0.62, pitchVariation: 0.035, volumeVariation: 0.04 }),
  sfx("sfx.ui.hireSuccess", "구매/고용 성공", "ui", { kind: "chime", frequency: 523.3, durationMs: 220 }),
  sfx("sfx.ui.hireFail", "구매/고용 실패", "ui", { kind: "noiseHit", frequency: 220, durationMs: 140 }),
  sfx("sfx.ui.buildSelect", "건설 선택", "ui", { kind: "pluck", frequency: 494, durationMs: 100 }),
  sfx("sfx.ui.settingsChange", "설정 변경", "ui", { kind: "pluck", frequency: 740, durationMs: 60 }),

  // -- wave / combat --
  sfx("sfx.wave.prepare", "웨이브 준비", "wave", { kind: "sweepUp", frequency: 220, durationMs: 400 }, { cooldownMs: 800 }),
  sfx("sfx.wave.start", "웨이브 시작", "wave", { kind: "chime", frequency: 349.2, durationMs: 300 }, { cooldownMs: 800 }),
  sfx("sfx.combat.meleeAttack", "근접 공격", "combat", { kind: "blade", frequency: 420, durationMs: 130 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.55 }),
  sfx("sfx.combat.meleeHit", "근접 타격", "combat", { kind: "blade", frequency: 310, durationMs: 170 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.62 }),
  sfx("sfx.combat.rangedFire", "원거리 발사", "combat", { kind: "pluck", frequency: 520, durationMs: 90 }, { cooldownMs: 60, maxSimultaneous: 6 }),
  sfx("sfx.combat.projectileHit", "투사체 충돌", "combat", { kind: "impact", frequency: 150, durationMs: 180 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.64 }),
  sfx("sfx.combat.slashAttack", "베기 공격", "combat", { kind: "blade", frequency: 470, durationMs: 120 }, { cooldownMs: 70, maxSimultaneous: 5, baseVolume: 0.56, pitchVariation: 0.05 }),
  sfx("sfx.combat.slashHit", "베기 타격", "combat", { kind: "blade", frequency: 290, durationMs: 165 }, { cooldownMs: 70, maxSimultaneous: 5, baseVolume: 0.66, pitchVariation: 0.04 }),
  sfx("sfx.combat.bluntAttack", "둔기 공격", "combat", { kind: "impact", frequency: 210, durationMs: 120 }, { cooldownMs: 90, maxSimultaneous: 4, baseVolume: 0.58, pitchVariation: 0.035 }),
  sfx("sfx.combat.bluntHit", "둔기 타격", "combat", { kind: "impact", frequency: 118, durationMs: 190 }, { cooldownMs: 90, maxSimultaneous: 4, baseVolume: 0.72, pitchVariation: 0.03 }),
  sfx("sfx.combat.bowFire", "활 발사", "combat", { kind: "pluck", frequency: 610, durationMs: 95 }, { cooldownMs: 85, maxSimultaneous: 5, baseVolume: 0.52, pitchVariation: 0.045 }),
  sfx("sfx.combat.bowHit", "화살 명중", "combat", { kind: "impact", frequency: 175, durationMs: 150 }, { cooldownMs: 85, maxSimultaneous: 5, baseVolume: 0.58, pitchVariation: 0.04 }),
  sfx("sfx.combat.thrownFire", "투척 발사", "combat", { kind: "sweepDown", frequency: 245, durationMs: 155 }, { cooldownMs: 120, maxSimultaneous: 4, baseVolume: 0.56, pitchVariation: 0.03 }),
  sfx("sfx.combat.thrownHit", "투척 명중", "combat", { kind: "impact", frequency: 104, durationMs: 215 }, { cooldownMs: 120, maxSimultaneous: 4, baseVolume: 0.7, pitchVariation: 0.03 }),
  sfx("sfx.combat.shotFire", "사격 발사", "combat", { kind: "impact", frequency: 330, durationMs: 105 }, { cooldownMs: 150, maxSimultaneous: 3, baseVolume: 0.6, pitchVariation: 0.025 }),
  sfx("sfx.combat.shotHit", "사격 명중", "combat", { kind: "impact", frequency: 205, durationMs: 145 }, { cooldownMs: 150, maxSimultaneous: 3, baseVolume: 0.62, pitchVariation: 0.025 }),
  sfx("sfx.combat.attackShout", "공격 기합", "combat", { kind: "grunt", frequency: 235, durationMs: 125 }, { cooldownMs: 260, maxSimultaneous: 3, baseVolume: 0.34, pitchVariation: 0.08, volumeVariation: 0.05 }),
  sfx("sfx.combat.catapultFire", "투석기 발사", "combat", { kind: "sweepDown", frequency: 180, durationMs: 250 }, { cooldownMs: 300, maxSimultaneous: 2 }),
  sfx("sfx.combat.catapultImpact", "투석기 충돌", "combat", { kind: "impact", frequency: 82, durationMs: 360 }, { cooldownMs: 300, maxSimultaneous: 2, baseVolume: 0.72 }),
  sfx("sfx.combat.unitHit", "유닛 피격", "combat", { kind: "grunt", frequency: 165, durationMs: 190 }, { cooldownMs: 40, maxSimultaneous: 8, baseVolume: 0.48 }),
  sfx("sfx.combat.unitDeath", "유닛 사망", "combat", { kind: "grunt", frequency: 125, durationMs: 420 }, { cooldownMs: 80, maxSimultaneous: 4, baseVolume: 0.58 }),
  sfx("sfx.combat.towerAttack", "타워 공격", "combat", { kind: "impact", frequency: 115, durationMs: 220 }, { cooldownMs: 150, maxSimultaneous: 3, baseVolume: 0.64 }),
  sfx("sfx.combat.towerHit", "타워 피격", "combat", { kind: "impact", frequency: 95, durationMs: 260 }, { cooldownMs: 150, maxSimultaneous: 3, baseVolume: 0.68 }),
  sfx("sfx.support.heal", "보급대 치유", "combat", { kind: "healChime", frequency: 659.3, durationMs: 520 }, { cooldownMs: 450, maxSimultaneous: 3, baseVolume: 0.52, pitchVariation: 0.025 }),

  // -- base / construction --
  sfx("sfx.capture.progress", "점령 진행", "capture", { kind: "pluck", frequency: 440, durationMs: 60 }, { cooldownMs: 400 }),
  sfx("sfx.capture.complete", "점령 완료", "capture", { kind: "chime", frequency: 587.3, durationMs: 260 }, { cooldownMs: 500 }),
  sfx("sfx.capture.lost", "점령 상실", "capture", { kind: "sweepDown", frequency: 300, durationMs: 260 }, { cooldownMs: 500 }),
  sfx("sfx.construction.start", "건설 시작", "construction", { kind: "pluck", frequency: 392, durationMs: 100 }, { cooldownMs: 300 }),
  sfx("sfx.construction.complete", "건설 완료", "construction", { kind: "chime", frequency: 440, durationMs: 240 }, { cooldownMs: 300 }),
  sfx("sfx.construction.repair", "수리", "construction", { kind: "pluck", frequency: 349.2, durationMs: 90 }, { cooldownMs: 200, maxSimultaneous: 3 }),
  sfx("sfx.fortress.warning", "요새 경고", "state", { kind: "pulse", frequency: 220, durationMs: 320 }, { cooldownMs: 1200, priority: 9 }),
  sfx("sfx.fortress.destroyed", "요새 파괴/비활성화", "state", { kind: "sweepDown", frequency: 160, durationMs: 500 }, { cooldownMs: 2000, priority: 10 }),
  sfx("sfx.fortress.rebuilt", "요새 재건", "state", { kind: "chime", frequency: 392, durationMs: 320 }, { cooldownMs: 2000, priority: 8 }),

  // -- game state --
  sfx("sfx.state.resourceGain", "자원 획득", "state", { kind: "pluck", frequency: 698.5, durationMs: 70 }, { cooldownMs: 150, maxSimultaneous: 3 }),
  sfx("sfx.state.resourceShortage", "자원 부족", "state", { kind: "noiseHit", frequency: 180, durationMs: 120 }, { cooldownMs: 600 }),
  sfx("sfx.state.victory", "승리", "state", { kind: "chime", frequency: 659.3, durationMs: 500 }, { cooldownMs: 5000, priority: 10 }),
  sfx("sfx.state.defeat", "패배", "state", { kind: "sweepDown", frequency: 220, durationMs: 500 }, { cooldownMs: 5000, priority: 10 }),
];

function sfx(
  id: string,
  label: string,
  category: SfxAssetDef["category"],
  synth: SfxAssetDef["synth"],
  overrides: Partial<Pick<SfxAssetDef, "cooldownMs" | "maxSimultaneous" | "priority" | "pitchVariation" | "volumeVariation" | "spatial" | "baseVolume">> = {}
): SfxAssetDef {
  return {
    id,
    label,
    category,
    filePath: assetUrl(`assets/audio/sfx/${id.replace(/^sfx\./, "").replace(/\./g, "-")}.mp3`),
    baseVolume: overrides.baseVolume ?? 0.7,
    cooldownMs: overrides.cooldownMs ?? 120,
    maxSimultaneous: overrides.maxSimultaneous ?? 4,
    priority: overrides.priority ?? 5,
    pitchVariation: overrides.pitchVariation ?? 0.06,
    volumeVariation: overrides.volumeVariation ?? 0.08,
    spatial: overrides.spatial ?? false,
    missingAsset: true,
    synth,
    licenseNote: NO_ASSET_YET,
  };
}

const bgmById = new Map(BGM_ASSETS.map((a) => [a.id, a]));
const sfxById = new Map(SFX_ASSETS.map((a) => [a.id, a]));

export function getBgmAsset(id: string): BgmAssetDef | undefined {
  return bgmById.get(id);
}

export function getSfxAsset(id: string): SfxAssetDef | undefined {
  return sfxById.get(id);
}

export function listMissingAssets(): { bgm: string[]; sfx: string[] } {
  return {
    bgm: BGM_ASSETS.filter((a) => a.missingAsset).map((a) => a.id),
    sfx: SFX_ASSETS.filter((a) => a.missingAsset).map((a) => a.id),
  };
}
