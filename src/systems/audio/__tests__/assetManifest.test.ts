import { describe, expect, it } from "vitest";
import { getBgmAsset, getSfxAsset } from "../assetManifest";

describe("audio asset manifest", () => {
  it.each([
    ["sfx.combat.meleeHit", "blade"],
    ["sfx.combat.projectileHit", "impact"],
    ["sfx.combat.unitHit", "grunt"],
    ["sfx.combat.unitDeath", "grunt"],
  ] as const)("assigns %s to the %s synthesis family", (id, kind) => {
    const asset = getSfxAsset(id);
    expect(asset?.synth.kind).toBe(kind);
  });

  it("registers the supply heal chime as an explicitly synthetic placeholder", () => {
    const asset = getSfxAsset("sfx.support.heal");
    expect(asset).toBeDefined();
    if (!asset) return;

    expect(asset.category).toBe("combat");
    expect(asset.synth.kind).toBe("healChime");
    expect(asset.missingAsset).toBe(true);
    expect(asset.licenseNote).toContain("Web Audio");
  });

  it("registers local era BGM files as real loopable assets", () => {
    const asset = getBgmAsset("bgm.age.industrial");
    expect(asset).toBeDefined();
    if (!asset) return;

    expect(asset.filePath).toContain("05_early_modern_age_of_momentum_v6.ogg");
    expect(asset.loop).toBe(true);
    expect(asset.missingAsset).toBe(false);
  });
});
