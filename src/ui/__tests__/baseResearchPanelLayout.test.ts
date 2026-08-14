import { describe, expect, it } from "vitest";
import { BASE_RESEARCH_PANEL_LAYOUT, panelBoxEdges, type PanelBox } from "../BaseResearchPanel";

/**
 * The panel's buttons were positioned by eye and drifted: apply and revert hung
 * below the bottom edge and overlapped each other, and close sat above the
 * header bar rather than on it. None of that is visible from the code — only
 * from a screenshot — so the containment rules are asserted here instead.
 */
const layout = BASE_RESEARCH_PANEL_LAYOUT;
const frame = panelBoxEdges(layout.panel);

const contains = (child: PanelBox): boolean => {
  const edges = panelBoxEdges(child);
  return edges.left >= frame.left
    && edges.right <= frame.right
    && edges.top >= frame.top
    && edges.bottom <= frame.bottom;
};

const overlaps = (a: PanelBox, b: PanelBox): boolean => {
  const first = panelBoxEdges(a);
  const second = panelBoxEdges(b);
  return first.left < second.right
    && second.left < first.right
    && first.top < second.bottom
    && second.top < first.bottom;
};

describe("base research panel layout", () => {
  it("keeps every framed control inside the panel", () => {
    for (const [name, target] of Object.entries(layout)) {
      if (name === "panel") continue;
      expect(contains(target), `${name} escapes the panel frame`).toBe(true);
    }
  });

  it("does not overlap apply with revert", () => {
    expect(overlaps(layout.apply, layout.revert)).toBe(false);
  });

  it("centres close on the header bar", () => {
    expect(layout.close.centreY).toBe(layout.header.centreY);
  });

  it("puts apply and revert on one baseline", () => {
    expect(layout.apply.centreY).toBe(layout.revert.centreY);
  });

  it("aligns close and revert to the same right edge", () => {
    // Both are the right-most control in their row; a shared edge is what makes
    // the panel look deliberate rather than hand-placed.
    expect(panelBoxEdges(layout.close).right).toBe(panelBoxEdges(layout.revert).right);
  });

  it("leaves the right-hand controls clear of the frame", () => {
    expect(frame.right - panelBoxEdges(layout.revert).right).toBeGreaterThanOrEqual(12);
  });
});
