import { describe, expect, it } from "vitest";
import {
  BASE_RESEARCH_PANEL_LAYOUT,
  MAX_RESEARCH_ROWS,
  PANEL_CONTROL_KEYS,
  RESEARCH_ROWS_AREA,
  panelBoxEdges,
  researchRowLayout,
  type PanelBox,
} from "../BaseResearchPanel";
import { AGES } from "../../data/ages";
import { getWaveRoster } from "../../data/unitRosters";

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

  /**
   * Every pair, not a chosen one. The first version of this checked only apply
   * against revert, and close went on to clip the age arrows — a pair nobody
   * had thought to name. Enumerating them removes the need to guess which
   * collisions are possible.
   */
  it("keeps every pair of controls clear of each other", () => {
    for (let i = 0; i < PANEL_CONTROL_KEYS.length; i += 1) {
      for (let j = i + 1; j < PANEL_CONTROL_KEYS.length; j += 1) {
        const [first, second] = [PANEL_CONTROL_KEYS[i], PANEL_CONTROL_KEYS[j]];
        expect(overlaps(layout[first], layout[second]), `${first} overlaps ${second}`).toBe(false);
      }
    }
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

describe("research row layout", () => {
  const rowCounts = Array.from({ length: MAX_RESEARCH_ROWS }, (_, index) => index + 1);

  it.each(rowCounts)("keeps %i rows inside the row area", (count) => {
    const { centres, height } = researchRowLayout(count);
    expect(centres).toHaveLength(count);
    for (const centre of centres) {
      expect(centre - height / 2).toBeGreaterThanOrEqual(RESEARCH_ROWS_AREA.top);
      expect(centre + height / 2).toBeLessThanOrEqual(RESEARCH_ROWS_AREA.bottom);
    }
  });

  it.each(rowCounts)("never lets %i rows touch the footer buttons", (count) => {
    const { centres, height } = researchRowLayout(count);
    const footerTop = panelBoxEdges(layout.apply).top;
    const lowest = Math.max(...centres) + height / 2;
    // The old fixed 84px pitch put the sixth row at y=945, past both the footer
    // and the bottom of the canvas.
    expect(lowest).toBeLessThan(footerTop);
  });

  it.each(rowCounts)("does not let %i rows overlap each other", (count) => {
    const { centres, height } = researchRowLayout(count);
    for (let index = 1; index < centres.length; index += 1) {
      expect(centres[index] - height / 2).toBeGreaterThanOrEqual(centres[index - 1] + height / 2);
    }
  });

  it("still uses the roomy spacing when there are few rows", () => {
    // The stone age case must not get worse for the sake of the crowded ones.
    expect(researchRowLayout(3).height).toBe(66);
  });

  it("fits the canvas without covering the resource readout", () => {
    // 1600x900 game canvas; the top HUD band occupies the first 250px and holds
    // the resource counters the player is spending from while this is open.
    expect(frame.top).toBeGreaterThanOrEqual(250);
    expect(frame.bottom).toBeLessThanOrEqual(900);
  });

  it("covers the largest roster any age actually produces", () => {
    const worst = Math.max(...AGES.map((age) => {
      const subjects = new Set(getWaveRoster(age.id).battleline.map((entry) => entry.unitId));
      return subjects.size + 1; // plus the defence tower
    }));
    // Guards the panel against a roster change quietly outgrowing it.
    expect(worst).toBeLessThanOrEqual(MAX_RESEARCH_ROWS);
  });
});
