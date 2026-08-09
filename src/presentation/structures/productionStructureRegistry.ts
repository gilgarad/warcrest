import { assetUrl } from "../../config/assetUrl";
import type { AgeId } from "../../data/ages";

export type StructureTeam = "player" | "enemy" | "neutral";
export type DefenseTowerVisualState = "full" | "damaged" | "critical" | "ruins" | "construction";
export type DefenseTowerFamily = "palisade" | "stone" | "bastion" | "missile";

const ASSET_ROOT = assetUrl("assets/production/structures");
const TOWER_FAMILIES: readonly DefenseTowerFamily[] = ["palisade", "stone", "bastion", "missile"];
const TOWER_STATES: readonly DefenseTowerVisualState[] = ["full", "damaged", "critical", "ruins", "construction"];
const NON_TOWER_KEYS = [
  "main-base",
  "capture-marker",
] as const;

export const PRODUCTION_STRUCTURE_ASSETS = [
  ...TOWER_FAMILIES.flatMap((family) => TOWER_STATES.flatMap((state) => {
    const key = `defense-tower-${family}-${state}`;
    return [
      { key, path: `${ASSET_ROOT}/${key}.png` },
      { key: `${key}-enemy`, path: `${ASSET_ROOT}/${key}-enemy.png` },
    ];
  })),
  ...NON_TOWER_KEYS.flatMap((key) => [
  { key, path: `${ASSET_ROOT}/${key}.png` },
  { key: `${key}-enemy`, path: `${ASSET_ROOT}/${key}-enemy.png` },
  ...(key === "capture-marker"
    ? [{ key: `${key}-neutral`, path: `${ASSET_ROOT}/${key}-neutral.png` }]
    : []),
  ]),
];

export const STRUCTURE_GROUND_ORIGIN = { x: 0.5, y: 448 / 512 } as const;

const TOWER_VISIBLE_HEIGHT_RATIOS: Record<DefenseTowerFamily, Record<DefenseTowerVisualState, number>> = {
  palisade: {
    full: 320 / 512,
    damaged: 320 / 512,
    critical: 320 / 512,
    ruins: 220 / 512,
    construction: 320 / 512,
  },
  stone: {
    full: 360 / 512,
    damaged: 360 / 512,
    critical: 360 / 512,
    ruins: 260 / 512,
    construction: 360 / 512,
  },
  bastion: {
    full: 250 / 512,
    damaged: 250 / 512,
    critical: 250 / 512,
    ruins: 190 / 512,
    construction: 250 / 512,
  },
  missile: {
    full: 270 / 512,
    damaged: 270 / 512,
    critical: 270 / 512,
    ruins: 210 / 512,
    construction: 270 / 512,
  },
};

export function getDefenseTowerFamily(ageId: AgeId): DefenseTowerFamily {
  if (ageId === "stone" || ageId === "bronze") return "palisade";
  if (ageId === "iron_early" || ageId === "iron_mid" || ageId === "iron_late" || ageId === "renaissance") return "stone";
  if (ageId === "industrial_early" || ageId === "industrial_late") return "bastion";
  return "missile";
}

export function getDefenseTowerTexture(
  ageId: AgeId,
  state: DefenseTowerVisualState,
  team: Exclude<StructureTeam, "neutral">,
): string {
  const family = getDefenseTowerFamily(ageId);
  const base = `defense-tower-${family}-${state}`;
  return team === "enemy" ? `${base}-enemy` : base;
}

export function getDefenseTowerVisibleHeightRatio(ageId: AgeId, state: DefenseTowerVisualState): number {
  return TOWER_VISIBLE_HEIGHT_RATIOS[getDefenseTowerFamily(ageId)][state];
}

export function getMainBaseTexture(team: Exclude<StructureTeam, "neutral">): string {
  return team === "enemy" ? "main-base-enemy" : "main-base";
}

export function getCaptureMarkerTexture(team: StructureTeam): string {
  return team === "player"
    ? "capture-marker"
    : team === "enemy"
      ? "capture-marker-enemy"
      : "capture-marker-neutral";
}

export const MAIN_BASE_VISIBLE_HEIGHT_RATIO = 360 / 512;
export const CAPTURE_MARKER_VISIBLE_HEIGHT_RATIO = 380 / 512;
