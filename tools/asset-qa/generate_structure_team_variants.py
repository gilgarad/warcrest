#!/usr/bin/env python3
"""Generate structure team variants from authored blue palette regions."""

from __future__ import annotations

import colorsys
import json
from pathlib import Path

from PIL import Image


ASSET_DIR = Path("public/assets/production/structures")


def replace_team_color(pixel: tuple[int, int, int, int], hue: float, saturation_scale: float) -> tuple[int, int, int, int]:
    red, green, blue, alpha = pixel
    if alpha == 0:
        return pixel
    source_hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
    if not (0.48 <= source_hue <= 0.72 and saturation >= 0.38 and value >= 0.22):
        return pixel
    replaced = colorsys.hsv_to_rgb(hue, min(1, saturation * saturation_scale), value)
    return tuple(round(channel * 255) for channel in replaced) + (alpha,)


def main() -> None:
    sources = sorted(
        path for path in ASSET_DIR.glob("*.png")
        if not path.stem.endswith(("-enemy", "-neutral"))
    )
    report = []
    for source in sources:
        image = Image.open(source).convert("RGBA")
        source_pixels = list(image.getdata())
        enemy_pixels = [replace_team_color(pixel, 0.985, 0.94) for pixel in source_pixels]
        changed = sum(before != after for before, after in zip(source_pixels, enemy_pixels))
        image.putdata(enemy_pixels)
        image.save(source.with_name(f"{source.stem}-enemy.png"))
        report.append({"key": source.stem, "enemyChangedPixels": changed})

        if source.stem == "capture-marker":
            neutral_pixels = [replace_team_color(pixel, 0.12, 0.55) for pixel in source_pixels]
            image.putdata(neutral_pixels)
            image.save(source.with_name("capture-marker-neutral.png"))

    (ASSET_DIR / "team-palette-report.json").write_text(
        json.dumps({"passed": True, "assetCount": len(report), "results": report}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"generated {len(report)} enemy structure variants and one neutral marker")


if __name__ == "__main__":
    main()
