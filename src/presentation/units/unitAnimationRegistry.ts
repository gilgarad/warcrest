import { assetUrl } from "../../config/assetUrl";
import type { LaneUnitId } from "../../systems/lane-units/unitStats";

export type UnitLocomotionPose = "idle" | "walk-a" | "walk-b";
export const UNIT_FACING_DIRECTIONS = [
  "n", "ne", "e", "se", "s", "sw", "w", "nw",
] as const;
export type UnitFacingDirection = typeof UNIT_FACING_DIRECTIONS[number];

export interface UnitDirectionalPoseSet {
  idle: string;
  walkA: string;
  walkB: string;
  attack: readonly string[];
}

export interface UnitAnimationDefinition {
  directions: Partial<Readonly<Record<UnitFacingDirection, UnitDirectionalPoseSet>>>;
  fallbackDirection: UnitFacingDirection;
  legacyHorizontalMirror: boolean;
  frameCanvasAspects: Readonly<Record<string, number>>;
  groundOriginX: number;
  groundOriginY: number;
  referenceVisibleHeightRatio: number;
  frameVisibleHeightRatios: Readonly<Record<string, number>>;
  scaleFactor: number;
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
  const westPoses: UnitDirectionalPoseSet = {
    idle,
    walkA,
    walkB,
    attack: [attack],
  };
  return {
    directions: { w: westPoses },
    fallbackDirection: "w",
    legacyHorizontalMirror: true,
    frameCanvasAspects: wideAllFrames
      ? frameAspects([], allFrames)
      : frameAspects([idle, walkA, walkB], [attack]),
    groundOriginX: PRODUCTION_GROUND_ORIGIN_X,
    groundOriginY: PRODUCTION_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: PRODUCTION_VISIBLE_HEIGHT_RATIO,
    frameVisibleHeightRatios: frameHeightRatios(allFrames),
    scaleFactor,
  };
}

function directionalProductionAnimation(
  prefix: string,
  scaleFactor: number,
  wideAllFrames = false,
): UnitAnimationDefinition {
  const poseSet = (direction: UnitFacingDirection): UnitDirectionalPoseSet => ({
    idle: `${prefix}-${direction}-idle`,
    walkA: `${prefix}-${direction}-walk-a`,
    walkB: `${prefix}-${direction}-walk-b`,
    attack: [`${prefix}-${direction}-attack`],
  });
  const directions = Object.fromEntries(
    UNIT_FACING_DIRECTIONS.map((direction) => [direction, poseSet(direction)]),
  ) as Readonly<Record<UnitFacingDirection, UnitDirectionalPoseSet>>;
  const allFrames = UNIT_FACING_DIRECTIONS.flatMap((direction) => {
    const poses = directions[direction];
    return [poses.idle, poses.walkA, poses.walkB, ...poses.attack];
  });
  const standardFrames = allFrames.filter((key) => !key.endsWith("-attack") || wideAllFrames);
  const wideFrames = wideAllFrames
    ? []
    : allFrames.filter((key) => key.endsWith("-attack"));
  return {
    directions,
    fallbackDirection: "w",
    legacyHorizontalMirror: false,
    frameCanvasAspects: wideAllFrames
      ? frameAspects([], allFrames)
      : frameAspects(standardFrames, wideFrames),
    groundOriginX: PRODUCTION_GROUND_ORIGIN_X,
    groundOriginY: PRODUCTION_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: PRODUCTION_VISIBLE_HEIGHT_RATIO,
    frameVisibleHeightRatios: frameHeightRatios(allFrames),
    scaleFactor,
  };
}

export const UNIT_ANIMATION_REGISTRY: Partial<Record<LaneUnitId, UnitAnimationDefinition>> = {
  stone_slinger: directionalProductionAnimation("stone-slinger", 0.96),
  stone_axeman: directionalProductionAnimation("stone-axeman", 1.04),
  supply_wagon: directionalProductionAnimation("supply-wagon", 1, true),
  bronze_swordsman: directionalProductionAnimation("bronze-swordsman", 1),
  bronze_spearman: directionalProductionAnimation("bronze-spearman", 1),
  archer: directionalProductionAnimation("archer", 0.96),
  iron_swordsman: directionalProductionAnimation("iron-swordsman", 1.04),
  iron_spearman: productionAnimation("iron-spearman", 1),
  musketeer: productionAnimation("musketeer", 0.98),
  knight: productionAnimation("knight", 1.16, true),
};

export const UNIT_ANIMATION_ASSETS = Object.values(UNIT_ANIMATION_REGISTRY)
  .flatMap((definition) => definition
    ? Object.values(definition.directions).flatMap((poses) => poses
      ? [poses.idle, poses.walkA, poses.walkB, ...poses.attack]
      : [])
    : [])
  .filter((key, index, all) => all.indexOf(key) === index)
  .flatMap((key) => [
    { key, path: assetUrl(`assets/production/units/${key}.png`) },
    { key: `${key}-enemy`, path: assetUrl(`assets/production/units/${key}-enemy.png`) },
  ]);

export function getUnitAnimationDefinition(unitId: LaneUnitId): UnitAnimationDefinition | undefined {
  return UNIT_ANIMATION_REGISTRY[unitId];
}

export function getAuthoredUnitDirections(unitId: LaneUnitId): readonly UnitFacingDirection[] {
  const directions = getUnitAnimationDefinition(unitId)?.directions;
  return directions
    ? UNIT_FACING_DIRECTIONS.filter((direction) => directions[direction] !== undefined)
    : [];
}

export function hasCompleteUnitDirectionalSet(unitId: LaneUnitId): boolean {
  return getAuthoredUnitDirections(unitId).length === UNIT_FACING_DIRECTIONS.length;
}

export function resolveUnitFacingDirection(
  motionX: number,
  motionY: number,
  fallback: UnitFacingDirection = "w",
): UnitFacingDirection {
  if (Math.abs(motionX) < 0.0001 && Math.abs(motionY) < 0.0001) return fallback;
  const sectors: readonly UnitFacingDirection[] = ["e", "se", "s", "sw", "w", "nw", "n", "ne"];
  const octant = Math.round(Math.atan2(motionY, motionX) / (Math.PI / 4));
  return sectors[(octant + sectors.length) % sectors.length];
}

export function getUnitDirectionalPoses(
  unitId: LaneUnitId,
  direction: UnitFacingDirection,
): UnitDirectionalPoseSet | undefined {
  const definition = getUnitAnimationDefinition(unitId);
  if (!definition) return undefined;
  return definition.directions[direction] ?? definition.directions[definition.fallbackDirection];
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
  const definition = getUnitAnimationDefinition(unitId);
  return Boolean(definition?.legacyHorizontalMirror && facingX > 0);
}

export function resolveUnitAnimationTexture(
  unitId: LaneUnitId,
  moving: boolean,
  walkPhase: number,
  attackProgress: number,
  direction: UnitFacingDirection = "w",
): string | undefined {
  const poses = getUnitDirectionalPoses(unitId, direction);
  if (!poses) return undefined;
  if (attackProgress > 0) {
    const frameIndex = Math.min(
      poses.attack.length - 1,
      Math.floor(Math.min(0.9999, attackProgress) * poses.attack.length),
    );
    return poses.attack[frameIndex];
  }
  if (!moving) return poses.idle;
  return walkPhase >= 0 ? poses.walkA : poses.walkB;
}
