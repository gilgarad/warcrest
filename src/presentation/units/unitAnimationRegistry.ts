import type { LaneUnitId } from "../../systems/lane-units/unitStats";

export type UnitLocomotionPose = "idle" | "walk-a" | "walk-b";

export interface UnitAnimationDefinition {
  idle: string;
  walkA: string;
  walkB: string;
  attack: readonly string[];
  canvasAspect: number;
  groundOriginX: number;
  groundOriginY: number;
  referenceVisibleHeightRatio: number;
  frameVisibleHeightRatios: Readonly<Record<string, number>>;
  scaleFactor: number;
}

const NORMALIZED_CANVAS_ASPECT = 1152 / 1024;
const NORMALIZED_GROUND_ORIGIN_X = 450 / 1152;
const NORMALIZED_GROUND_ORIGIN_Y = 900 / 1024;

export const UNIT_ANIMATION_REGISTRY: Partial<Record<LaneUnitId, UnitAnimationDefinition>> = {
  stone_slinger: {
    idle: "stone-slinger-idle",
    walkA: "stone-slinger-walk-a",
    walkB: "stone-slinger-walk-b",
    attack: ["stone-slinger-attack"],
    canvasAspect: NORMALIZED_CANVAS_ASPECT,
    groundOriginX: NORMALIZED_GROUND_ORIGIN_X,
    groundOriginY: NORMALIZED_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: 620 / 1024,
    frameVisibleHeightRatios: {
      "stone-slinger-idle": 620 / 1024,
      "stone-slinger-walk-a": 587 / 1024,
      "stone-slinger-walk-b": 568 / 1024,
      "stone-slinger-attack": 571 / 1024,
    },
    scaleFactor: 0.96,
  },
  stone_axeman: {
    idle: "stone-axeman-idle",
    walkA: "stone-axeman-walk-a",
    walkB: "stone-axeman-walk-b",
    attack: ["stone-axeman-attack-windup", "stone-axeman-attack-contact", "stone-axeman-attack-recover"],
    canvasAspect: NORMALIZED_CANVAS_ASPECT,
    groundOriginX: NORMALIZED_GROUND_ORIGIN_X,
    groundOriginY: NORMALIZED_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: 600 / 1024,
    frameVisibleHeightRatios: {
      "stone-axeman-idle": 600 / 1024,
      "stone-axeman-walk-a": 593 / 1024,
      "stone-axeman-walk-b": 578 / 1024,
      "stone-axeman-attack-windup": 642 / 1024,
      "stone-axeman-attack-contact": 525 / 1024,
      "stone-axeman-attack-recover": 493 / 1024,
    },
    scaleFactor: 1.04,
  },
  supply_wagon: {
    idle: "stone-supply-idle",
    walkA: "stone-supply-walk-a",
    walkB: "stone-supply-walk-b",
    attack: ["stone-supply-attack"],
    canvasAspect: NORMALIZED_CANVAS_ASPECT,
    groundOriginX: NORMALIZED_GROUND_ORIGIN_X,
    groundOriginY: NORMALIZED_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: 601 / 1024,
    frameVisibleHeightRatios: {
      "stone-supply-idle": 601 / 1024,
      "stone-supply-walk-a": 577 / 1024,
      "stone-supply-walk-b": 554 / 1024,
      "stone-supply-attack": 513 / 1024,
    },
    scaleFactor: 1,
  },
  bronze_spearman: {
    idle: "bronze-spearman-idle",
    walkA: "bronze-spearman-walk-a",
    walkB: "bronze-spearman-walk-b",
    attack: ["bronze-spearman-attack-windup", "bronze-spearman-attack-contact"],
    canvasAspect: NORMALIZED_CANVAS_ASPECT,
    groundOriginX: NORMALIZED_GROUND_ORIGIN_X,
    groundOriginY: NORMALIZED_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: 524 / 1024,
    frameVisibleHeightRatios: {
      "bronze-spearman-idle": 524 / 1024,
      "bronze-spearman-walk-a": 509 / 1024,
      "bronze-spearman-walk-b": 445 / 1024,
      "bronze-spearman-attack-windup": 423 / 1024,
      "bronze-spearman-attack-contact": 625 / 1024,
    },
    scaleFactor: 1,
  },
};

export const UNIT_ANIMATION_ASSETS = Object.values(UNIT_ANIMATION_REGISTRY)
  .flatMap((definition) => definition
    ? [definition.idle, definition.walkA, definition.walkB, ...definition.attack]
    : [])
  .filter((key, index, all) => all.indexOf(key) === index)
  .map((key) => ({ key, path: `/assets/lane-poses/frames/${key}.png` }));

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
