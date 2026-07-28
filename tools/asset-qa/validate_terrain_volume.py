#!/usr/bin/env python3
"""Validate production terrain dimensions, alpha masks, and corner grammar."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image


CORNERS = ((1, (1, 1)), (2, (62, 1)), (4, (62, 62)), (8, (1, 62)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets", default="public/assets/production/terrain")
    args = parser.parse_args()
    assets = Path(args.assets)
    manifest = json.loads((assets / "terrain-volume-manifest.json").read_text(encoding="utf-8"))
    failures: list[str] = []
    results: list[dict[str, object]] = []

    for material in manifest["materials"]:
        base = Image.open(assets / f"{material}-base.png").convert("RGBA")
        if base.size != (64, 64) or base.getchannel("A").getextrema() != (255, 255):
            failures.append(f"{material}-base: dimensions or opacity")
        for mask in range(16):
            path = assets / f"{material}-transition-{mask:02d}.png"
            image = Image.open(path).convert("RGBA")
            alpha = image.getchannel("A")
            checks = {
                "canvas": image.size == (64, 64),
                "emptyMask0": mask != 0 or alpha.getbbox() is None,
                "nonEmpty": mask == 0 or alpha.getbbox() is not None,
                "cornerGrammar": all(
                    (alpha.getpixel(point) >= 240) == bool(mask & bit)
                    for bit, point in CORNERS
                ),
            }
            for name, passed in checks.items():
                if not passed:
                    failures.append(f"{material}-{mask:02d}: {name}")
            results.append({"material": material, "mask": mask, "checks": checks})

    report = {"passed": not failures, "assetCount": len(manifest["files"]), "results": results, "failures": failures}
    (assets / "terrain-volume-qa-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"passed": not failures, "assetCount": len(manifest["files"]), "failures": failures}, indent=2))
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
