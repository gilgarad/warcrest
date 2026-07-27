export type TerrainMaterial = "grass" | "dirt" | "stone";

export interface WorldPointSpec {
  x: number;
  y: number;
}

export interface TerrainCellSpec {
  column: number;
  row: number;
  material: TerrainMaterial;
  variant: number;
}

export interface TerrainPatchSpec {
  id: string;
  center: WorldPointSpec;
  rotationRad: number;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  cells: TerrainCellSpec[];
}

export interface StructureFootprintSpec {
  shape: "ellipse";
  width: number;
  height: number;
  blocksMovement: boolean;
}

export interface StructureSocketSpec {
  id: string;
  kind: "capture-tower";
  position: WorldPointSpec;
  footprint: StructureFootprintSpec;
  bypassSlots: WorldPointSpec[];
}

/**
 * Runtime map contract. Storage adapters such as Tiled JSON should translate
 * into this shape instead of leaking their schema into gameplay or rendering.
 */
export interface BattlefieldMapSpec {
  schemaVersion: 1;
  id: string;
  terrainPatches: TerrainPatchSpec[];
  structureSockets: StructureSocketSpec[];
}

const CENTRAL_CAPTURE = { x: 4095, y: 1740 };
const CENTRAL_LANE_ROTATION = Math.atan2(1305 - 2280, 4960 - 3080);

function createCentralPrototypeCells(columns: number, rows: number): TerrainCellSpec[] {
  const centerRow = (rows - 1) / 2;
  const cells: TerrainCellSpec[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const laneDistance = Math.abs(row - centerRow);
      const material: TerrainMaterial = laneDistance <= 1
        ? "stone"
        : laneDistance <= 2
          ? "dirt"
          : "grass";

      cells.push({
        column,
        row,
        material,
        variant: (column * 17 + row * 31) % 8,
      });
    }
  }

  return cells;
}

const CENTRAL_PATCH_COLUMNS = 8;
const CENTRAL_PATCH_ROWS = 8;

export const LANE_BATTLEFIELD_MAP_SPEC: BattlefieldMapSpec = {
  schemaVersion: 1,
  id: "warcrest-lane-prototype-v1",
  terrainPatches: [
    {
      id: "central-capture-prototype",
      center: CENTRAL_CAPTURE,
      rotationRad: CENTRAL_LANE_ROTATION,
      columns: CENTRAL_PATCH_COLUMNS,
      rows: CENTRAL_PATCH_ROWS,
      cellWidth: 148,
      cellHeight: 108,
      cells: createCentralPrototypeCells(CENTRAL_PATCH_COLUMNS, CENTRAL_PATCH_ROWS),
    },
  ],
  structureSockets: [
    {
      id: "central-capture-tower",
      kind: "capture-tower",
      position: CENTRAL_CAPTURE,
      footprint: {
        shape: "ellipse",
        width: 166,
        height: 76,
        blocksMovement: false,
      },
      bypassSlots: [
        { x: 4035, y: 1632 },
        { x: 4155, y: 1848 },
      ],
    },
  ],
};
