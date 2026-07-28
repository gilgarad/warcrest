#!/usr/bin/env python3
"""Compose the approved golden reference beside the integrated game capture."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
GOLDEN = ROOT / "artifacts/golden-reference/new-topdown-golden.png"
ACTUAL = ROOT / "artifacts/day5-integration-audit/after-combat-08.png"
OUTPUT = ROOT / "artifacts/day5-integration-audit/golden-vs-integrated.png"


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    return copy


def main() -> None:
    golden = fit(Image.open(GOLDEN).convert("RGB"), (760, 760))
    actual = fit(Image.open(ACTUAL).convert("RGB"), (760, 760))
    canvas = Image.new("RGB", (1600, 860), "#15181b")
    draw = ImageDraw.Draw(canvas)
    draw.text((40, 24), "APPROVED GOLDEN REFERENCE", fill="#f0d99b")
    draw.text((820, 24), "DAY 5 INTEGRATED GAME", fill="#f0d99b")
    canvas.paste(golden, (40, 70))
    canvas.paste(actual, (820, 70))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT)


if __name__ == "__main__":
    main()
