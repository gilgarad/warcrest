#!/usr/bin/env python3
"""Generate enemy unit frames by swapping only authored blue team pixels."""

from __future__ import annotations

import colorsys
import json
from pathlib import Path

from PIL import Image


ASSET_DIR = Path("public/assets/production/units")


def swap_team_pixel(pixel: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    red, green, blue, alpha = pixel
    if alpha == 0:
        return pixel
    hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
    if not (0.48 <= hue <= 0.72 and saturation >= 0.38 and value >= 0.22):
        return pixel
    swapped = colorsys.hsv_to_rgb(0.985, min(1, saturation * 0.94), value)
    return tuple(round(channel * 255) for channel in swapped) + (alpha,)


def main() -> None:
    sources = sorted(path for path in ASSET_DIR.glob("*.png") if not path.stem.endswith("-enemy"))
    report = []
    zero_match_sources: list[str] = []
    for source in sources:
        image = Image.open(source).convert("RGBA")
        source_pixels = list(image.getdata())
        swapped_pixels = [swap_team_pixel(pixel) for pixel in source_pixels]
        changed_pixels = sum(before != after for before, after in zip(source_pixels, swapped_pixels))
        if changed_pixels == 0:
            # Some frames (e.g. a weapon-heavy attack pose) legitimately have
            # no blue team-color pixel in view. Previously this raised and
            # aborted the whole batch, silently leaving every alphabetically
            # later file (most of the roster) with a stale/never-regenerated
            # `-enemy.png` — which is why enemy units drifted back to
            # player-blue after later art passes touched the base frames.
            # Warn and continue instead so one frame without a team marker
            # can't block the rest of the roster from getting a real update.
            zero_match_sources.append(str(source))
            print(f"WARNING: no authored team-color pixels found in {source} (enemy variant unchanged from base)")
        image.putdata(swapped_pixels)
        image.save(source.with_name(f"{source.stem}-enemy.png"))
        report.append({"key": source.stem, "changedPixels": changed_pixels})
    (ASSET_DIR / "team-palette-report.json").write_text(
        json.dumps(
            {
                "passed": len(zero_match_sources) == 0,
                "assetCount": len(report),
                "zeroMatchCount": len(zero_match_sources),
                "zeroMatchSources": zero_match_sources,
                "results": report,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"generated {len(sources)} enemy team variants ({len(zero_match_sources)} with no team-color pixels found)")


if __name__ == "__main__":
    main()
