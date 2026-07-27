import { describe, expect, it } from "vitest";
import { isTerrainDebugInputEnabled } from "../prototypeVisualConfig";

describe("terrain prototype input", () => {
  it("only enables keyboard cycling for an explicit QA flag", () => {
    expect(isTerrainDebugInputEnabled(null)).toBe(false);
    expect(isTerrainDebugInputEnabled("0")).toBe(false);
    expect(isTerrainDebugInputEnabled("true")).toBe(false);
    expect(isTerrainDebugInputEnabled("1")).toBe(true);
  });
});
