import { describe, expect, it } from "vitest";
import { getMarchingMask, getMarchingPolygons } from "../marchingSquares";

describe("marching squares", () => {
  it("maps four material corners to all 16 stable states", () => {
    const masks = Array.from({ length: 16 }, (_, value) => getMarchingMask({
      northWest: Boolean(value & 1),
      northEast: Boolean(value & 2),
      southEast: Boolean(value & 4),
      southWest: Boolean(value & 8),
    }));
    expect(masks).toEqual(Array.from({ length: 16 }, (_, value) => value));
  });

  it("keeps empty/full states deterministic and diagonal states disconnected", () => {
    expect(getMarchingPolygons(0, 64)).toEqual([]);
    expect(getMarchingPolygons(15, 64)).toHaveLength(1);
    expect(getMarchingPolygons(5, 64)).toHaveLength(2);
    expect(getMarchingPolygons(10, 64)).toHaveLength(2);
  });
});
