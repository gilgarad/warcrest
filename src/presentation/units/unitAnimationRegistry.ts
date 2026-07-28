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

function productionAnimation(
  prefix: string,
  scaleFactor: number,
  wideAllFrames = false,
): UnitAnimationDefinition {
  const idle = `${prefix}-idle`;
  const walkA = `${prefix}-walk-a`;
  const walkB = `${prefix}-walk-b`;
  const attack = `${prefix}-attack`;
  const allFrames = [idle, walkA, walkB, attack];
  return {
    idle,
    walkA,
    walkB,
    attack: [attack],
    frameCanvasAspects: wideAllFrames
      ? frameAspects([], allFrames)
      : frameAspects([idle, walkA, walkB], [attack]),
    groundOriginX: PRODUCTION_GROUND_ORIGIN_X,
    groundOriginY: PRODUCTION_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: PRODUCTION_VISIBLE_HEIGHT_RATIO,
    frameVisibleHeightRatios: frameHeightRatios(allFrames),
    scaleFactor,
    nativeFacingX: -1,
  };
}

export const UNIT_ANIMATION_REGISTRY: Partial<Record<LaneUnitId, UnitAnimationDefinition>> = {
  stone_slinger: productionAnimation("stone-slinger", 0.96),
  stone_axeman: productionAnimation("stone-axeman", 1.04),
  supply_wagon: productionAnimation("supply-wagon", 1, true),
  bronze_swordsman: productionAnimation("bronze-swordsman", 1),
  bronze_spearman: productionAnimation("bronze-spearman", 1),
  archer: productionAnimation("archer", 0.96),
  iron_swordsman: productionAnimation("iron-swordsman", 1.04),
  iron_spearman: productionAnimation("iron-spearman", 1),
  musketeer: productionAnimation("musketeer", 0.98),
  knight: productionAnimation("knight", 1.16, true),
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
