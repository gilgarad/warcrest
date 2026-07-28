#!/usr/bin/env python3
"""Compose Day 6 role timing before/after captures into one review sheet."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "artifacts/day6-combat-polish"
OUTPUT = ARTIFACTS / "role-timing-before-vs-after.png"
ROLES = ("melee", "ranged", "support")
PHASES = ("windup", "event", "recover")


def crop_focus(image: Image.Image) -> Image.Image:
    width, height = image.size
    return image.crop((width * 0.34, height * 0.16, width * 0.68, height * 0.62))


def main() -> None:
    cell_width, cell_height = 250, 230
    margin, header = 24, 70
    canvas = Image.new("RGB", (margin * 2 + cell_width * 6, header + cell_height * 3), "#15191b")
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 18), "DAY 6 COMBAT TIMING - BEFORE / AFTER", fill="#f0d99b")
    for column, label in enumerate((
        "BEFORE WINDUP", "BEFORE EVENT", "BEFORE RECOVER",
        "AFTER WINDUP", "AFTER EVENT", "AFTER RECOVER",
    )):
        draw.text((margin + column * cell_width + 8, 44), label, fill="#d9e4e8")
    for row, role in enumerate(ROLES):
        for column, (stage, phase) in enumerate((
            ("before", PHASES[0]), ("before", PHASES[1]), ("before", PHASES[2]),
            ("after", PHASES[0]), ("after", PHASES[1]), ("after", PHASES[2]),
        )):
            source = Image.open(ARTIFACTS / f"{stage}-{role}-{phase}.png").convert("RGB")
            frame = crop_focus(source)
            frame.thumbnail((cell_width - 8, cell_height - 28), Image.Resampling.LANCZOS)
            x = margin + column * cell_width + 4
            y = header + row * cell_height + 24
            canvas.paste(frame, (x, y))
        draw.text((margin + 8, header + row * cell_height + 4), role.upper(), fill="#f0d99b")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT)


if __name__ == "__main__":
    main()
