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

sequence_names = ["0-idle", "1-walk-a", "2-walk-b", "3-attack", "4-idle"]
sequence_canvas = Image.new("RGB", (1400, 350), "#0a0d0a")
sequence_draw = ImageDraw.Draw(sequence_canvas)
for index, name in enumerate(sequence_names):
    frame = Image.open(artifact_dir / f"pose-transition-{name}.png").convert("RGB")
    crop = frame.crop((520, 140, 1080, 760)).resize((280, 310), Image.Resampling.LANCZOS)
    sequence_canvas.paste(crop, (index * 280, 40))
    sequence_draw.text((index * 280 + 12, 14), name.upper(), fill="#e7d8b6")
sequence_canvas.save(artifact_dir / "pose-transition-sequence.png")
print(artifact_dir / "pose-transition-sequence.png")
