import type { LaneUnitId } from "../../systems/lane-units/unitStats";

export type UnitLocomotionPose = "idle" | "walk-a" | "walk-b";

export interface UnitAnimationDefinition {
  idle: string;
  walkA: string;
  walkB: string;
  attack: readonly string[];
  frameCanvasAspects: Readonly<Record<string, number>>;
  groundOriginX: number;
  groundOriginY: number;
  referenceVisibleHeightRatio: number;
  frameVisibleHeightRatios: Readonly<Record<string, number>>;
  scaleFactor: number;
  nativeFacingX: -1 | 1;
}

const STANDARD_ASPECT = 1;
const WIDE_ASPECT = 512 / 384;
const PRODUCTION_GROUND_ORIGIN_X = 0.5;
const PRODUCTION_GROUND_ORIGIN_Y = 336 / 384;
const PRODUCTION_VISIBLE_HEIGHT_RATIO = 270 / 384;

const frameAspects = (
  standard: readonly string[],
  wide: readonly string[] = [],
): Readonly<Record<string, number>> => Object.fromEntries([
  ...standard.map((key) => [key, STANDARD_ASPECT]),
  ...wide.map((key) => [key, WIDE_ASPECT]),
]);

const frameHeightRatios = (keys: readonly string[]): Readonly<Record<string, number>> =>
  Object.fromEntries(keys.map((key) => [key, PRODUCTION_VISIBLE_HEIGHT_RATIO]));

export const UNIT_ANIMATION_REGISTRY: Partial<Record<LaneUnitId, UnitAnimationDefinition>> = {
  stone_slinger: {
    idle: "stone-slinger-idle",
    walkA: "stone-slinger-walk-a",
    walkB: "stone-slinger-walk-b",
    attack: ["stone-slinger-attack"],
    frameCanvasAspects: frameAspects(
      ["stone-slinger-idle", "stone-slinger-walk-a", "stone-slinger-walk-b"],
      ["stone-slinger-attack"],
    ),
    groundOriginX: PRODUCTION_GROUND_ORIGIN_X,
    groundOriginY: PRODUCTION_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: PRODUCTION_VISIBLE_HEIGHT_RATIO,
    frameVisibleHeightRatios: frameHeightRatios([
      "stone-slinger-idle", "stone-slinger-walk-a", "stone-slinger-walk-b", "stone-slinger-attack",
    ]),
    scaleFactor: 0.96,
    nativeFacingX: -1,
  },
  stone_axeman: {
    idle: "stone-axeman-idle",
    walkA: "stone-axeman-walk-a",
    walkB: "stone-axeman-walk-b",
    attack: ["stone-axeman-attack"],
    frameCanvasAspects: frameAspects(
      ["stone-axeman-idle", "stone-axeman-walk-a", "stone-axeman-walk-b"],
      ["stone-axeman-attack"],
    ),
    groundOriginX: PRODUCTION_GROUND_ORIGIN_X,
    groundOriginY: PRODUCTION_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: PRODUCTION_VISIBLE_HEIGHT_RATIO,
    frameVisibleHeightRatios: frameHeightRatios([
      "stone-axeman-idle", "stone-axeman-walk-a", "stone-axeman-walk-b", "stone-axeman-attack",
    ]),
    scaleFactor: 1.04,
    nativeFacingX: -1,
  },
  supply_wagon: {
    idle: "supply-wagon-idle",
    walkA: "supply-wagon-walk-a",
    walkB: "supply-wagon-walk-b",
    attack: ["supply-wagon-attack"],
    frameCanvasAspects: frameAspects([], [
      "supply-wagon-idle", "supply-wagon-walk-a", "supply-wagon-walk-b", "supply-wagon-attack",
    ]),
    groundOriginX: PRODUCTION_GROUND_ORIGIN_X,
    groundOriginY: PRODUCTION_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: PRODUCTION_VISIBLE_HEIGHT_RATIO,
    frameVisibleHeightRatios: frameHeightRatios([
      "supply-wagon-idle", "supply-wagon-walk-a", "supply-wagon-walk-b", "supply-wagon-attack",
    ]),
    scaleFactor: 1,
    nativeFacingX: -1,
  },
  bronze_spearman: {
    idle: "bronze-spearman-idle",
    walkA: "bronze-spearman-walk-a",
    walkB: "bronze-spearman-walk-b",
    attack: ["bronze-spearman-attack"],
    frameCanvasAspects: frameAspects(
      ["bronze-spearman-idle", "bronze-spearman-walk-a", "bronze-spearman-walk-b"],
      ["bronze-spearman-attack"],
    ),
    groundOriginX: PRODUCTION_GROUND_ORIGIN_X,
    groundOriginY: PRODUCTION_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: PRODUCTION_VISIBLE_HEIGHT_RATIO,
    frameVisibleHeightRatios: frameHeightRatios([
      "bronze-spearman-idle", "bronze-spearman-walk-a", "bronze-spearman-walk-b", "bronze-spearman-attack",
    ]),
    scaleFactor: 1,
    nativeFacingX: -1,
  },
};

export const UNIT_ANIMATION_ASSETS = Object.values(UNIT_ANIMATION_REGISTRY)
  .flatMap((definition) => definition
    ? [definition.idle, definition.walkA, definition.walkB, ...definition.attack]
    : [])
  .filter((key, index, all) => all.indexOf(key) === index)
  .flatMap((key) => [
    { key, path: `/assets/production/units/${key}.png` },
    { key: `${key}-enemy`, path: `/assets/production/units/${key}-enemy.png` },
  ]);

export function getUnitAnimationDefinition(unitId: LaneUnitId): UnitAnimationDefinition | undefined {
  return UNIT_ANIMATION_REGISTRY[unitId];
}

export function getFrameVisibleHeightRatio(unitId: LaneUnitId, textureKey?: string): number | undefined {
  const definition = getUnitAnimationDefinition(unitId);
  if (!definition) return undefined;
  return textureKey
    ? definition.frameVisibleHeightRatios[textureKey] ?? definition.referenceVisibleHeightRatio
    : definition.referenceVisibleHeightRatio;
}

export function getFrameCanvasAspect(unitId: LaneUnitId, textureKey?: string): number | undefined {
  const definition = getUnitAnimationDefinition(unitId);
  if (!definition || !textureKey) return undefined;
  return definition.frameCanvasAspects[textureKey];
}

export function resolveTeamUnitTextureKey(textureKey: string, team: "player" | "enemy"): string {
  return team === "enemy" ? `${textureKey}-enemy` : textureKey;
}

export function shouldFlipUnitFrame(unitId: LaneUnitId, facingX: number): boolean {
  const nativeFacingX = getUnitAnimationDefinition(unitId)?.nativeFacingX ?? 1;
  return (facingX < 0 ? -1 : 1) !== nativeFacingX;
}

export function resolveUnitAnimationTexture(
  unitId: LaneUnitId,
  moving: boolean,
  walkPhase: number,
  attackProgress: number,
): string | undefined {
  const definition = getUnitAnimationDefinition(unitId);
  if (!definition) return undefined;
  if (attackProgress > 0) {
    const frameIndex = Math.min(
      definition.attack.length - 1,
      Math.floor(Math.min(0.9999, attackProgress) * definition.attack.length),
    );
    return definition.attack[frameIndex];
  }
  if (!moving) return definition.idle;
  return walkPhase >= 0 ? definition.walkA : definition.walkB;
}
