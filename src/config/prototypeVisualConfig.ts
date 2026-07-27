export type TerrainRenderMode = "legacy" | "prototype" | "prototype-v2";
export type PrototypePresetId = "subtle" | "balanced" | "readability";
export type UnitVisualSizePreset = "S" | "M" | "L";
export type UnitLabelPolicy = "selected-or-hovered" | "priority" | "always";
export type ScalePresetId = "compact" | "recommended" | "large";

export interface PrototypeScaleConfig {
  id: ScalePresetId;
  normalUnitCssHeight: number;
  supportUnitCssHeight: number;
  largeUnitCssHeight: number;
  captureTowerCssHeight: number;
  fixedFortressCssHeight: number;
  foundationScaleMultiplier: number;
  unitLabelPolicy: UnitLabelPolicy;
  unitFontCssPx: number;
  selectedUnitFontCssPx: number;
  auxiliaryFontCssPx: number;
  towerFontCssPx: number;
  fixedFortressFontCssPx: number;
  unitHpWidthCssPx: number;
  unitHpHeightCssPx: number;
  towerHpWidthCssPx: number;
  towerHpHeightCssPx: number;
}

export interface PrototypeVisualConfig {
  id: PrototypePresetId;
  unitSizePreset: UnitVisualSizePreset;
  terrain: {
    patchLength: number;
    patchWidth: number;
    transitionWidth: number;
    transitionAlpha: number;
    breakupAlpha: number;
    breakupCount: number;
    foundationScale: number;
    foundationOffsetX: number;
    foundationOffsetY: number;
    foundationAlpha: number;
    contactAoAlpha: number;
    towerShadowOffsetX: number;
    towerShadowOffsetY: number;
    towerShadowScaleX: number;
    towerShadowScaleY: number;
    directionalShadowAlpha: number;
  };
  units: {
    baseWorldHeight: number;
    supportWorldHeight: number;
    roleScale: Record<"stone_slinger" | "stone_axeman" | "supply_wagon" | "other", number>;
    largeUnitScale: number;
    towerScale: number;
    minScreenHeight: number;
    maxScreenHeight: number;
    zoomCompensationStrength: number;
    groundOriginY: number;
  };
  worldUi: {
    unitLabelPolicy: UnitLabelPolicy;
    unitFontScreenPx: number;
    unitHpWidthScreenPx: number;
    unitHpHeightScreenPx: number;
    unitHpOffsetScreenPx: number;
    unitNameGapScreenPx: number;
    towerFontScreenPx: number;
    towerHpWidthScreenPx: number;
    towerHpHeightScreenPx: number;
    towerHpOffsetScreenPx: number;
    fontMinScreenPx: number;
    fontMaxScreenPx: number;
    outlinePx: number;
    shadowOffsetY: number;
    shadowBlur: number;
    labelBackgroundAlpha: number;
    minScale: number;
    maxScale: number;
  };
}

export const DEFAULT_PROTOTYPE_PRESET: PrototypePresetId = "balanced";
export const DEFAULT_SCALE_PRESET: ScalePresetId = "recommended";

export const PROTOTYPE_SCALE_PRESETS: Record<ScalePresetId, PrototypeScaleConfig> = {
  compact: {
    id: "compact",
    normalUnitCssHeight: 94,
    supportUnitCssHeight: 106,
    largeUnitCssHeight: 112,
    captureTowerCssHeight: 132,
    fixedFortressCssHeight: 148,
    foundationScaleMultiplier: 1.32,
    unitLabelPolicy: "selected-or-hovered",
    unitFontCssPx: 13,
    selectedUnitFontCssPx: 14,
    auxiliaryFontCssPx: 12,
    towerFontCssPx: 15,
    fixedFortressFontCssPx: 16,
    unitHpWidthCssPx: 46,
    unitHpHeightCssPx: 5,
    towerHpWidthCssPx: 96,
    towerHpHeightCssPx: 8,
  },
  recommended: {
    id: "recommended",
    normalUnitCssHeight: 100,
    supportUnitCssHeight: 116,
    largeUnitCssHeight: 122,
    captureTowerCssHeight: 144,
    fixedFortressCssHeight: 162,
    foundationScaleMultiplier: 1.48,
    unitLabelPolicy: "priority",
    unitFontCssPx: 14,
    selectedUnitFontCssPx: 15,
    auxiliaryFontCssPx: 13,
    towerFontCssPx: 16,
    fixedFortressFontCssPx: 17,
    unitHpWidthCssPx: 52,
    unitHpHeightCssPx: 6,
    towerHpWidthCssPx: 108,
    towerHpHeightCssPx: 9,
  },
  large: {
    id: "large",
    normalUnitCssHeight: 106,
    supportUnitCssHeight: 124,
    largeUnitCssHeight: 125,
    captureTowerCssHeight: 154,
    fixedFortressCssHeight: 174,
    foundationScaleMultiplier: 1.6,
    unitLabelPolicy: "priority",
    unitFontCssPx: 14,
    selectedUnitFontCssPx: 16,
    auxiliaryFontCssPx: 13,
    towerFontCssPx: 17,
    fixedFortressFontCssPx: 18,
    unitHpWidthCssPx: 58,
    unitHpHeightCssPx: 6,
    towerHpWidthCssPx: 118,
    towerHpHeightCssPx: 10,
  },
};

export const PROTOTYPE_VISUAL_PRESETS: Record<PrototypePresetId, PrototypeVisualConfig> = {
  subtle: {
    id: "subtle",
    unitSizePreset: "S",
    terrain: {
      patchLength: 760,
      patchWidth: 300,
      transitionWidth: 110,
      transitionAlpha: 0.11,
      breakupAlpha: 0.16,
      breakupCount: 8,
      foundationScale: 0.94,
      foundationOffsetX: 0,
      foundationOffsetY: 0,
      foundationAlpha: 0.82,
      contactAoAlpha: 0.3,
      towerShadowOffsetX: 21,
      towerShadowOffsetY: 13,
      towerShadowScaleX: 1.08972,
      towerShadowScaleY: 0.64,
      directionalShadowAlpha: 0.27,
    },
    units: {
      baseWorldHeight: 126,
      supportWorldHeight: 138,
      roleScale: {
        stone_slinger: 0.96,
        stone_axeman: 1.04,
        supply_wagon: 1.08,
        other: 1,
      },
      largeUnitScale: 1.08,
      towerScale: 1.05,
      minScreenHeight: 52,
      maxScreenHeight: 70,
      zoomCompensationStrength: 0.35,
      groundOriginY: 0.88,
    },
    worldUi: {
      unitLabelPolicy: "selected-or-hovered",
      unitFontScreenPx: 10,
      unitHpWidthScreenPx: 31,
      unitHpHeightScreenPx: 4,
      unitHpOffsetScreenPx: 5,
      unitNameGapScreenPx: 15,
      towerFontScreenPx: 11,
      towerHpWidthScreenPx: 68,
      towerHpHeightScreenPx: 7,
      towerHpOffsetScreenPx: 9,
      fontMinScreenPx: 8,
      fontMaxScreenPx: 12,
      outlinePx: 3,
      shadowOffsetY: 2,
      shadowBlur: 3,
      labelBackgroundAlpha: 0.72,
      minScale: 0.78,
      maxScale: 2.4,
    },
  },
  balanced: {
    id: "balanced",
    unitSizePreset: "M",
    terrain: {
      patchLength: 760,
      patchWidth: 300,
      transitionWidth: 110,
      transitionAlpha: 0.16,
      breakupAlpha: 0.22,
      breakupCount: 13,
      foundationScale: 1,
      foundationOffsetX: 0,
      foundationOffsetY: 0,
      foundationAlpha: 0.9,
      contactAoAlpha: 0.38,
      towerShadowOffsetX: 21,
      towerShadowOffsetY: 13,
      towerShadowScaleX: 1.08434,
      towerShadowScaleY: 0.64,
      directionalShadowAlpha: 0.33,
    },
    units: {
      baseWorldHeight: 150,
      supportWorldHeight: 164,
      roleScale: {
        stone_slinger: 0.95,
        stone_axeman: 1.06,
        supply_wagon: 1.1,
        other: 1,
      },
      largeUnitScale: 1.1,
      towerScale: 1.14,
      minScreenHeight: 62,
      maxScreenHeight: 82,
      zoomCompensationStrength: 0.55,
      groundOriginY: 0.88,
    },
    worldUi: {
      unitLabelPolicy: "priority",
      unitFontScreenPx: 12,
      unitHpWidthScreenPx: 39,
      unitHpHeightScreenPx: 5,
      unitHpOffsetScreenPx: 6,
      unitNameGapScreenPx: 17,
      towerFontScreenPx: 13,
      towerHpWidthScreenPx: 82,
      towerHpHeightScreenPx: 9,
      towerHpOffsetScreenPx: 9,
      fontMinScreenPx: 10,
      fontMaxScreenPx: 15,
      outlinePx: 3,
      shadowOffsetY: 2,
      shadowBlur: 3,
      labelBackgroundAlpha: 0.72,
      minScale: 0.82,
      maxScale: 2.8,
    },
  },
  readability: {
    id: "readability",
    unitSizePreset: "L",
    terrain: {
      patchLength: 760,
      patchWidth: 300,
      transitionWidth: 110,
      transitionAlpha: 0.22,
      breakupAlpha: 0.29,
      breakupCount: 18,
      foundationScale: 1.08,
      foundationOffsetX: 0,
      foundationOffsetY: 0,
      foundationAlpha: 0.96,
      contactAoAlpha: 0.44,
      towerShadowOffsetX: 21,
      towerShadowOffsetY: 13,
      towerShadowScaleX: 1.0781,
      towerShadowScaleY: 0.64,
      directionalShadowAlpha: 0.38,
    },
    units: {
      baseWorldHeight: 178,
      supportWorldHeight: 194,
      roleScale: {
        stone_slinger: 0.94,
        stone_axeman: 1.08,
        supply_wagon: 1.12,
        other: 1,
      },
      largeUnitScale: 1.12,
      towerScale: 1.22,
      minScreenHeight: 72,
      maxScreenHeight: 96,
      zoomCompensationStrength: 0.75,
      groundOriginY: 0.88,
    },
    worldUi: {
      unitLabelPolicy: "always",
      unitFontScreenPx: 14,
      unitHpWidthScreenPx: 48,
      unitHpHeightScreenPx: 6,
      unitHpOffsetScreenPx: 7,
      unitNameGapScreenPx: 19,
      towerFontScreenPx: 15,
      towerHpWidthScreenPx: 98,
      towerHpHeightScreenPx: 11,
      towerHpOffsetScreenPx: 9,
      fontMinScreenPx: 12,
      fontMaxScreenPx: 17,
      outlinePx: 3,
      shadowOffsetY: 2,
      shadowBlur: 3,
      labelBackgroundAlpha: 0.72,
      minScale: 0.88,
      maxScale: 3.2,
    },
  },
};

export function parseTerrainRenderMode(value: string | null): TerrainRenderMode {
  if (value === "legacy" || value === "prototype" || value === "prototype-v2") return value;
  return "prototype";
}

export function parsePrototypePreset(value: string | null): PrototypePresetId {
  if (value === "subtle" || value === "balanced" || value === "readability") return value;
  return DEFAULT_PROTOTYPE_PRESET;
}

export function parseScalePreset(value: string | null): ScalePresetId {
  if (value === "compact" || value === "recommended" || value === "large") return value;
  return DEFAULT_SCALE_PRESET;
}

export function getPrototypeVisualConfig(preset: PrototypePresetId): PrototypeVisualConfig {
  return PROTOTYPE_VISUAL_PRESETS[preset];
}

export function getPrototypeScaleConfig(preset: ScalePresetId): PrototypeScaleConfig {
  return PROTOTYPE_SCALE_PRESETS[preset];
}
