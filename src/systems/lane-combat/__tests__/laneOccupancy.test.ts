import { describe, expect, it } from "vitest";
import {
  COMBAT_PROGRESS_OFFSETS,
  COMBAT_ROW_REACH,
  COMBAT_ROW_STEP,
  createLaneRowCandidates,
} from "../laneOccupancy";

describe("lane occupancy", () => {
  it("creates three legible rows and three staggered fronts per target", () => {
    const rows = createLaneRowCandidates(0, COMBAT_ROW_REACH, COMBAT_ROW_STEP);
    expect(rows).toEqual([0, -1, 1]);
    expect(rows.length * COMBAT_PROGRESS_OFFSETS.length).toBe(9);
  });

  it("keeps rows inside the playable lane", () => {
    expect(createLaneRowCandidates(4.8, 3, 0.75).every((row) => row >= -5 && row <= 5)).toBe(true);
  });
});
