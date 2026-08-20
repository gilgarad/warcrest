"""Renders each candidate direction as a piece of battlefield, not as tiles.

Loose tiles cannot be judged: what matters is how a road edge reads against
grass at the size the phone actually draws it, and whether two materials still
separate when the whole field is a few hundred pixels wide. So each sample is a
small scene at the real on-screen scale.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from terrain_tiles import TILE, Style, tile  # noqa: E402
from styles import ALL  # noqa: E402

COLS, ROWS = 14, 8


def field_mask(col: int, row: int) -> str:
    """A slice of the real layout: grass, a road band, a river below it."""
    if row in (2, 3):
        return "road"
    if row == 4 and col % 3 != 0:
        return "dirt"
    if row in (6, 7):
        return "water"
    return "grass"


def corners_for(col: int, row: int, material: str) -> int:
    """Mask from which of the cell's four corners sit inside the material."""
    mask = 0
    for bit, (dc, dr) in ((1, (0, 0)), (2, (1, 0)), (4, (1, 1)), (8, (0, 1))):
        c, r = col + dc - 1, row + dr - 1
        inside = field_mask(min(max(c, 0), COLS - 1), min(max(r, 0), ROWS - 1)) == material
        if inside:
            mask |= bit
    return mask


def render(style: Style, scale: int) -> Image.Image:
    size = TILE * scale // 4
    canvas = Image.new("RGBA", (COLS * size, ROWS * size), (0, 0, 0, 255))
    # Grass first as a full ground layer. Partial tiles only cover part of their
    # cell, so without something underneath the uncovered corners show through
    # as holes -- which is exactly what the first draft did.
    ground = tile(style, style.materials["grass"], 15, 1).resize((size, size), Image.LANCZOS)
    for row in range(ROWS):
        for col in range(COLS):
            canvas.alpha_composite(ground, (col * size, row * size))
    order = ["dirt", "road", "water"]
    cache: dict[tuple[str, int], Image.Image] = {}
    for material in order:
        for row in range(ROWS):
            for col in range(COLS):
                mask = corners_for(col, row, material)
                if mask == 0:
                    continue
                key = (material, mask)
                if key not in cache:
                    img = tile(style, style.materials[material], mask, hash(key) & 0xFFFF)
                    cache[key] = img.resize((size, size), Image.LANCZOS)
                canvas.alpha_composite(cache[key], (col * size, row * size))
    return canvas


def sheet(out: Path, scale: int, caption: str) -> None:
    samples = [(s, render(s, scale)) for s in ALL]
    w = samples[0][1].width
    header = 34
    gap = 18
    total_h = sum(img.height + header + gap for _, img in samples) + 40
    sheet = Image.new("RGB", (w + 40, total_h), (18, 20, 26))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/nanum/NanumGothic.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    draw.text((20, 8), caption, fill=(230, 226, 214), font=font)
    y = 32
    for style, img in samples:
        draw.text((20, y + 6), style.label, fill=(235, 214, 150), font=font)
        y += header
        sheet.paste(img, (20, y))
        y += img.height + gap
    sheet.save(out)


if __name__ == "__main__":
    Path("artifacts/terrain-drafts").mkdir(parents=True, exist_ok=True)
    sheet(Path("artifacts/terrain-drafts/at-phone-scale.png"), 2,
          "폰에서 실제로 그려지는 크기 (타일 ≈ 32px)")
    sheet(Path("artifacts/terrain-drafts/zoomed.png"), 5,
          "확대 — 질감과 경계 처리 확인용")
    print("두 장 생성")
