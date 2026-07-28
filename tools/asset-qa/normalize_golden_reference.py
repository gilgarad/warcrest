#!/usr/bin/env python3
"""Split a prototype contact sheet and normalize assets to the style contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("asset has no opaque pixels")
    return bbox


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default="tools/asset-qa/golden-reference-assets.json")
    parser.add_argument("--output", default="public/assets/golden-reference")
    args = parser.parse_args()

    spec_path = Path(args.spec)
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    source = Image.open(spec["source"]).convert("RGBA")
    cell_width = source.width // spec["columns"]
    cell_height = source.height // spec["rows"]
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    report: list[dict[str, object]] = []
    for asset in spec["assets"]:
        left = asset["column"] * cell_width
        top = asset["row"] * cell_height
        cell = source.crop((left, top, left + cell_width, top + cell_height))
        content = cell.crop(alpha_bbox(cell))
        target_width, target_height = asset["canvas"]
        anchor_x, anchor_y = asset["anchor"]
        desired_height = asset["opaqueHeight"]
        scale = desired_height / content.height
        max_width = target_width - 24
        if content.width * scale > max_width:
            scale = max_width / content.width
        resized = content.resize(
            (max(1, round(content.width * scale)), max(1, round(content.height * scale))),
            Image.Resampling.LANCZOS,
        )
        canvas = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
        x = round(anchor_x - resized.width / 2)
        y = round(anchor_y - resized.height)
        canvas.alpha_composite(resized, (x, y))
        output_path = output_dir / f"prototype-golden-{asset['key']}-v1.png"
        canvas.save(output_path)
        bbox = alpha_bbox(canvas)
        report.append({
            "key": asset["key"],
            "output": str(output_path),
            "canvas": [target_width, target_height],
            "alphaBbox": list(bbox),
            "groundAnchor": [anchor_x, anchor_y],
        })

    report_path = output_dir / "prototype-golden-normalization-report-v1.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"normalized {len(report)} assets -> {output_dir}")


if __name__ == "__main__":
    main()
