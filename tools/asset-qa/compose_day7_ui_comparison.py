from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path("artifacts/day7-ui-composition")


def compose(left_name: str, right_name: str, output_name: str, labels: tuple[str, str]) -> None:
    left = Image.open(ROOT / left_name).convert("RGB")
    right = Image.open(ROOT / right_name).convert("RGB")
    width = left.width + right.width
    canvas = Image.new("RGB", (width, max(left.height, right.height) + 44), "#07111a")
    canvas.paste(left, (0, 44))
    canvas.paste(right, (left.width, 44))
    draw = ImageDraw.Draw(canvas)
    draw.text((20, 14), labels[0], fill="#eaf3ff")
    draw.text((left.width + 20, 14), labels[1], fill="#eaf3ff")
    canvas.save(ROOT / output_name, optimize=True)


compose(
    "density-before-individual.png",
    "density-after-summary.png",
    "density-before-vs-after.png",
    ("Before: every unit overlay", "After: adaptive summaries"),
)
compose(
    "ui-on.png",
    "ui-off.png",
    "ui-on-vs-off.png",
    ("Compact HUD on", "HUD off, same camera"),
)
