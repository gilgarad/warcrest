import { assetUrl } from "../../config/assetUrl";
import type { LaneUnitId } from "../../systems/lane-units/unitStats";

export const LEGACY_WALK_POSES = ["walk-a", "walk-b", "walk-c"] as const;
export const LEGACY_PING_PONG_WALK_POSES = [
  "walk-a",
  "walk-b",
  "walk-c",
  "walk-b",
] as const;
export const V2_WALK_POSES = [
  "walk-01",
  "walk-02",
  "walk-03",
  "walk-04",
  "walk-05",
  "walk-06",
  "walk-07",
  "walk-08",
  "walk-09",
  "walk-10",
] as const;
export const THREE_FRAME_PING_PONG_WALK_POSES = [
  "walk-01",
  "walk-02",
  "walk-03",
  "walk-02",
] as const;
export type LegacyWalkPose = typeof LEGACY_WALK_POSES[number];
export type V2WalkPose = typeof V2_WALK_POSES[number];
export type UnitWalkPose = LegacyWalkPose | V2WalkPose;
export type UnitLocomotionPose = "idle" | UnitWalkPose | "attack";
export const UNIT_FACING_DIRECTIONS = [
  "n", "ne", "e", "se", "s", "sw", "w", "nw",
] as const;
export type UnitFacingDirection = typeof UNIT_FACING_DIRECTIONS[number];
export const ACTIVE_UNIT_FACING_DIRECTIONS = ["e", "w"] as const;
export type ActiveUnitFacingDirection = typeof ACTIVE_UNIT_FACING_DIRECTIONS[number];

export interface UnitDirectionalPoseSet {
  idle: string;
  walk: readonly string[];
  attack: readonly string[];
}

export interface UnitAnimationDefinition {
  directions: Partial<Readonly<Record<UnitFacingDirection, UnitDirectionalPoseSet>>>;
  fallbackDirection: UnitFacingDirection;
  legacyHorizontalMirror: boolean;
  directionMode: "direct" | "legacy-mirrored";
  frameCanvasAspects: Readonly<Record<string, number>>;
  groundOriginX: number;
  groundOriginY: number;
  referenceVisibleHeightRatio: number;
  frameVisibleHeightRatios: Readonly<Record<string, number>>;
  frameOriginXs: Readonly<Record<string, number>>;
  scaleFactor: number;
}

type FramePoseKey = UnitLocomotionPose;

interface ProductionAnimationOptions {
  groundOriginY?: number;
  referenceVisibleHeightRatio?: number;
  fallbackDirection?: UnitFacingDirection;
  directionAliases?: Partial<Record<UnitFacingDirection, UnitFacingDirection>>;
  authoredDirections?: readonly UnitFacingDirection[];
  walkPoses?: readonly UnitWalkPose[];
  poseVisibleHeightRatios?: Partial<Record<FramePoseKey, number>>;
  extraPrefixPoseVisibleHeightRatios?: Readonly<Record<string, Partial<Record<FramePoseKey, number>>>>;
  exactFrameVisibleHeightRatios?: Readonly<Record<string, number>>;
  exactFrameCanvasAspects?: Readonly<Record<string, number>>;
  exactFrameOriginXs?: Readonly<Record<string, number>>;
}

function parsePoseFromTextureKey(key: string): FramePoseKey {
  const suffix = key.replace(/^.+-(n|ne|e|se|s|sw|w|nw)-/, "");
  if (suffix === "idle" || suffix === "attack") return suffix;
  if (suffix.startsWith("walk-")) return suffix as UnitWalkPose;
  return "idle";
}

function resolveAuthoredDirection(
  direction: UnitFacingDirection,
  mode: UnitAnimationDefinition["directionMode"],
): UnitFacingDirection {
  if (mode === "direct") return direction;
  switch (direction) {
    case "e":
    case "w":
      return "e";
    case "ne":
    case "nw":
      return "ne";
    case "se":
    case "sw":
      return "se";
    default:
      return direction;
  }
}

function shouldMirrorDirection(
  direction: UnitFacingDirection,
  mode: UnitAnimationDefinition["directionMode"],
): boolean {
  if (mode !== "legacy-mirrored") return false;
  return direction === "w" || direction === "nw" || direction === "sw";
}

const STANDARD_ASPECT = 1;
const WIDE_ASPECT = 512 / 384;
const PRODUCTION_GROUND_ORIGIN_X = 0.5;
const PRODUCTION_GROUND_ORIGIN_Y = 336 / 384;
const PRODUCTION_VISIBLE_HEIGHT_RATIO = 270 / 384;
const MODERN_FOOT_GROUND_ORIGIN_Y = 312 / 384;

const frameAspects = (
  standard: readonly string[],
  wide: readonly string[] = [],
): Readonly<Record<string, number>> => Object.fromEntries([
  ...standard.map((key) => [key, STANDARD_ASPECT]),
  ...wide.map((key) => [key, WIDE_ASPECT]),
]);

function directionalProductionAnimation(
  prefix: string,
  scaleFactor: number,
  wideAllFrames = false,
  directionMode: UnitAnimationDefinition["directionMode"] = "direct",
  options: ProductionAnimationOptions = {},
): UnitAnimationDefinition {
  const authoredDirections = options.authoredDirections ?? UNIT_FACING_DIRECTIONS;
  const walkPoses = options.walkPoses ?? LEGACY_PING_PONG_WALK_POSES;
  const poseSet = (direction: UnitFacingDirection): UnitDirectionalPoseSet => ({
    idle: `${prefix}-${direction}-idle`,
    walk: walkPoses.map((pose) => `${prefix}-${direction}-${pose}`),
    attack: [`${prefix}-${direction}-attack`],
  });
  const directions = Object.fromEntries(
    authoredDirections.map((direction) => [
      direction,
      poseSet(options.directionAliases?.[direction] ?? direction),
    ]),
  ) as Readonly<Partial<Record<UnitFacingDirection, UnitDirectionalPoseSet>>>;
  const allFrames = authoredDirections.flatMap((direction) => {
    const poses = directions[direction];
    return poses ? [poses.idle, ...poses.walk, ...poses.attack] : [];
  });
  const standardFrames = allFrames.filter((key) => !key.endsWith("-attack") || wideAllFrames);
  const wideFrames = wideAllFrames
    ? []
    : allFrames.filter((key) => key.endsWith("-attack"));
  const defaultHeightRatio = options.referenceVisibleHeightRatio ?? PRODUCTION_VISIBLE_HEIGHT_RATIO;
  const frameVisibleHeightRatios = Object.fromEntries(
    allFrames.map((key) => {
      const pose = parsePoseFromTextureKey(key);
      const poseRatio = options.poseVisibleHeightRatios?.[pose]
        ?? ((pose === "walk-c" || pose === "walk-10") ? options.poseVisibleHeightRatios?.["walk-a"] : undefined)
        ?? defaultHeightRatio;
      return [key, poseRatio];
    }),
  ) as Record<string, number>;
  Object.entries(options.extraPrefixPoseVisibleHeightRatios ?? {}).forEach(([extraPrefix, ratios]) => {
    authoredDirections.forEach((direction) => {
      frameVisibleHeightRatios[`${extraPrefix}-${direction}-idle`] = ratios.idle ?? defaultHeightRatio;
      frameVisibleHeightRatios[`${extraPrefix}-${direction}-walk-a`] = ratios["walk-a"] ?? defaultHeightRatio;
      frameVisibleHeightRatios[`${extraPrefix}-${direction}-walk-b`] = ratios["walk-b"] ?? defaultHeightRatio;
      frameVisibleHeightRatios[`${extraPrefix}-${direction}-walk-c`] = ratios["walk-c"] ?? ratios["walk-a"] ?? defaultHeightRatio;
      frameVisibleHeightRatios[`${extraPrefix}-${direction}-attack`] = ratios.attack ?? defaultHeightRatio;
    });
  });
  Object.entries(options.exactFrameVisibleHeightRatios ?? {}).forEach(([key, ratio]) => {
    frameVisibleHeightRatios[key] = ratio;
  });
  return {
    directions,
    fallbackDirection: options.fallbackDirection ?? authoredDirections[0] ?? "w",
    legacyHorizontalMirror: false,
    directionMode,
    frameCanvasAspects: {
      ...(wideAllFrames
      ? frameAspects([], allFrames)
      : frameAspects(standardFrames, wideFrames)),
      ...(options.exactFrameCanvasAspects ?? {}),
    },
    groundOriginX: PRODUCTION_GROUND_ORIGIN_X,
    groundOriginY: options.groundOriginY ?? PRODUCTION_GROUND_ORIGIN_Y,
    referenceVisibleHeightRatio: defaultHeightRatio,
    frameVisibleHeightRatios,
    frameOriginXs: options.exactFrameOriginXs ?? {},
    scaleFactor,
  };
}

function modernFootProductionAnimation(
  prefix: string,
  scaleFactor: number,
): UnitAnimationDefinition {
  return threeFrameBipedAnimation(prefix, scaleFactor, {
    groundOriginY: MODERN_FOOT_GROUND_ORIGIN_Y,
  });
}

function threeFrameBipedAnimation(
  prefix: string,
  scaleFactor: number,
  options: ProductionAnimationOptions = {},
): UnitAnimationDefinition {
  return directionalProductionAnimation(prefix, scaleFactor, false, "legacy-mirrored", {
    ...options,
    authoredDirections: ["e"],
    fallbackDirection: "e",
    walkPoses: THREE_FRAME_PING_PONG_WALK_POSES,
  });
}

function threeFrameCavalryAnimation(
  prefix: string,
  options: ProductionAnimationOptions = {},
): UnitAnimationDefinition {
  return directionalProductionAnimation(prefix, 1.14, true, "legacy-mirrored", {
    ...options,
    authoredDirections: ["e"],
    fallbackDirection: "e",
    walkPoses: THREE_FRAME_PING_PONG_WALK_POSES,
  });
}

export const UNIT_ANIMATION_REGISTRY: Partial<Record<LaneUnitId, UnitAnimationDefinition>> = {
  stone_slinger: threeFrameBipedAnimation("stone-slinger", 0.96),
  stone_axeman: threeFrameBipedAnimation("stone-axeman", 1.04),
  supply_wagon: directionalProductionAnimation("supply-wagon", 1, true, "direct", {
    extraPrefixPoseVisibleHeightRatios: {
      "supply-wagon-industrial": {
        idle: 270 / 384,
        "walk-a": 268.25 / 384,
        "walk-b": 269.25 / 384,
        attack: 257.25 / 384,
      },
      "supply-wagon-modern": {
        idle: 265.75 / 384,
        "walk-a": 266 / 384,
        "walk-b": 268.75 / 384,
        attack: 269.25 / 384,
      },
    },
  }),
  bronze_swordsman: directionalProductionAnimation("bronze-swordsman", 1, false, "legacy-mirrored", {
    authoredDirections: ["e"],
    fallbackDirection: "e",
    walkPoses: THREE_FRAME_PING_PONG_WALK_POSES,
    exactFrameVisibleHeightRatios: { "bronze-swordsman-e-attack": 312 / 384 },
  }),
  bronze_spearman: directionalProductionAnimation("bronze-spearman", 1, false, "legacy-mirrored", {
    authoredDirections: ["e"],
    fallbackDirection: "e",
    walkPoses: THREE_FRAME_PING_PONG_WALK_POSES,
    exactFrameVisibleHeightRatios: {
      "bronze-spearman-e-idle": 250 / 384,
      "bronze-spearman-e-walk-01": 256 / 384,
      "bronze-spearman-e-walk-02": 250 / 384,
      "bronze-spearman-e-walk-03": 256 / 384,
      "bronze-spearman-e-attack": 312 / 384,
    },
  }),
  archer: threeFrameBipedAnimation("archer", 0.96),
  iron_swordsman: directionalProductionAnimation("iron-swordsman", 1.04, false, "legacy-mirrored", {
    authoredDirections: ["e"],
    fallbackDirection: "e",
    walkPoses: THREE_FRAME_PING_PONG_WALK_POSES,
    exactFrameVisibleHeightRatios: { "iron-swordsman-e-attack": 312 / 384 },
  }),
  iron_spearman: directionalProductionAnimation("iron-spearman", 1, false, "legacy-mirrored", {
    authoredDirections: ["e"],
    fallbackDirection: "e",
    walkPoses: THREE_FRAME_PING_PONG_WALK_POSES,
    exactFrameVisibleHeightRatios: {
      "iron-spearman-e-idle": 231 / 384,
      "iron-spearman-e-walk-01": 232 / 384,
      "iron-spearman-e-walk-02": 231 / 384,
      "iron-spearman-e-walk-03": 226 / 384,
      "iron-spearman-e-attack": 191 / 384,
    },
  }),
  musketeer: threeFrameBipedAnimation("musketeer", 0.98),
  knight: threeFrameCavalryAnimation("knight"),
  pikeman: directionalProductionAnimation("pikeman", 1, false, "legacy-mirrored", {
    authoredDirections: ["e"],
    fallbackDirection: "e",
    walkPoses: THREE_FRAME_PING_PONG_WALK_POSES,
    exactFrameVisibleHeightRatios: {
      "pikeman-e-idle": 270 / 512,
      "pikeman-e-walk-01": 270 / 512,
      "pikeman-e-walk-02": 270 / 512,
      "pikeman-e-walk-03": 270 / 512,
    },
    exactFrameCanvasAspects: {
      "pikeman-e-idle": 384 / 512,
      "pikeman-e-walk-01": 384 / 512,
      "pikeman-e-walk-02": 384 / 512,
      "pikeman-e-walk-03": 384 / 512,
      "pikeman-e-attack": 1024 / 384,
    },
    exactFrameOriginXs: { "pikeman-e-attack": 253 / 1024 },
  }),
  heavy_cavalry: threeFrameCavalryAnimation("heavy-cavalry", {
    // The upright lance needs a taller locomotion canvas; these ratios keep the
    // horse and rider at the same 270 px reference height as the attack pose.
    exactFrameVisibleHeightRatios: {
      "heavy-cavalry-e-idle": 270 / 512,
      "heavy-cavalry-e-walk-01": 270 / 512,
      "heavy-cavalry-e-walk-02": 270 / 512,
      "heavy-cavalry-e-walk-03": 270 / 512,
      "heavy-cavalry-e-attack": 270 / 384,
    },
    exactFrameCanvasAspects: {
      "heavy-cavalry-e-idle": 512 / 512,
      "heavy-cavalry-e-walk-01": 512 / 512,
      "heavy-cavalry-e-walk-02": 512 / 512,
      "heavy-cavalry-e-walk-03": 512 / 512,
      "heavy-cavalry-e-attack": 768 / 384,
    },
  }),
  rifleman: directionalProductionAnimation("rifleman", 0.98, false, "legacy-mirrored", {
    authoredDirections: ["e"],
    fallbackDirection: "e",
    walkPoses: THREE_FRAME_PING_PONG_WALK_POSES,
    exactFrameVisibleHeightRatios: {
      "rifleman-e-walk-01": 312 / 384,
      "rifleman-e-walk-02": 312 / 384,
      "rifleman-e-walk-03": 312 / 384,
    },
  }),
  grenadier: threeFrameBipedAnimation("grenadier", 1.02),
  light_cavalry: threeFrameCavalryAnimation("light-cavalry"),
  cannon_i: directionalProductionAnimation("cannon-i", 1.02, true, "direct", {
    poseVisibleHeightRatios: {
      idle: 268.62 / 384,
      "walk-a": 254.5 / 384,
      "walk-b": 255.75 / 384,
      attack: 244.88 / 384,
    },
    exactFrameVisibleHeightRatios: {
      "cannon-i-e-walk-a": 242 / 384,
      "cannon-i-w-walk-a": 242 / 384,
      "cannon-i-e-walk-b": 246 / 384,
      "cannon-i-w-walk-b": 246 / 384,
      "cannon-i-e-attack": 197 / 384,
      "cannon-i-se-attack": 197 / 384,
      "cannon-i-w-attack": 197 / 384,
      "cannon-i-nw-attack": 197 / 384,
    },
  }),
  rifleman_late: directionalProductionAnimation("rifleman-late", 1, false, "legacy-mirrored", {
    authoredDirections: ["e"],
    fallbackDirection: "e",
    walkPoses: THREE_FRAME_PING_PONG_WALK_POSES,
    exactFrameVisibleHeightRatios: {
      "rifleman-late-e-walk-01": 260 / 384,
      "rifleman-late-e-walk-02": 265 / 384,
      "rifleman-late-e-walk-03": 260 / 384,
      "rifleman-late-e-attack": 251 / 384,
    },
  }),
  grenadier_late: threeFrameBipedAnimation("grenadier-late", 1.04),
  cavalry: threeFrameCavalryAnimation("cavalry"),
  cannon_ii: directionalProductionAnimation("cannon-ii", 1.02, true, "direct", {
    poseVisibleHeightRatios: {
      idle: 269.5 / 384,
      "walk-a": 253.88 / 384,
      "walk-b": 254.62 / 384,
      attack: 254.75 / 384,
    },
    exactFrameVisibleHeightRatios: {
      "cannon-ii-e-walk-a": 206 / 384,
      "cannon-ii-w-walk-a": 206 / 384,
      "cannon-ii-e-walk-b": 209 / 384,
      "cannon-ii-w-walk-b": 209 / 384,
      "cannon-ii-e-attack": 218 / 384,
      "cannon-ii-se-attack": 218 / 384,
      "cannon-ii-w-attack": 218 / 384,
      "cannon-ii-nw-attack": 218 / 384,
    },
  }),
  infantry: modernFootProductionAnimation("infantry", 0.98),
  machine_gunner: modernFootProductionAnimation("machine-gunner", 0.98),
  shock_trooper: modernFootProductionAnimation("shock-trooper", 1),
  artillery_i: directionalProductionAnimation("artillery-i", 1.04, true, "direct", {
    poseVisibleHeightRatios: {
      idle: 263.5 / 384,
      "walk-a": 259.75 / 384,
      "walk-b": 259.75 / 384,
      attack: 260.62 / 384,
    },
    exactFrameVisibleHeightRatios: {
      "artillery-i-e-walk-a": 230 / 384,
      "artillery-i-w-walk-a": 230 / 384,
      "artillery-i-e-walk-b": 230 / 384,
      "artillery-i-w-walk-b": 230 / 384,
      "artillery-i-se-attack": 233 / 384,
      "artillery-i-nw-attack": 233 / 384,
    },
  }),
  automatic_rifleman: modernFootProductionAnimation("automatic-rifleman", 0.98),
  support_gunner: threeFrameBipedAnimation("support-gunner", 0.98, {
    groundOriginY: MODERN_FOOT_GROUND_ORIGIN_Y,
    poseVisibleHeightRatios: {
      idle: 270 / 384,
      "walk-a": 270 / 384,
      "walk-b": 270 / 384,
      attack: 259 / 384,
    },
  }),
  mobile_infantry: modernFootProductionAnimation("mobile-infantry", 0.98),
  artillery_ii: directionalProductionAnimation("artillery-ii", 1.04, true, "direct", {
    poseVisibleHeightRatios: {
      idle: 265.38 / 384,
      "walk-a": 253.75 / 384,
      "walk-b": 254.88 / 384,
      attack: 257.75 / 384,
    },
    exactFrameVisibleHeightRatios: {
      "artillery-ii-e-idle": 233 / 384,
      "artillery-ii-w-idle": 233 / 384,
      "artillery-ii-e-walk-a": 222 / 384,
      "artillery-ii-w-walk-a": 222 / 384,
      "artillery-ii-e-walk-b": 225 / 384,
      "artillery-ii-w-walk-b": 225 / 384,
      "artillery-ii-e-attack": 224 / 384,
      "artillery-ii-w-attack": 224 / 384,
    },
  }),
  tank: directionalProductionAnimation("tank", 1.06, true, "direct", {
    exactFrameVisibleHeightRatios: {
      "tank-se-attack": 243 / 384,
      "tank-nw-attack": 243 / 384,
    },
  }),
  special_forces: modernFootProductionAnimation("special-forces", 0.98),
  heavy_gunner: modernFootProductionAnimation("heavy-gunner", 0.98),
  breakthrough_trooper: threeFrameBipedAnimation("breakthrough-trooper", 1, {
    groundOriginY: 288 / 384,
  }),
  mobile_artillery: directionalProductionAnimation("mobile-artillery", 1.14, true),
  modern_tank: directionalProductionAnimation("modern-tank", 1.06, true),
};

const EXTRA_UNIT_ANIMATION_PREFIXES = [
  "supply-wagon-ancient",
  "supply-wagon-iron",
  "supply-wagon-renaissance",
  "supply-wagon-industrial",
  "supply-wagon-modern",
] as const;

function listAnimationKeysForPrefix(prefix: string): string[] {
  return UNIT_FACING_DIRECTIONS.flatMap((direction) => [
    `${prefix}-${direction}-idle`,
    ...LEGACY_WALK_POSES.map((pose) => `${prefix}-${direction}-${pose}`),
    `${prefix}-${direction}-attack`,
  ]);
}

function hasEnemyVariantForTexture(key: string): boolean {
  return !key.endsWith("-walk-c");
}

export const UNIT_ANIMATION_ASSETS = Object.values(UNIT_ANIMATION_REGISTRY)
  .flatMap((definition) => definition
    ? Object.values(definition.directions).flatMap((poses) => poses
      ? [poses.idle, ...poses.walk, ...poses.attack]
      : [])
    : [])
  .concat(EXTRA_UNIT_ANIMATION_PREFIXES.flatMap((prefix) => listAnimationKeysForPrefix(prefix)))
  .filter((key, index, all) => all.indexOf(key) === index)
  .flatMap((key) => [
    { key, path: assetUrl(`assets/production/units/${key}.png?v=20260807-cavalry3frame-1`) },
    ...(hasEnemyVariantForTexture(key)
      ? [{
          key: `${key}-enemy`,
          path: assetUrl(`assets/production/units/${key}-enemy.png?v=20260807-cavalry3frame-1`),
        }]
      : []),
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
  _motionY: number,
  fallback: UnitFacingDirection = "w",
): ActiveUnitFacingDirection {
  if (Math.abs(motionX) >= 0.0001) return motionX > 0 ? "e" : "w";
  return resolveHorizontalPresentationDirection(fallback);
}

export function resolveHorizontalPresentationDirection(
  direction: UnitFacingDirection,
  verticalFallback: ActiveUnitFacingDirection = "w",
): ActiveUnitFacingDirection {
  if (direction === "e" || direction === "ne" || direction === "se") return "e";
  if (direction === "w" || direction === "nw" || direction === "sw") return "w";
  return verticalFallback;
}

export function getUnitDirectionalPoses(
  unitId: LaneUnitId,
  direction: UnitFacingDirection,
): UnitDirectionalPoseSet | undefined {
  const definition = getUnitAnimationDefinition(unitId);
  if (!definition) return undefined;
  const presentationDirection = resolveHorizontalPresentationDirection(direction);
  const eastPoses = definition.directions.e;
  if (eastPoses) return eastPoses;
  const authoredDirection = resolveAuthoredDirection(presentationDirection, definition.directionMode);
  return definition.directions[authoredDirection] ?? definition.directions[definition.fallbackDirection];
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
  const exact = definition.frameCanvasAspects[textureKey];
  if (exact !== undefined) return exact;
  if (unitId === "supply_wagon" && textureKey.startsWith("supply-wagon-")) return WIDE_ASPECT;
  return undefined;
}

export function getFrameOriginX(unitId: LaneUnitId, textureKey?: string): number | undefined {
  const definition = getUnitAnimationDefinition(unitId);
  if (!definition || !textureKey) return undefined;
  return definition.frameOriginXs[textureKey];
}

export function deriveAnimationPrefix(textureKey: string): string {
  return textureKey.replace(/-(n|ne|e|se|s|sw|w|nw)-(idle|walk-a|walk-b|walk-c|walk-\d\d|attack)$/, "");
}

function resolveWalkFrameIndex(walkCycleProgress: number, frameCount: number): number {
  const normalized = ((walkCycleProgress % 1) + 1) % 1;
  return Math.min(frameCount - 1, Math.floor(normalized * frameCount));
}

export function resolveAnimationTextureFromPrefix(
  unitId: LaneUnitId,
  prefix: string,
  moving: boolean,
  walkCycleProgress: number,
  attackProgress: number,
  direction: UnitFacingDirection = "w",
): string {
  const directional = getUnitDirectionalPoses(unitId, direction);
  if (directional) {
    if (attackProgress > 0) return directional.attack[0];
    if (!moving) return directional.idle;
    return directional.walk[resolveWalkFrameIndex(walkCycleProgress, directional.walk.length)];
  }
  const definition = getUnitAnimationDefinition(unitId);
  const authoredDirection = resolveAuthoredDirection(
    direction,
    definition?.directionMode ?? "direct",
  );
  if (attackProgress > 0) return `${prefix}-${authoredDirection}-attack`;
  if (!moving) return `${prefix}-${authoredDirection}-idle`;
  const walkSuffixes = LEGACY_WALK_POSES;
  return `${prefix}-${authoredDirection}-${walkSuffixes[resolveWalkFrameIndex(walkCycleProgress, walkSuffixes.length)]}`;
}

export function resolveTeamUnitTextureKey(textureKey: string, team: "player" | "enemy"): string {
  return team === "enemy" && hasEnemyVariantForTexture(textureKey) ? `${textureKey}-enemy` : textureKey;
}

export function shouldFlipUnitFrame(
  _unitId: LaneUnitId,
  facingX: number,
  direction?: UnitFacingDirection,
): boolean {
  if (direction) {
    return shouldMirrorDirection(
      resolveHorizontalPresentationDirection(direction),
      "legacy-mirrored",
    );
  }
  return facingX < 0;
}

export function resolveUnitAnimationTexture(
  unitId: LaneUnitId,
  moving: boolean,
  walkCycleProgress: number,
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
  return poses.walk[resolveWalkFrameIndex(walkCycleProgress, poses.walk.length)];
}
