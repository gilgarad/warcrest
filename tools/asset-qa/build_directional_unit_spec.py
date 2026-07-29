#!/usr/bin/env python3
"""Emit a directional 8-facing x 4-pose asset QA spec from a compact config."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

DIRECTIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"]
POSES = [
    ("idle", [384, 384], [192, 336]),
    ("walk-a", [384, 384], [192, 336]),
    ("walk-b", [384, 384], [192, 336]),
    ("attack", [512, 384], [256, 336]),
]

UNIT_CONFIGS = {
    "stone-slinger": {
        "source": "art-source/second-cycle/day3/stone-slinger/stone-slinger-8dir-sheet-alpha.png",
    },
    "stone-axeman": {
        "source": "art-source/second-cycle/day3/stone-axeman/stone-axeman-8dir-sheet-alpha.png",
    },
    "supply-wagon": {
        "source": "art-source/second-cycle/day3/supply-wagon/supply-wagon-8dir-sheet-alpha.png",
        "allWide": True,
    },
    "bronze-swordsman": {
        "source": "art-source/second-cycle/day3/bronze-swordsman/bronze-swordsman-8dir-sheet-alpha.png",
    },
    "archer": {
        "source": "art-source/second-cycle/day3/archer/archer-8dir-sheet-alpha.png",
    },
    "iron-swordsman": {
        "source": "art-source/second-cycle/day3/iron-swordsman/iron-swordsman-8dir-sheet-alpha.png",
    },
    "iron-spearman": {
        "source": "art-source/second-cycle/day3/iron-spearman/iron-spearman-8dir-sheet-alpha.png",
    },
    "musketeer": {
        "source": "art-source/second-cycle/day3/musketeer/musketeer-8dir-sheet-alpha.png",
    },
    "knight": {
        "source": "art-source/second-cycle/day3/knight/knight-8dir-sheet-alpha.png",
        "allWide": True,
    },
}


def build_asset_spec(unit_key: str) -> dict[str, object]:
    config = UNIT_CONFIGS[unit_key]
    all_wide = bool(config.get("allWide"))
    assets: list[dict[str, object]] = []
    for row, direction in enumerate(DIRECTIONS):
        for column, (pose, default_canvas, default_anchor) in enumerate(POSES):
            canvas = [512, 384] if all_wide else default_canvas
            anchor = [256, 336] if all_wide else default_anchor
            assets.append({
                "key": f"{unit_key}-{direction}-{pose}",
                "filename": f"{unit_key}-{direction}-{pose}.png",
                "column": column,
                "row": row,
                "canvas": canvas,
                "anchor": anchor,
                "opaqueHeight": 270,
                "minOpaqueHeight": 230,
                "maxOpaqueHeight": 288,
            })
    return {
        "source": config["source"],
        "columns": len(POSES),
        "rows": len(DIRECTIONS),
        "assignByComponent": True,
        "assets": assets,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("unit", choices=sorted(UNIT_CONFIGS))
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    spec = build_asset_spec(args.unit)
    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(spec, indent=2), encoding="utf-8")
    print(output_path)


if __name__ == "__main__":
    main()
