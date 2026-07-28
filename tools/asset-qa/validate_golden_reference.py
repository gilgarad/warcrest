#!/usr/bin/env python3
"""Validate canvas, alpha bounds, and shared ground-anchor constraints."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default="tools/asset-qa/golden-reference-assets.json")
    parser.add_argument("--assets", default="public/assets/golden-reference")
    args = parser.parse_args()

    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    asset_dir = Path(args.assets)
    results: list[dict[str, object]] = []
    failures: list[str] = []

    for asset in spec["assets"]:
        path = asset_dir / f"prototype-golden-{asset['key']}-v1.png"
        image = Image.open(path).convert("RGBA")
        bbox = image.getchannel("A").getbbox()
        expected_canvas = tuple(asset["canvas"])
        if bbox is None:
            failures.append(f"{asset['key']}: empty alpha")
            continue
        opaque_height = bbox[3] - bbox[1]
        anchor_y = asset["anchor"][1]
        checks = {
            "canvas": image.size == expected_canvas,
            "opaqueHeight": asset["minOpaqueHeight"] <= opaque_height <= asset["maxOpaqueHeight"],
            "groundAnchor": abs(bbox[3] - anchor_y) <= 2,
            "edgeMargin": bbox[0] >= 12 and bbox[2] <= image.width - 12 and bbox[1] >= 12,
            "transparentCorners": all(image.getpixel(point)[3] == 0 for point in [(0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1)]),
        }
        for name, passed in checks.items():
            if not passed:
                failures.append(f"{asset['key']}: {name} failed")
        results.append({
            "key": asset["key"],
            "canvas": list(image.size),
            "alphaBbox": list(bbox),
            "opaqueHeight": opaque_height,
            "anchorDelta": bbox[3] - anchor_y,
            "checks": checks,
        })

    report_path = asset_dir / "prototype-golden-qa-report-v1.json"
    report_path.write_text(json.dumps({"passed": not failures, "results": results, "failures": failures}, indent=2), encoding="utf-8")
    print(json.dumps({"passed": not failures, "assetCount": len(results), "failures": failures}, indent=2))
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
