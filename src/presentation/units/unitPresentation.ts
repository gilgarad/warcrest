import { getUnitAnimationDefinition } from "./unitAnimationRegistry";
import type { LaneUnitId } from "../../systems/lane-units/unitStats";

export interface UnitFramePresentation {
  spriteWidth: number;
  spriteHeight: number;
  originX: number;
  originY: number;
  referenceVisibleHeight: number;
}

export function resolveUnitFramePresentation(
  unitId: LaneUnitId,
  targetVisibleWorldHeight: number,
  fallbackFrameAspect: number,
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
  const spriteHeight = targetVisibleWorldHeight / definition.referenceVisibleHeightRatio;
  return {
    spriteWidth: spriteHeight * definition.canvasAspect,
    spriteHeight,
    originX: definition.groundOriginX,
    originY: definition.groundOriginY,
    referenceVisibleHeight: targetVisibleWorldHeight,
  };
}

export function getUnitScaleFactor(unitId: LaneUnitId): number {
  return getUnitAnimationDefinition(unitId)?.scaleFactor ?? 1;
}
