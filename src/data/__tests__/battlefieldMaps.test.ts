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

  it("keeps the central-only map available for V1 comparison", () => {
    expect(CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC.terrainPatches).toHaveLength(1);
    expect(CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC.structureSockets).toHaveLength(1);
    expect(CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC.structureSockets[0].id).toBe(
      getCapturePointSocketId(1),
    );
  });

  it("provides non-blocking tower sockets and bypass slots at all three capture nodes", () => {
    expect(LANE_BATTLEFIELD_MAP_SPEC.structureSockets).toHaveLength(3);
    LANE_BATTLEFIELD_MAP_SPEC.structureSockets.forEach((socket, index) => {
      expect(socket.id).toBe(getCapturePointSocketId(index));
      expect(socket.position).toEqual(LANE_PATH_NODES[index + 1].position);
      expect(socket.footprint.blocksMovement).toBe(false);
      expect(socket.bypassSlots).toHaveLength(2);
    });
  });
});
