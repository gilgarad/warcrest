import { assetUrl } from "../../config/assetUrl";

export type StructureTeam = "player" | "enemy" | "neutral";
export type DefenseTowerVisualState = "full" | "damaged" | "critical" | "ruins" | "construction";

const ASSET_ROOT = assetUrl("assets/production/structures");
const BASE_KEYS = [
  "defense-tower-full",
  "defense-tower-damaged",
  "defense-tower-critical",
  "defense-tower-ruins",
  "defense-tower-construction",
  "main-base",
  "capture-marker",
] as const;

export const PRODUCTION_STRUCTURE_ASSETS = BASE_KEYS.flatMap((key) => [
  { key, path: `${ASSET_ROOT}/${key}.png` },
  { key: `${key}-enemy`, path: `${ASSET_ROOT}/${key}-enemy.png` },
  ...(key === "capture-marker"
    ? [{ key: `${key}-neutral`, path: `${ASSET_ROOT}/${key}-neutral.png` }]
    : []),
]);

export const STRUCTURE_GROUND_ORIGIN = { x: 0.5, y: 448 / 512 } as const;

const TOWER_VISIBLE_HEIGHT_RATIOS: Record<DefenseTowerVisualState, number> = {
  full: 360 / 512,
  damaged: 360 / 512,
  critical: 350 / 512,
  ruins: 280 / 512,
  construction: 340 / 512,
};

export function getDefenseTowerTexture(
  state: DefenseTowerVisualState,
  team: Exclude<StructureTeam, "neutral">,
): string {
  const base = `defense-tower-${state}`;
  return team === "enemy" ? `${base}-enemy` : base;
}

export function getDefenseTowerVisibleHeightRatio(state: DefenseTowerVisualState): number {
  return TOWER_VISIBLE_HEIGHT_RATIOS[state];
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
