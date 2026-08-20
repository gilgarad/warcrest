"""Renders each visual language as the same slice of battlefield."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from languages import ALL, TILE, Language, make_tile  # noqa: E402

COLS, ROWS = 16, 9
VARIANTS = 4


def material_at(col: int, row: int) -> str:
    """A curving road across grass, with a river below it."""
    bend = 1 if 4 <= col <= 11 else 0
    if row in (2 + bend, 3 + bend):
        return "road"
    if row == 4 + bend and col % 4 == 0:
        return "dirt"
    if row >= 7:
        return "water"
    return "grass"


def mask_at(col: int, row: int, material: str) -> int:
    mask = 0
    for bit, (dc, dr) in ((1, (0, 0)), (2, (1, 0)), (4, (1, 1)), (8, (0, 1))):
        c = min(max(col + dc - 1, 0), COLS - 1)
        r = min(max(row + dr - 1, 0), ROWS - 1)
        if material_at(c, r) == material:
            mask |= bit
    return mask


def render(language: Language, scale: int) -> Image.Image:
    size = max(8, TILE * scale // 4)
    canvas = Image.new("RGBA", (COLS * size, ROWS * size), (0, 0, 0, 255))
    cache: dict[tuple, Image.Image] = {}

    def get(material: str, mask: int, variant: int) -> Image.Image:
        key = (material, mask, variant)
        if key not in cache:
            img = make_tile(language, material, mask, hash((language.name, *key)) & 0xFFFF)
            cache[key] = img.resize((size, size), Image.NEAREST if language.surface == "pixel" else Image.LANCZOS)
        return cache[key]

    for row in range(ROWS):
        for col in range(COLS):
            canvas.alpha_composite(get("grass", 15, (col * 7 + row * 13) % VARIANTS), (col * size, row * size))
    for material in ("dirt", "road", "water"):
        for row in range(ROWS):
            for col in range(COLS):
                mask = mask_at(col, row, material)
                if mask == 0:
                    continue
                variant = (col * 7 + row * 13) % VARIANTS if mask == 15 else 0
                canvas.alpha_composite(get(material, mask, variant), (col * size, row * size))
    return canvas


def sheet(out: Path, scale: int, caption: str) -> None:
    rows = [(lang, render(lang, scale)) for lang in ALL]
    width = rows[0][1].width
    header, gap = 34, 20
    height = sum(img.height + header + gap for _, img in rows) + 44
    page = Image.new("RGB", (width + 40, height), (16, 18, 24))
    draw = ImageDraw.Draw(page)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/nanum/NanumGothic.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    draw.text((20, 10), caption, fill=(232, 228, 216), font=font)
    y = 36
    for lang, img in rows:
        draw.text((20, y + 6), lang.label, fill=(238, 216, 150), font=font)
        y += header
        page.paste(img, (20, y))
        y += img.height + gap
    page.save(out)


if __name__ == "__main__":
    out = Path("artifacts/language-drafts")
    out.mkdir(parents=True, exist_ok=True)
    sheet(out / "phone-scale.png", 2, "폰에서 실제로 그려지는 크기")
    sheet(out / "zoom.png", 5, "확대 — 그리는 방식의 차이")
    print("생성 완료")
