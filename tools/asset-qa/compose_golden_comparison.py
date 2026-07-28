#!/usr/bin/env python3
"""Compose the two 1600x900 validation captures without altering originals."""

from pathlib import Path

from PIL import Image, ImageDraw


artifact_dir = Path("artifacts/golden-reference")
old = Image.open(artifact_dir / "old-oblique-central.png").convert("RGB")
new = Image.open(artifact_dir / "new-topdown-golden.png").convert("RGB")
canvas = Image.new("RGB", (old.width + new.width, old.height + 52), "#0a0d0a")
canvas.paste(old, (0, 52))
canvas.paste(new, (old.width, 52))
draw = ImageDraw.Draw(canvas)
draw.text((24, 18), "CURRENT: OBLIQUE / MIXED CONTRACT", fill="#e7d8b6")
draw.text((old.width + 24, 18), "DAY 2: TOP-DOWN GOLDEN CONTRACT", fill="#e7d8b6")
canvas.save(artifact_dir / "old-vs-new-side-by-side.png")
print(artifact_dir / "old-vs-new-side-by-side.png")
