"""Action icons, drawn in the same pixel language as the terrain and frames.

The strategic actions were text buttons two rows deep, which is the most
expensive way to spend a phone's bottom band -- the whole HUD has room for about
three rows of touch-sized controls and these took two of them. Icons collapse
the same four actions into one row.

Drawn at 32x32 and shown at whatever size the row needs, nearest-neighbour, so
they stay crisp rather than turning to mush like a scaled glyph would.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 32

INK = "#0c1119"        # outline, the silhouette against the button
STEEL = "#c8d4e2"
STEEL_DARK = "#7d8 da3"[:7]
WOOD = "#8a5a30"
WOOD_DARK = "#5c3a1e"
GOLD = "#e8b64a"
GOLD_DARK = "#a97c22"
LEAF = "#7fc25a"
PAPER = "#e6dcc0"


def _rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def _canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def _outline(draw: ImageDraw.ImageDraw, box, fill: str) -> None:
    draw.rectangle(box, fill=_rgb(fill), outline=_rgb(INK))


def worker() -> Image.Image:
    """A pick over a shoulder: the shorthand for hiring labour."""
    image, draw = _canvas()
    draw.ellipse([12, 4, 20, 12], fill=_rgb("#e8c9a0"), outline=_rgb(INK))   # head
    _outline(draw, [10, 13, 22, 26], "#4a6f8f")                              # body
    draw.line([(6, 24), (24, 8)], fill=_rgb(WOOD), width=3)                  # handle
    draw.line([(6, 24), (24, 8)], fill=_rgb(WOOD_DARK), width=1)
    draw.polygon([(22, 4), (29, 9), (23, 12)], fill=_rgb(STEEL), outline=_rgb(INK))
    return image


def researcher() -> Image.Image:
    """An open book: the research worker, distinct from the labouring one."""
    image, draw = _canvas()
    draw.polygon([(3, 9), (15, 6), (15, 25), (3, 27)], fill=_rgb(PAPER), outline=_rgb(INK))
    draw.polygon([(17, 6), (29, 9), (29, 27), (17, 25)], fill=_rgb(PAPER), outline=_rgb(INK))
    draw.line([(16, 6), (16, 25)], fill=_rgb(INK), width=2)
    for y in (12, 16, 20):
        draw.line([(5, y), (13, y - 1)], fill=_rgb(STEEL_DARK))
        draw.line([(19, y - 1), (27, y)], fill=_rgb(STEEL_DARK))
    return image


def instant_wave() -> Image.Image:
    """Fast-forward chevrons: the wave sent now instead of when it was due.

    A war horn was the first attempt and it read as a ramp -- at thirty-two
    pixels a shape has to be a symbol, not a picture of an object.
    """
    image, draw = _canvas()
    for offset in (0, 11):
        draw.polygon([(6 + offset, 5), (17 + offset, 16), (6 + offset, 27)],
                     fill=_rgb(GOLD), outline=_rgb(INK))
        draw.line([(7 + offset, 8), (14 + offset, 15)], fill=_rgb("#fff0c0"))
    return image


def age_up() -> Image.Image:
    """An arrow climbing a flight of steps: one age onto the next.

    The earlier banner-with-chevrons read as a flagpole beside two fir trees.
    """
    image, draw = _canvas()
    for i, (x, y, w) in enumerate(((3, 26, 8), (11, 21, 8), (19, 16, 10))):
        _outline(draw, [x, y, x + w, 29], "#6f7c8c" if i < 2 else "#8b98a8")
    draw.polygon([(22, 12), (28, 4), (34 - 6, 12)], fill=_rgb(GOLD), outline=_rgb(INK))
    draw.rectangle([25, 11, 30, 17], fill=_rgb(GOLD), outline=_rgb(INK))
    return image


def workers_panel() -> Image.Image:
    """Three figures: the allocation panel, not a single hire."""
    image, draw = _canvas()
    for i, x in enumerate((4, 12, 20)):
        top = 8 + (i % 2) * 2
        draw.ellipse([x, top, x + 7, top + 7], fill=_rgb("#e8c9a0"), outline=_rgb(INK))
        _outline(draw, [x, top + 8, x + 7, top + 18], "#4a6f8f")
    return image


ICONS = {
    "hire-worker": worker,
    "hire-research-worker": researcher,
    "use-instant-wave": instant_wave,
    "age-up": age_up,
    "workers": workers_panel,
}


def write_all(out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, build in ICONS.items():
        build().save(out_dir / f"{name}.png")
    return len(ICONS)
