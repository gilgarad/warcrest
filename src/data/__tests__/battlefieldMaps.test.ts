import { describe, expect, it } from "vitest";
import {
  CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC,
  getCapturePointSocketId,
  LANE_BATTLEFIELD_MAP_SPEC,
  LANE_PATH_NODES,
} from "../battlefieldMaps";

describe("battlefield map specs", () => {
  it("covers every lane path segment with deterministic logical terrain cells", () => {
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainPatches).toHaveLength(LANE_PATH_NODES.length - 1);

    LANE_BATTLEFIELD_MAP_SPEC.terrainPatches.forEach((patch) => {
      expect(patch.cells).toHaveLength(patch.columns * patch.rows);
      expect(new Set(patch.cells.map((cell) => cell.material))).toEqual(
        new Set(["grass", "dirt", "stone"]),
      );
      expect(patch.rows).toBe(8);
      expect(patch.columns).toBeGreaterThanOrEqual(8);
    });
  });

  it("keeps the central-only terrain patch available without restoring the removed fortress", () => {
    expect(CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC.terrainPatches).toHaveLength(1);
    expect(CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC.structureSockets).toHaveLength(0);
  });

  it("provides non-blocking sockets only at the two buildable capture nodes", () => {
    const pathNodeIndexes = [1, 3];
    expect(LANE_BATTLEFIELD_MAP_SPEC.structureSockets).toHaveLength(2);
    LANE_BATTLEFIELD_MAP_SPEC.structureSockets.forEach((socket, index) => {
      expect(socket.id).toBe(getCapturePointSocketId(index));
      expect(socket.position).toEqual(LANE_PATH_NODES[pathNodeIndexes[index]].position);
      expect(socket.footprint.blocksMovement).toBe(false);
      expect(socket.bypassSlots).toHaveLength(2);
    });
  });

  it("owns explicit depth-sorted props instead of baking them into the world surface", () => {
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainProps).toHaveLength(6);
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainProps.every((prop) => prop.occludesUnits)).toBe(true);
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainProps.every((prop) => !prop.footprint.blocksMovement)).toBe(true);
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainProps.every((prop) => prop.shadow.offsetY <= 3)).toBe(true);
  });
});
