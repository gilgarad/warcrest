import { describe, expect, it } from "vitest";
import { resolveUnitOverlayDensity, type UnitOverlaySubject } from "../unitOverlayDensity";

function unit(id: number, x: number, team: "player" | "enemy" = "player"): UnitOverlaySubject {
  return { id, team, screenX: x, screenY: 100, hp: 80, maxHp: 100, priority: false };
}

describe("unit overlay density", () => {
  it("keeps sparse units compact and independent", () => {
    const result = resolveUnitOverlayDensity([unit(1, 0), unit(2, 200)]);
    expect(result.get(1)).toEqual({ mode: "compact", groupSize: 1, hpRatio: 0.8 });
    expect(result.get(2)).toEqual({ mode: "compact", groupSize: 1, hpRatio: 0.8 });
  });

  it("summarizes a dense same-team cluster without discarding aggregate HP", () => {
    const result = resolveUnitOverlayDensity([unit(1, 0), unit(2, 30), unit(3, 60)]);
    expect([...result.values()].filter((entry) => entry.mode === "summary")).toHaveLength(1);
    expect([...result.values()].filter((entry) => entry.mode === "hidden")).toHaveLength(2);
    expect(result.get(1)).toMatchObject({ groupSize: 3, hpRatio: 0.8 });
  });

  it("keeps selected or hovered units detailed inside a dense cluster", () => {
    const selected = { ...unit(2, 30), priority: true, hp: 50 };
    const result = resolveUnitOverlayDensity([unit(1, 0), selected, unit(3, 60)]);
    expect(result.get(2)?.mode).toBe("detail");
    expect([...result.values()].filter((entry) => entry.mode === "summary")).toHaveLength(1);
    expect(result.get(1)?.hpRatio).toBeCloseTo(0.7);
  });

  it("never merges opposing teams", () => {
    const result = resolveUnitOverlayDensity([
      unit(1, 0),
      unit(2, 20),
      unit(3, 40),
      unit(4, 10, "enemy"),
      unit(5, 30, "enemy"),
      unit(6, 50, "enemy"),
    ]);
    expect([...result.values()].filter((entry) => entry.mode === "summary")).toHaveLength(2);
  });
});
