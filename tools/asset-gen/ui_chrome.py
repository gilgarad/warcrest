"""Panel and button frames, drawn in the same language as the terrain.

The HUD is flat rectangles with a one-pixel stroke and a system font, which was
fine while the ground under it was flat too. Now that the field is pixel art the
HUD is the one thing on screen that looks like a debug overlay.

These are nine-slice sources: a small image whose corners stay put and whose
edges and middle stretch, so one frame serves a button and a panel alike. Drawn
at the scale they will be shown at -- no upscaling -- because a bevel that is
one pixel wide has to stay one pixel wide to read as a bevel.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw

#: 4x4 ordered dither, same pattern as the terrain, so the two share a texture.
BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


@dataclass(frozen=True)
class Frame:
    """A panel or button style as its handful of tones."""
    name: str
    fill_dark: str
    fill_light: str
    #: Outer keyline, the silhouette against the battlefield.
    outline: str
    #: Lit inner edge along the top and left; the light comes from up-left.
    bevel_light: str
    #: Shaded inner edge along the bottom and right.
    bevel_dark: str
    #: Trim inset one pixel from the outline, the brass on a war table.
    trim: str | None = None


def _rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def nine_slice(frame: Frame, size: int = 24, corner: int = 8) -> Image.Image:
    """One frame source. `corner` is the region that must not stretch."""
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = image.load()
    dark, light = _rgb(frame.fill_dark), _rgb(frame.fill_light)

    # Flat fill.
    #
    # A dithered fill was the first attempt and it was wrong for this job: a
    # nine-slice stretches its middle, so the four-pixel pattern came out as
    # enormous checks across the panel. Only a single colour survives being
    # stretched by an arbitrary amount, so the character has to live in the
    # border -- which is the part that does not stretch.
    for y in range(size):
        for x in range(size):
            pixels[x, y] = (*dark, 238)

    # A band of the lighter tone along the top edge only. It sits inside the
    # non-stretching corner region, so it reads as a lit lip rather than as a
    # gradient that will smear.
    for y in range(2, 5):
        for x in range(size):
            pixels[x, y] = (*light, 238)

    draw = ImageDraw.Draw(image)
    draw.rectangle([0, 0, size - 1, size - 1], outline=(*_rgb(frame.outline), 255))
    if frame.trim:
        draw.rectangle([1, 1, size - 2, size - 2], outline=(*_rgb(frame.trim), 255))

    inset = 2 if frame.trim else 1
    # Light along the top and left, shadow along the bottom and right. Two lines
    # are all it takes for a flat rectangle to read as a raised panel.
    draw.line([(inset, inset), (size - 1 - inset, inset)], fill=(*_rgb(frame.bevel_light), 210))
    draw.line([(inset, inset), (inset, size - 1 - inset)], fill=(*_rgb(frame.bevel_light), 210))
    draw.line([(inset, size - 1 - inset), (size - 1 - inset, size - 1 - inset)],
              fill=(*_rgb(frame.bevel_dark), 210))
    draw.line([(size - 1 - inset, inset), (size - 1 - inset, size - 1 - inset)],
              fill=(*_rgb(frame.bevel_dark), 210))
    # Corner studs, the detail that says "made" rather than "drawn". Kept well
    # inside the corner region so the nine-slice never stretches them.
    if frame.trim:
        stud = 3
        for cx, cy in ((stud, stud), (size - 1 - stud, stud),
                       (stud, size - 1 - stud), (size - 1 - stud, size - 1 - stud)):
            draw.rectangle([cx - 1, cy - 1, cx + 1, cy + 1], fill=(*_rgb(frame.trim), 255))
            draw.point((cx - 1, cy - 1), fill=(*_rgb(frame.bevel_light), 255))
            draw.point((cx + 1, cy + 1), fill=(*_rgb(frame.bevel_dark), 255))
    return image


PANEL = Frame(
    name="panel", fill_dark="#16202e", fill_light="#1e2c3e", outline="#0a1017",
    bevel_light="#3c5470", bevel_dark="#0d1420", trim="#8a6f3a",
)
BUTTON = Frame(
    name="button", fill_dark="#24384f", fill_light="#2f4763", outline="#0c1420",
    bevel_light="#5b7ea3", bevel_dark="#111b28", trim="#b08b45",
)
BUTTON_HOVER = Frame(
    name="button-hover", fill_dark="#2f4a68", fill_light="#3d5c7f", outline="#0c1420",
    bevel_light="#7ba4cc", bevel_dark="#16233a", trim="#d8ac57",
)
BUTTON_DISABLED = Frame(
    name="button-disabled", fill_dark="#1c2029", fill_light="#242832", outline="#0a0d12",
    bevel_light="#3a404c", bevel_dark="#0e1116", trim="#4a4436",
)
BUTTON_DANGER = Frame(
    name="button-danger", fill_dark="#3c2029", fill_light="#4e2a35", outline="#160a0e",
    bevel_light="#8a4a58", bevel_dark="#210f15", trim="#b0703f",
)

ALL = [PANEL, BUTTON, BUTTON_HOVER, BUTTON_DISABLED, BUTTON_DANGER]


def write_all(out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    for frame in ALL:
        nine_slice(frame).save(out_dir / f"{frame.name}.png")
    return len(ALL)
