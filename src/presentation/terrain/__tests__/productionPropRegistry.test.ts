import { describe, expect, it } from "vitest";
import {
  PRODUCTION_PROP_ASSETS,
  PRODUCTION_PROP_GROUND_ORIGIN,
} from "../productionPropRegistry";

describe("production prop registry", () => {
  it("registers every approved prop with one shared ground anchor", () => {
    expect(PRODUCTION_PROP_ASSETS.map((asset) => asset.key)).toEqual([
      "field-oak",
      "field-pine",
      "rock-cluster",
      "fallen-log",
      "field-boulder",
    ]);
    expect(PRODUCTION_PROP_GROUND_ORIGIN).toEqual({ x: 0.5, y: 0.875 });
  });
});
