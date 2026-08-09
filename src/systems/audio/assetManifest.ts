import { assetUrl } from "../../config/assetUrl";
import type { BgmAssetDef, GameplayMusicThemeId, SfxAssetDef } from "./types";

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
  gameplayBgm(
    "stone",
    "석기 시대",
    "01_stone_ancient_colossi_v5.ogg",
    0.72,
    { kind: "pad", frequency: 196, durationMs: 0 },
  ),
  gameplayBgm(
    "bronze",
    "청동기",
    "02_bronze_weight_of_discovery_v5.ogg",
    0.72,
    { kind: "pad", frequency: 174.6, durationMs: 0 },
  ),
  gameplayBgm(
    "medieval",
    "철기/중세",
    "03_medieval_iron_procession_v5.ogg",
    0.74,
    { kind: "pulse", frequency: 146.8, durationMs: 0 },
  ),
  gameplayBgm(
    "renaissance",
    "르네상스",
    "04_renaissance_restless_workshop_v6.ogg",
    0.74,
    { kind: "pulse", frequency: 146.8, durationMs: 0 },
  ),
  gameplayBgm(
    "industrial",
    "근대",
    "05_early_modern_age_of_momentum_v6.ogg",
    0.76,
    { kind: "pulse", frequency: 146.8, durationMs: 0 },
  ),
  gameplayBgm(
    "modern",
    "현대",
    "06_modern_forward_vector_v6.ogg",
    0.78,
    { kind: "pulse", frequency: 146.8, durationMs: 0 },
  ),
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

  // -- combat / 병종·시대별 무기 SFX 변형 (weaponSfx.ts 매핑으로 선택) --
  sfx("sfx.combat.meleeAttack.blunt", "근접 공격 - 둔기(석기)", "combat", { kind: "blade", frequency: 300, durationMs: 150 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.55, missingAsset: false }),
  sfx("sfx.combat.meleeAttack.blade", "근접 공격 - 도검", "combat", { kind: "blade", frequency: 430, durationMs: 130 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.55, missingAsset: false }),
  sfx("sfx.combat.meleeAttack.polearm", "근접 공격 - 창(찌르기)", "combat", { kind: "blade", frequency: 560, durationMs: 105 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.53, missingAsset: false }),
  sfx("sfx.combat.meleeAttack.mechanized", "근접 공격 - 근대 돌격", "combat", { kind: "metalClang", frequency: 260, durationMs: 140 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.56, missingAsset: false }),
  sfx("sfx.combat.meleeHit.blunt", "근접 타격 - 둔기(석기)", "combat", { kind: "stoneImpact", frequency: 165, durationMs: 260 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.64, missingAsset: false }),
  sfx("sfx.combat.meleeHit.blade", "근접 타격 - 도검(칼날-방패/갑주 충돌)", "combat", { kind: "metalClang", frequency: 340, durationMs: 300 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.66, missingAsset: false }),
  sfx("sfx.combat.meleeHit.polearm", "근접 타격 - 창(관통음 + 금속 접촉)", "combat", { kind: "metalClang", frequency: 430, durationMs: 250 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.62, missingAsset: false }),
  sfx("sfx.combat.meleeHit.mechanized", "근접 타격 - 근대 돌격(총검/장비 충돌)", "combat", { kind: "metalClang", frequency: 300, durationMs: 320 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.66, missingAsset: false }),
  sfx("sfx.combat.rangedFire.sling", "원거리 발사 - 투석", "combat", { kind: "pluck", frequency: 300, durationMs: 110 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.5, missingAsset: false }),
  sfx("sfx.combat.rangedFire.bow", "원거리 발사 - 활", "combat", { kind: "pluck", frequency: 640, durationMs: 85 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.5, missingAsset: false }),
  sfx("sfx.combat.rangedFire.musket", "원거리 발사 - 화승총/대포 초기", "combat", { kind: "noiseHit", frequency: 900, durationMs: 120 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.62, missingAsset: false }),
  sfx("sfx.combat.rangedFire.rifle", "원거리 발사 - 소총/기관총", "combat", { kind: "noiseHit", frequency: 1250, durationMs: 75 }, { cooldownMs: 55, maxSimultaneous: 8, baseVolume: 0.58, missingAsset: false }),
  sfx("sfx.combat.rangedFire.cannon", "원거리 발사 - 대포/포병", "combat", { kind: "sweepDown", frequency: 150, durationMs: 260 }, { cooldownMs: 150, maxSimultaneous: 3, baseVolume: 0.72, missingAsset: false }),
  sfx("sfx.combat.rangedFire.tank", "원거리 발사 - 전차", "combat", { kind: "impact", frequency: 92, durationMs: 300 }, { cooldownMs: 150, maxSimultaneous: 3, baseVolume: 0.76, missingAsset: false }),
  sfx("sfx.combat.projectileHit.sling", "투사체 충돌 - 투석(돌이 방패/벽에 맞는 소리)", "combat", { kind: "stoneImpact", frequency: 145, durationMs: 240 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.62, missingAsset: false }),
  sfx("sfx.combat.projectileHit.bow", "투사체 충돌 - 화살", "combat", { kind: "impact", frequency: 175, durationMs: 130 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.58, missingAsset: false }),
  sfx("sfx.combat.projectileHit.musket", "투사체 충돌 - 화승총 탄", "combat", { kind: "impact", frequency: 130, durationMs: 160 }, { cooldownMs: 60, maxSimultaneous: 6, baseVolume: 0.66, missingAsset: false }),
  sfx("sfx.combat.projectileHit.rifle", "투사체 충돌 - 소총/기관총 탄", "combat", { kind: "impact", frequency: 155, durationMs: 120 }, { cooldownMs: 50, maxSimultaneous: 8, baseVolume: 0.6, missingAsset: false }),
  sfx("sfx.combat.projectileHit.cannon", "투사체 충돌 - 포탄", "combat", { kind: "impact", frequency: 75, durationMs: 320 }, { cooldownMs: 150, maxSimultaneous: 3, baseVolume: 0.78, missingAsset: false }),
  sfx("sfx.combat.projectileHit.tank", "투사체 충돌 - 전차포", "combat", { kind: "impact", frequency: 65, durationMs: 360 }, { cooldownMs: 150, maxSimultaneous: 3, baseVolume: 0.82, missingAsset: false }),
  sfx("sfx.combat.catapultFire", "투석기 발사", "combat", { kind: "sweepDown", frequency: 180, durationMs: 250 }, { cooldownMs: 300, maxSimultaneous: 2 }),
  sfx("sfx.combat.catapultImpact", "투석기 충돌", "combat", { kind: "stoneImpact", frequency: 78, durationMs: 420 }, { cooldownMs: 300, maxSimultaneous: 2, baseVolume: 0.72 }),
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
  overrides: Partial<Pick<SfxAssetDef, "cooldownMs" | "maxSimultaneous" | "priority" | "pitchVariation" | "volumeVariation" | "spatial" | "baseVolume" | "missingAsset">> = {}
): SfxAssetDef {
  const missingAsset = overrides.missingAsset ?? true;
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
    missingAsset,
    synth,
    licenseNote: missingAsset
      ? NO_ASSET_YET
      : "Kenney CC0 녹음(tools/audio-synth/vendor/)을 분석만 하고 직접 파형은 사용하지 않는 " +
        "분석 기반 재합성 (tools/audio-synth/render_combat_sfx.py) — 원본과 파형 비동일, 라이선스 제약 없음",
  };
}

function gameplayBgm(
  themeId: GameplayMusicThemeId,
  label: string,
  filename: string,
  baseVolume: number,
  synth: BgmAssetDef["synth"],
): BgmAssetDef {
  return {
    id: `bgm.age.${themeId}`,
    label: `시대 BGM - ${label}`,
    filePath: assetUrl(`assets/audio/${filename}`),
    loop: true,
    baseVolume,
    missingAsset: false,
    synth,
    licenseNote: "프로젝트 로컬 시대별 BGM 파일",
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
