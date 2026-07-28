import type { TerrainPropTextureKey } from "../../data/battlefieldMaps";

const ASSET_ROOT = "/assets/production/props";

const PRODUCTION_PROP_KEYS: readonly TerrainPropTextureKey[] = [
  "field-oak",
  "field-pine",
  "rock-cluster",
  "fallen-log",
  "field-boulder",
];

export const PRODUCTION_PROP_ASSETS: ReadonlyArray<{
  key: TerrainPropTextureKey;
  path: string;
}> = PRODUCTION_PROP_KEYS.map((key) => ({ key, path: `${ASSET_ROOT}/${key}.png` }));

export const PRODUCTION_PROP_GROUND_ORIGIN = {
  x: 128 / 256,
  y: 224 / 256,
} as const;
