import { describe, expect, it } from "vitest";
import {
  CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC,
  DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID,
  getCapturePointSocketId,
  getDefenseTowerSocketId,
  LANE_BATTLEFIELD_MAP_SPEC,
  LANE_PATH_NODES,
  MIN_STRUCTURE_SOCKET_PROGRESS_GAP,
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

  it("separates every structure socket while keeping towers beyond linked captures", () => {
    const pathNodeIndexes = [1, 3];
    expect(LANE_BATTLEFIELD_MAP_SPEC.structureSockets).toHaveLength(4);
    const captureSockets = LANE_BATTLEFIELD_MAP_SPEC.structureSockets.filter((socket) => socket.kind === "capture-point");
    const towerSockets = LANE_BATTLEFIELD_MAP_SPEC.structureSockets.filter((socket) => socket.kind === "defense-tower");
    captureSockets.forEach((socket, index) => {
      expect(socket.id).toBe(getCapturePointSocketId(index));
      expect(socket.position).toEqual(LANE_PATH_NODES[pathNodeIndexes[index]].position);
      expect(socket.footprint.blocksMovement).toBe(false);
      expect(socket.bypassSlots).toHaveLength(2);
    });
    towerSockets.forEach((socket, index) => {
      expect(socket.id).toBe(getDefenseTowerSocketId(index));
      expect(socket.progress).toBeCloseTo(DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID[index]);
    });
    expect(DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID[0]).toBeGreaterThan(captureSockets[0].progress);
    expect(DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID[1]).toBeLessThan(captureSockets[1].progress);
    const progresses = LANE_BATTLEFIELD_MAP_SPEC.structureSockets.map((socket) => socket.progress);
    progresses.forEach((progress, index) => {
      progresses.slice(index + 1).forEach((other) => {
        expect(Math.abs(progress - other)).toBeGreaterThanOrEqual(MIN_STRUCTURE_SOCKET_PROGRESS_GAP);
      });
    });
  });

  it("owns explicit depth-sorted props instead of baking them into the world surface", () => {
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainProps).toHaveLength(6);
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainProps.every((prop) => prop.occludesUnits)).toBe(true);
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainProps.every((prop) => !prop.footprint.blocksMovement)).toBe(true);
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainProps.every((prop) => prop.shadow.offsetY <= 3)).toBe(true);
    expect(LANE_BATTLEFIELD_MAP_SPEC.terrainProps.every((prop) => prop.groundOriginY === 0.875)).toBe(true);
    expect(new Set(LANE_BATTLEFIELD_MAP_SPEC.terrainProps.map((prop) => prop.textureKey))).toEqual(new Set([
      "field-oak",
      "field-pine",
      "rock-cluster",
      "fallen-log",
      "field-boulder",
    ]));
  });
});
