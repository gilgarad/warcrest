export const LANE_ROW_MIN = -5;
export const LANE_ROW_MAX = 5;
export const LANE_SHIFT_STEP = 1;
export const COMBAT_ROW_REACH = 1;
export const COMBAT_ROW_STEP = 1;
export const COMBAT_PROGRESS_OFFSETS = [0.008, 0.012, 0.016] as const;
export const COMBAT_PROGRESS_CLEARANCE = 0.0085;
export const COMBAT_ROW_CLEARANCE = 0.42;

export function createLaneRowCandidates(
  center: number,
  reach: number,
  step: number,
  min = LANE_ROW_MIN,
  max = LANE_ROW_MAX,
): number[] {
  const rows = [Math.max(min, Math.min(max, center))];
  for (let distance = step; distance <= reach + 0.0001; distance += step) {
    rows.push(
      Math.max(min, Math.min(max, center - distance)),
      Math.max(min, Math.min(max, center + distance)),
    );
  }
  return rows.filter((row, index, all) => all.findIndex((other) => Math.abs(other - row) < 0.001) === index);
}
