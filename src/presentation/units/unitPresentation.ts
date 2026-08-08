import {
  deriveAnimationPrefix,
  getFrameCanvasAspect,
  getFrameOriginX,
  getFrameVisibleHeightRatio,
  getUnitAnimationDefinition,
  resolveAnimationTextureFromPrefix,
  type UnitFacingDirection,
} from "./unitAnimationRegistry";
import type { LaneUnitId } from "../../systems/lane-units/unitStats";

export interface UnitFramePresentation {
  spriteWidth: number;
  spriteHeight: number;
  originX: number;
  originY: number;
  referenceVisibleHeight: number;
}

export interface ResolvedAnimatedUnitPresentation {
  textureKey: string;
  idleTextureKey: string;
  framePresentation: UnitFramePresentation;
  idleFramePresentation: UnitFramePresentation;
}

export function resolveUnitFramePresentation(
  unitId: LaneUnitId,
  targetVisibleWorldHeight: number,
  fallbackFrameAspect: number,
  textureKey?: string,
): UnitFramePresentation {
  const definition = getUnitAnimationDefinition(unitId);
  if (!definition) {
    return {
      spriteWidth: targetVisibleWorldHeight * fallbackFrameAspect,
      spriteHeight: targetVisibleWorldHeight,
      originX: 0.5,
      originY: 0.88,
      referenceVisibleHeight: targetVisibleWorldHeight,
    };
  }
  const frameVisibleHeightRatio = getFrameVisibleHeightRatio(unitId, textureKey)
    ?? definition.referenceVisibleHeightRatio;
  const spriteHeight = (targetVisibleWorldHeight * definition.scaleFactor) / frameVisibleHeightRatio;
  return {
    spriteWidth: spriteHeight * (getFrameCanvasAspect(unitId, textureKey) ?? fallbackFrameAspect),
    spriteHeight,
    originX: getFrameOriginX(unitId, textureKey) ?? definition.groundOriginX,
    originY: definition.groundOriginY,
    referenceVisibleHeight: targetVisibleWorldHeight,
  };
}

export function resolveAnimatedUnitPresentation(
  unitId: LaneUnitId,
  logicalTextureKey: string,
  moving: boolean,
  walkCycleProgress: number,
  attackProgress: number,
  direction: UnitFacingDirection,
  targetVisibleWorldHeight: number,
): ResolvedAnimatedUnitPresentation {
  const animationPrefix = deriveAnimationPrefix(logicalTextureKey);
  const textureKey = resolveAnimationTextureFromPrefix(
    unitId,
    animationPrefix,
    moving,
    walkCycleProgress,
    attackProgress,
    direction,
  ) ?? logicalTextureKey;
  const idleTextureKey = resolveAnimationTextureFromPrefix(
    unitId,
    animationPrefix,
    false,
    0,
    0,
    direction,
  ) ?? logicalTextureKey;
  return {
    textureKey,
    idleTextureKey,
    framePresentation: resolveUnitFramePresentation(unitId, targetVisibleWorldHeight, 1, textureKey),
    idleFramePresentation: resolveUnitFramePresentation(unitId, targetVisibleWorldHeight, 1, idleTextureKey),
  };
}

export function getUnitScaleFactor(unitId: LaneUnitId): number {
  return getUnitAnimationDefinition(unitId)?.scaleFactor ?? 1;
}
