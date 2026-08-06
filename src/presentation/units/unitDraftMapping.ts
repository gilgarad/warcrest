import type { AgeId } from "../../data/ages";
import type { BattleUnitId } from "../../data/unitRosters";

export interface UnitDraftReference {
  boardPath: string;
  column: number;
  conceptLabel: string;
  notes: string;
}

export const SUPPORT_WAGON_DRAFT_MAPPING: Record<
  "ancient_classical" | "iron" | "renaissance" | "industrial" | "modern_early" | "modern_mid_late",
  UnitDraftReference
> = {
  ancient_classical: {
    boardPath: "docs/dev-wiki/visual-drafts/support-wagon-age-drafts-2026-08-03.png",
    column: 1,
    conceptLabel: "Primitive porter frame",
    notes: "석기/청동기 보급대 기준 시안",
  },
  iron: {
    boardPath: "docs/dev-wiki/visual-drafts/support-wagon-age-drafts-2026-08-03.png",
    column: 2,
    conceptLabel: "Iron logistics bearer",
    notes: "철기 보급대 기준 시안",
  },
  renaissance: {
    boardPath: "docs/dev-wiki/visual-drafts/support-wagon-age-drafts-2026-08-03.png",
    column: 3,
    conceptLabel: "Renaissance powder porter",
    notes: "르네상스 보급대 기준 시안",
  },
  industrial: {
    boardPath: "docs/dev-wiki/visual-drafts/support-wagon-age-drafts-2026-08-03.png",
    column: 4,
    conceptLabel: "Industrial field hauler",
    notes: "근대 보급대 기준 시안",
  },
  modern_early: {
    boardPath: "docs/dev-wiki/visual-drafts/support-wagon-age-drafts-2026-08-03.png",
    column: 5,
    conceptLabel: "Early modern logistics trooper",
    notes: "현대 초기 보급대 기준 시안",
  },
  modern_mid_late: {
    boardPath: "docs/dev-wiki/visual-drafts/support-wagon-age-drafts-2026-08-03.png",
    column: 6,
    conceptLabel: "Late modern modular operator",
    notes: "현대 중기/후기 보급대 기준 시안",
  },
};

export const POST_RENAISSANCE_UNIT_DRAFT_MAPPING: Partial<Record<BattleUnitId, UnitDraftReference>> = {
  pikeman: {
    boardPath: "docs/dev-wiki/visual-drafts/renaissance-industrial-early-drafts-2026-08-03.png",
    column: 1,
    conceptLabel: "Renaissance pikeman",
    notes: "장창병 전용 시안",
  },
  heavy_cavalry: {
    boardPath: "docs/dev-wiki/visual-drafts/renaissance-industrial-early-drafts-2026-08-03.png",
    column: 2,
    conceptLabel: "Renaissance heavy cavalry",
    notes: "중기병 전용 시안",
  },
  rifleman: {
    boardPath: "docs/dev-wiki/visual-drafts/renaissance-industrial-early-drafts-2026-08-03.png",
    column: 3,
    conceptLabel: "Industrial rifleman I",
    notes: "소총병 I 전용 시안",
  },
  grenadier: {
    boardPath: "docs/dev-wiki/visual-drafts/renaissance-industrial-early-drafts-2026-08-03.png",
    column: 4,
    conceptLabel: "Industrial grenadier I",
    notes: "척탄병 I 전용 시안",
  },
  rifleman_late: {
    boardPath: "docs/dev-wiki/visual-drafts/industrial-late-modern-early-drafts-2026-08-03.png",
    column: 1,
    conceptLabel: "Industrial rifleman II",
    notes: "소총병 II 전용 시안",
  },
  grenadier_late: {
    boardPath: "docs/dev-wiki/visual-drafts/industrial-late-modern-early-drafts-2026-08-03.png",
    column: 2,
    conceptLabel: "Industrial grenadier II",
    notes: "척탄병 II 전용 시안",
  },
  cavalry: {
    boardPath: "docs/dev-wiki/visual-drafts/industrial-late-modern-early-drafts-2026-08-03.png",
    column: 3,
    conceptLabel: "Industrial cavalry",
    notes: "기병대 전용 시안",
  },
  cannon_ii: {
    boardPath: "docs/dev-wiki/visual-drafts/industrial-late-modern-early-drafts-2026-08-03.png",
    column: 4,
    conceptLabel: "Cannon II team",
    notes: "대포 II 전용 시안",
  },
  infantry: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-early-mid-infantry-drafts-2026-08-03.png",
    column: 1,
    conceptLabel: "Modern infantry",
    notes: "보병 전용 시안",
  },
  machine_gunner: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-early-mid-infantry-drafts-2026-08-03.png",
    column: 2,
    conceptLabel: "Modern machine gunner",
    notes: "기관총병 전용 시안",
  },
  shock_trooper: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-early-mid-infantry-drafts-2026-08-03.png",
    column: 3,
    conceptLabel: "Shock trooper",
    notes: "돌격병 전용 시안",
  },
  automatic_rifleman: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-early-mid-infantry-drafts-2026-08-03.png",
    column: 4,
    conceptLabel: "Automatic rifleman",
    notes: "자동소총병 전용 시안",
  },
  support_gunner: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-early-mid-infantry-drafts-2026-08-03.png",
    column: 5,
    conceptLabel: "Support gunner",
    notes: "지원화기병 전용 시안",
  },
  mobile_infantry: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-early-mid-infantry-drafts-2026-08-03.png",
    column: 6,
    conceptLabel: "Mobile infantry",
    notes: "기동병 전용 시안",
  },
  artillery_i: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-heavy-drafts-2026-08-03.png",
    column: 1,
    conceptLabel: "Artillery I",
    notes: "포병 I 전용 시안",
  },
  artillery_ii: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-heavy-drafts-2026-08-03.png",
    column: 2,
    conceptLabel: "Artillery II",
    notes: "포병 II 전용 시안",
  },
  tank: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-heavy-drafts-2026-08-03.png",
    column: 3,
    conceptLabel: "Modern tank",
    notes: "전차 전용 시안",
  },
  special_forces: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-heavy-drafts-2026-08-03.png",
    column: 4,
    conceptLabel: "Special forces",
    notes: "특수보병 전용 시안",
  },
  heavy_gunner: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-heavy-drafts-2026-08-03.png",
    column: 5,
    conceptLabel: "Heavy gunner",
    notes: "중화기병 전용 시안",
  },
  mobile_artillery: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-heavy-drafts-2026-08-03.png",
    column: 6,
    conceptLabel: "Heavy mechanized artillery/tank family",
    notes: "자주포 기준 시안. 현대 전차와 실루엣 어군 공유 가능",
  },
  modern_tank: {
    boardPath: "docs/dev-wiki/visual-drafts/modern-heavy-drafts-2026-08-03.png",
    column: 6,
    conceptLabel: "Heavy mechanized artillery/tank family",
    notes: "현대 전차 기준 시안. 자주포보다 더 무겁게 분화 예정",
  },
};

export const SUPPORT_WAGON_DRAFT_AGE_GROUP: Partial<Record<AgeId, keyof typeof SUPPORT_WAGON_DRAFT_MAPPING>> = {
  stone: "ancient_classical",
  bronze: "ancient_classical",
  iron_early: "iron",
  iron_mid: "iron",
  iron_late: "iron",
  renaissance: "renaissance",
  industrial_early: "industrial",
  industrial_late: "industrial",
  modern_early: "modern_early",
  modern_mid: "modern_mid_late",
  modern_late: "modern_mid_late",
};
