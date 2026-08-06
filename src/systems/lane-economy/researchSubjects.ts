import type { LaneUnitId } from "../lane-units/unitStats";

export const TOWER_RESEARCH_SUBJECT_ID = "watchtower" as const;

export type ResearchSubjectId = LaneUnitId | typeof TOWER_RESEARCH_SUBJECT_ID;
