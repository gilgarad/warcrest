#!/usr/bin/env python3
"""Compose normalized unit poses into a human-review contact sheet."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", default="tools/asset-qa/volume-unit-assets.json")
    parser.add_argument("--assets", default="public/assets/production/units")
    parser.add_argument("--output", default="artifacts/volume-production/units-contact-sheet.png")
    args = parser.parse_args()

    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    assets = Path(args.assets)
    cell_width, cell_height = 540, 430
    sheet = Image.new("RGB", (cell_width * 4, cell_height * 3), "#17202a")
    draw = ImageDraw.Draw(sheet)

    for index, asset in enumerate(spec["assets"]):
        row, column = divmod(index, 4)
        frame = Image.open(assets / asset["filename"]).convert("RGBA")
        x = column * cell_width + (cell_width - frame.width) // 2
        y = row * cell_height + 28
        sheet.paste(frame, (x, y), frame)
        draw.text((column * cell_width + 14, row * cell_height + 8), asset["key"], fill="#f4e7c3")
        ground_y = row * cell_height + 28 + asset["anchor"][1]
        draw.line((column * cell_width + 12, ground_y, (column + 1) * cell_width - 12, ground_y), fill="#526778", width=1)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
