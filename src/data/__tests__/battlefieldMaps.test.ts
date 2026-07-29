import { describe, expect, it } from "vitest";
import {
  CAPTURE_POINT_PROGRESS,
  CENTRAL_TERRAIN_PROTOTYPE_MAP_SPEC,
  DAY3_THREE_FRONTS_LANE_PATH_NODES,
  DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC,
  DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC,
  DAY2_PLAYER_FRONT_LANE_PATH_NODES,
  DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID,
  ENEMY_SIDE_PROGRESS_MIN,
  getBattlefieldMapSpec,
  getCapturePointSocketId,
  getDefenseTowerSocketId,
  getLanePositionAtProgress,
  LANE_BATTLEFIELD_MAP_SPEC,
  LANE_PATH_NODES,
  MIN_STRUCTURE_SOCKET_PROGRESS_GAP,
  PLAYER_SIDE_PROGRESS_MAX,
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
    expect(LANE_BATTLEFIELD_MAP_SPEC.structureSockets).toHaveLength(4);
    const captureSockets = LANE_BATTLEFIELD_MAP_SPEC.structureSockets.filter((socket) => socket.kind === "capture-point");
    const towerSockets = LANE_BATTLEFIELD_MAP_SPEC.structureSockets.filter((socket) => socket.kind === "defense-tower");
    captureSockets.forEach((socket, index) => {
      expect(socket.id).toBe(getCapturePointSocketId(index));
      expect(socket.progress).toBeCloseTo(CAPTURE_POINT_PROGRESS[index]);
      expect(socket.position).toEqual(getLanePositionAtProgress(CAPTURE_POINT_PROGRESS[index]));
      expect(socket.footprint.blocksMovement).toBe(false);
      expect(socket.bypassSlots).toHaveLength(2);
    });
    towerSockets.forEach((socket, index) => {
      expect(socket.id).toBe(getDefenseTowerSocketId(index));
      expect(socket.progress).toBeCloseTo(DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID[index]);
    });
    expect(DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID[0]).toBeGreaterThan(captureSockets[0].progress);
    expect(DEFENSE_TOWER_PROGRESS_BY_CAPTURE_ID[1]).toBeLessThan(captureSockets[1].progress);
    expect(captureSockets[0].progress).toBeLessThan(PLAYER_SIDE_PROGRESS_MAX);
    expect(towerSockets[0].progress).toBeLessThan(PLAYER_SIDE_PROGRESS_MAX);
    expect(captureSockets[1].progress).toBeGreaterThan(ENEMY_SIDE_PROGRESS_MIN);
    expect(towerSockets[1].progress).toBeGreaterThan(ENEMY_SIDE_PROGRESS_MIN);
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

  it("exposes the Day 2 player-front candidate as a switchable map spec", () => {
    expect(getBattlefieldMapSpec(DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC.id)).toBe(DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC);
    expect(DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC.lanePath).toHaveLength(DAY2_PLAYER_FRONT_LANE_PATH_NODES.length);
    expect(DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC.terrainPatches).toHaveLength(DAY2_PLAYER_FRONT_LANE_PATH_NODES.length - 1);
    expect(DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC.terrainProps).toHaveLength(8);
    expect(DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC.structureSockets.map((socket) => socket.progress)).toEqual([0.17, 0.37, 0.64, 0.84]);
    DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC.structureSockets.forEach((socket, index, all) => {
      all.slice(index + 1).forEach((other) => {
        expect(Math.abs(socket.progress - other.progress)).toBeGreaterThanOrEqual(MIN_STRUCTURE_SOCKET_PROGRESS_GAP);
      });
    });
    const rows = DAY2_PLAYER_FRONT_MAP_CANDIDATE_SPEC.terrainPatches.map((patch) => patch.rows);
    expect(Math.max(...rows)).toBe(10);
    expect(Math.min(...rows)).toBe(6);
  });

  it("exposes the Day 3 full-map candidate with authored width changes and denser landmarks", () => {
    expect(getBattlefieldMapSpec(DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC.id)).toBe(DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC);
    expect(DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC.lanePath).toHaveLength(DAY3_THREE_FRONTS_LANE_PATH_NODES.length);
    expect(DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC.terrainPatches).toHaveLength(DAY3_THREE_FRONTS_LANE_PATH_NODES.length - 1);
    expect(DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC.structureSockets.map((socket) => socket.progress)).toEqual([0.17, 0.37, 0.64, 0.84]);
    DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC.structureSockets.forEach((socket, index, all) => {
      all.slice(index + 1).forEach((other) => {
        expect(Math.abs(socket.progress - other.progress)).toBeGreaterThanOrEqual(MIN_STRUCTURE_SOCKET_PROGRESS_GAP);
      });
    });
    const rows = DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC.terrainPatches.map((patch) => patch.rows);
    expect(Math.max(...rows)).toBe(10);
    expect(Math.min(...rows)).toBe(6);
    expect(DAY3_THREE_FRONTS_MAP_CANDIDATE_SPEC.terrainProps).toHaveLength(20);
  });
});
