import { expect, test } from "@playwright/test";

const SANDBOX_URL = "/warcrest/?sandbox=1";
const BIPEDS = [
  "stone_slinger", "stone_axeman", "bronze_swordsman", "bronze_spearman", "archer",
  "iron_swordsman", "iron_spearman", "musketeer", "pikeman", "grenadier",
  "rifleman_late", "grenadier_late", "infantry", "machine_gunner", "shock_trooper",
  "automatic_rifleman", "support_gunner", "mobile_infantry", "special_forces",
  "heavy_gunner", "breakthrough_trooper",
] as const;

type SandboxControl = {
  setUnit: (unitId: typeof BIPEDS[number]) => void;
  setTeam: (team: "player" | "enemy") => void;
  setDirection: (direction: "e" | "w") => void;
  setMode: (mode: "walk") => void;
  setAutoplay: (autoplay: boolean) => void;
  setManualPhase: (phase: number) => void;
  snapshot: () => { textureKeyResolved: string; flipX: boolean };
};

test("all biped infantry use the east-authored 3-frame cycle and west mirroring", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(SANDBOX_URL);
  await page.waitForFunction(() => Boolean(
    (window as unknown as { __unitSandboxControl?: unknown }).__unitSandboxControl,
  ));

  const results = await page.evaluate((unitIds) => {
    const control = (window as unknown as { __unitSandboxControl: SandboxControl }).__unitSandboxControl;
    return unitIds.flatMap((unitId) => (["player", "enemy"] as const).flatMap((team) => (
      ["e", "w"] as const
    ).map((direction) => {
      const snapshots = [0.05, 0.30, 0.55, 0.80].map((phase) => {
        control.setUnit(unitId);
        control.setTeam(team);
        control.setDirection(direction);
        control.setMode("walk");
        control.setAutoplay(false);
        control.setManualPhase(phase);
        return control.snapshot();
      });
      return { unitId, team, direction, snapshots };
    })));
  }, BIPEDS);

  for (const { unitId, team, direction, snapshots } of results) {
        const suffix = team === "enemy" ? "-enemy" : "";
        expect(snapshots.map((entry) => entry.textureKeyResolved)).toEqual([
          `${unitId.replace(/_/g, "-")}-e-walk-01${suffix}`,
          `${unitId.replace(/_/g, "-")}-e-walk-02${suffix}`,
          `${unitId.replace(/_/g, "-")}-e-walk-03${suffix}`,
          `${unitId.replace(/_/g, "-")}-e-walk-02${suffix}`,
        ]);
        expect(snapshots.every((entry) => entry.flipX === (direction === "w"))).toBe(true);
  }
});
