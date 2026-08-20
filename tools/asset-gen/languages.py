"""Terrain drawn in genuinely different visual languages.

The first pass at new terrain was not new: it kept the four materials, the tile
size, and a palette sampled from what was already there, then cleaned the edges
and scattered some marks. That is a tidy-up. The reason it could not be more
than that is the drawing method -- continuous noise tinted toward a colour looks
like continuous noise tinted toward a different colour, whatever the palette.

Each language here draws by a different rule, so they differ in ways a palette
swap cannot reach:

- `pixel` works at a quarter of the tile's resolution on a five-step ramp with
  ordered dithering, then scales up with hard edges. Clusters, not grain.
- `flat` uses solid shapes with a heavy dark keyline and almost no interior
  texture, the way a board game or a modern mobile title reads.
- `painted` builds from directional strokes at high resolution, so the surface
  carries brush direction and the light comes from one side.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter

TILE = 64


@dataclass(frozen=True)
class Ramp:
    """A material as an ordered set of tones, darkest first."""
    tones: tuple[str, ...]

    def rgb(self, index: int) -> tuple[int, int, int]:
        value = self.tones[max(0, min(len(self.tones) - 1, index))].lstrip("#")
        return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


#: 4x4 ordered dither. Mixing two ramp steps through a fixed pattern is what
#: makes a surface read as pixel art rather than as noise -- the eye finds the
#: pattern and reads it as texture instead of as randomness.
BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


def dither(size: int, ramp: Ramp, level: Callable[[int, int], float]) -> Image.Image:
    """Renders a tone field through the ordered dither onto the ramp."""
    image = Image.new("RGB", (size, size))
    pixels = image.load()
    steps = len(ramp.tones) - 1
    for y in range(size):
        for x in range(size):
            value = max(0.0, min(1.0, level(x, y))) * steps
            base = int(value)
            fraction = value - base
            threshold = (BAYER[y % 4][x % 4] + 0.5) / 16
            pixels[x, y] = ramp.rgb(base + (1 if fraction > threshold else 0))
    return image


# --------------------------------------------------------------------------
# pixel: low resolution, hard edges, motifs made of clusters
# --------------------------------------------------------------------------

PIXEL_RES = 16  # logical pixels across a tile; upscaled 4x with no smoothing


def _pixel_surface(ramp: Ramp, kind: str, rng: random.Random) -> Image.Image:
    res = PIXEL_RES
    field = Image.new("RGB", (res, res))
    pen = field.load()
    steps = len(ramp.tones) - 1

    for y in range(res):
        for x in range(res):
            # A coarse two-tone base: blocks of colour, not per-pixel grain.
            block = ((x // 2) * 7 + (y // 2) * 13 + rng.randrange(3)) % 5
            pen[x, y] = ramp.rgb(1 + (1 if block < 2 else 0))

    draw = ImageDraw.Draw(field)
    if kind == "grass":
        # Blades as vertical two-pixel clusters, sparse enough to read as
        # individual growth at this resolution.
        for _ in range(res // 2):
            x, y = rng.randrange(res), rng.randrange(res)
            draw.point((x, y), fill=ramp.rgb(steps))
            draw.point((x, min(res - 1, y + 1)), fill=ramp.rgb(steps - 1))
    elif kind == "road":
        # Cobbles: small blocks with a lit top edge and a dark underside.
        for _ in range(res // 3):
            x, y = rng.randrange(res - 2), rng.randrange(res - 2)
            draw.rectangle([x, y, x + 1, y + 1], fill=ramp.rgb(steps - 1))
            draw.point((x, y), fill=ramp.rgb(steps))
            draw.point((x + 1, y + 1), fill=ramp.rgb(0))
    elif kind == "dirt":
        for _ in range(res // 3):
            x, y = rng.randrange(res), rng.randrange(res)
            draw.point((x, y), fill=ramp.rgb(0))
            if rng.random() < 0.5:
                draw.point((min(res - 1, x + 1), y), fill=ramp.rgb(steps - 1))
    elif kind == "stone":
        for _ in range(res // 4):
            x, y = rng.randrange(res - 3), rng.randrange(res - 3)
            draw.rectangle([x, y, x + 2, y + 1], outline=ramp.rgb(0))
            draw.point((x + 1, y), fill=ramp.rgb(steps))
    elif kind == "water":
        # Horizontal wave bands, the readable shorthand for water in pixel art.
        for y in range(0, res, 3):
            offset = rng.randrange(res)
            for x in range(res):
                if (x + offset) % 6 < 3:
                    draw.point((x, y), fill=ramp.rgb(steps))
                    draw.point((x, min(res - 1, y + 1)), fill=ramp.rgb(steps - 1))
    return field.resize((TILE, TILE), Image.NEAREST)


# --------------------------------------------------------------------------
# flat: solid shapes, heavy keyline, almost no interior texture
# --------------------------------------------------------------------------

def _flat_surface(ramp: Ramp, kind: str, rng: random.Random) -> Image.Image:
    field = Image.new("RGB", (TILE, TILE), ramp.rgb(2))
    draw = ImageDraw.Draw(field)
    steps = len(ramp.tones) - 1
    if kind == "grass":
        for _ in range(3):
            x, y = rng.randrange(TILE), rng.randrange(TILE)
            r = rng.randint(6, 12)
            draw.ellipse([x - r, y - r * 0.5, x + r, y + r * 0.5], fill=ramp.rgb(3))
    elif kind == "road":
        for _ in range(2):
            y = rng.randrange(TILE)
            draw.line([(0, y), (TILE, y + rng.randint(-3, 3))], fill=ramp.rgb(1), width=3)
    elif kind == "water":
        for y in range(6, TILE, 16):
            draw.line([(0, y), (TILE, y)], fill=ramp.rgb(steps), width=2)
    elif kind == "dirt":
        for _ in range(4):
            x, y = rng.randrange(TILE), rng.randrange(TILE)
            r = rng.randint(3, 6)
            draw.ellipse([x - r, y - r, x + r, y + r], fill=ramp.rgb(1))
    return field


# --------------------------------------------------------------------------
# painted: directional strokes, light from one side
# --------------------------------------------------------------------------

def _painted_surface(ramp: Ramp, kind: str, rng: random.Random) -> Image.Image:
    big = TILE * 3
    angle = {"grass": -1.1, "road": 0.05, "dirt": 0.4, "stone": 0.9, "water": 0.0}.get(kind, 0.0)
    field = Image.new("RGB", (big, big), ramp.rgb(2))
    draw = ImageDraw.Draw(field, "RGBA")
    steps = len(ramp.tones) - 1
    for _ in range(220):
        x, y = rng.randrange(big), rng.randrange(big)
        length = rng.randint(big // 12, big // 4)
        jitter = rng.uniform(-0.25, 0.25)
        dx, dy = math.cos(angle + jitter) * length, math.sin(angle + jitter) * length
        tone = ramp.rgb(rng.choice([0, 1, 3, steps]))
        draw.line([(x, y), (x + dx, y + dy)], fill=(*tone, rng.randint(30, 70)),
                  width=rng.randint(2, 5))
    field = field.filter(ImageFilter.GaussianBlur(1.6))
    # Light from the upper left, which is what gives a painted surface its form.
    shade = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    sp = shade.load()
    for y in range(big):
        for x in range(big):
            lit = (x + y) / (2 * big)
            sp[x, y] = (255, 250, 235, int(max(0.0, 0.5 - lit) * 60)) if lit < 0.5 \
                else (10, 14, 20, int((lit - 0.5) * 70))
    return Image.alpha_composite(field.convert("RGBA"), shade).convert("RGB")


SURFACES = {"pixel": _pixel_surface, "flat": _flat_surface, "painted": _painted_surface}


@dataclass(frozen=True)
class Language:
    """A complete way of drawing the ground."""
    name: str
    label: str
    surface: str
    ramps: dict[str, Ramp]
    #: Keyline along the cut. `flat` leans on it hard; `painted` barely uses it.
    edge_alpha: int
    edge_width: float
    edge_blur: float
    edge_color: str = "#101820"
    #: A lit lip just inside the cut, which reads as thickness.
    bevel_alpha: int = 0


def _ramp(*tones: str) -> Ramp:
    return Ramp(tones)


PIXEL = Language(
    name="pixel", label="1. 픽셀 — 저해상도 램프 + 정렬 디더, 덩어리로 된 모티프",
    surface="pixel", edge_alpha=120, edge_width=1.0, edge_blur=0.0, bevel_alpha=70,
    ramps={
        "grass": _ramp("#243b1c", "#365427", "#4a6f33", "#659143", "#8ab857"),
        "dirt": _ramp("#3d2a19", "#5a3d24", "#7a5432", "#9c6d43", "#bd8b5c"),
        "road": _ramp("#4a3f30", "#6b5c46", "#8d7a5e", "#af9a79", "#cbb897"),
        "stone": _ramp("#2f342f", "#474d45", "#636a5f", "#828879", "#a4a897"),
        "water": _ramp("#12314a", "#1c4967", "#276486", "#3b86a9", "#6fb6d2"),
    },
)

FLAT = Language(
    name="flat", label="2. 플랫 — 굵은 외곽선, 단색 면, 실루엣 위주",
    surface="flat", edge_alpha=210, edge_width=3.0, edge_blur=0.0, bevel_alpha=0,
    edge_color="#1b2430",
    ramps={
        "grass": _ramp("#3f6b34", "#4e7f3e", "#5f9349", "#74a95a", "#8dbf6e"),
        "dirt": _ramp("#6d4a2c", "#835c38", "#9a7047", "#b08558", "#c69c6d"),
        "road": _ramp("#7a6a52", "#93815f", "#ab9873", "#c2b08b", "#d8c7a6"),
        "stone": _ramp("#5c6159", "#6f746a", "#83887c", "#989d8f", "#adb2a3"),
        "water": _ramp("#1f5878", "#276a8d", "#307ea4", "#4093bb", "#5aa9cf"),
    },
)

PAINTED = Language(
    name="painted", label="3. 페인티드 — 방향성 붓질, 한쪽에서 오는 빛",
    surface="painted", edge_alpha=45, edge_width=2.0, edge_blur=2.2, bevel_alpha=30,
    ramps={
        "grass": _ramp("#2f4a26", "#42642f", "#587f3c", "#6f9b4c", "#8ab763"),
        "dirt": _ramp("#4b3421", "#68492c", "#86633c", "#a37e50", "#bf9a68"),
        "road": _ramp("#584c3b", "#776750", "#968467", "#b3a081", "#cfbc9e"),
        "stone": _ramp("#3a3f39", "#52584e", "#6c7266", "#878d7f", "#a2a899"),
        "water": _ramp("#183b55", "#215272", "#2c6d92", "#3e8db1", "#66b3d0"),
    },
)

ALL = [PIXEL, FLAT, PAINTED]


def corner_points(mask: int, size: int) -> list[tuple[float, float]]:
    h = size / 2
    nw, ne, se, sw = (0, 0), (size, 0), (size, size), (0, size)
    n, e, s, w = (h, 0), (size, h), (h, size), (0, h)
    table = {
        1: [nw, n, w], 2: [n, ne, e], 3: [nw, ne, e, w], 4: [e, se, s],
        5: [nw, n, w, e, se, s], 6: [n, ne, se, s], 7: [nw, ne, se, s, w],
        8: [w, s, sw], 9: [nw, n, s, sw], 10: [n, ne, e, w, s, sw],
        11: [nw, ne, e, s, sw], 12: [w, e, se, sw], 13: [nw, n, e, se, sw],
        14: [n, ne, se, sw, w], 15: [nw, ne, se, sw],
    }
    return table.get(mask, [])


def make_tile(language: Language, material: str, mask: int, seed: int) -> Image.Image:
    rng = random.Random(seed)
    texture = SURFACES[language.surface](language.ramps[material], material, rng)
    if texture.size != (TILE, TILE):
        texture = texture.resize((TILE, TILE), Image.LANCZOS)

    shape = Image.new("L", (TILE, TILE), 0)
    points = corner_points(mask, TILE)
    if points:
        ImageDraw.Draw(shape).polygon(points, fill=255)

    out = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    out.paste(texture, (0, 0), shape)
    if not points:
        return out

    def cut_segments():
        for i in range(len(points)):
            a, b = points[i], points[(i + 1) % len(points)]
            on_border = ((a[0] == b[0] and a[0] in (0, TILE))
                         or (a[1] == b[1] and a[1] in (0, TILE)))
            if not on_border:
                yield a, b

    if language.bevel_alpha:
        lip = Image.new("L", (TILE, TILE), 0)
        pen = ImageDraw.Draw(lip)
        for a, b in cut_segments():
            pen.line([a, b], fill=255, width=max(1, int(language.edge_width * 2)))
        lip = Image.composite(lip, Image.new("L", (TILE, TILE), 0), shape)
        top = language.ramps[material].rgb(len(language.ramps[material].tones) - 1)
        out = Image.alpha_composite(out, Image.composite(
            Image.new("RGBA", (TILE, TILE), (*top, language.bevel_alpha)),
            Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0)), lip))

    if language.edge_alpha:
        rim = Image.new("L", (TILE, TILE), 0)
        pen = ImageDraw.Draw(rim)
        for a, b in cut_segments():
            pen.line([a, b], fill=255, width=max(1, int(language.edge_width)))
        if language.edge_blur:
            rim = rim.filter(ImageFilter.GaussianBlur(language.edge_blur))
        rim = Image.composite(rim, Image.new("L", (TILE, TILE), 0), shape)
        colour = language.edge_color.lstrip("#")
        rgb = tuple(int(colour[i:i + 2], 16) for i in (0, 2, 4))
        out = Image.alpha_composite(out, Image.composite(
            Image.new("RGBA", (TILE, TILE), (*rgb, language.edge_alpha)),
            Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0)), rim))
    return out


BASE_VARIANTS = 4
FIELD_SIZE = 512


def write_set(language: Language, out_dir) -> int:
    """Cuts a language's whole tile set into a folder."""
    from pathlib import Path
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written = 0
    for material in language.ramps:
        for variant in range(BASE_VARIANTS):
            image = make_tile(language, material, 15, hash((language.name, material, "base", variant)) & 0xFFFF)
            suffix = "" if variant == 0 else f"-v{variant}"
            image.save(out / f"{material}-base{suffix}.png")
            written += 1
        for mask in range(16):
            image = make_tile(language, material, mask, hash((language.name, material, mask)) & 0xFFFF)
            image.save(out / f"{material}-transition-{mask:02d}.png")
            written += 1
    return written


def field_texture(language: Language, size: int = FIELD_SIZE, seed: int = 20260819) -> Image.Image:
    """Open country outside the lanes, in the language's own idiom.

    Composed from the base variants and then scattered over as a whole, with
    wraparound, so the repeat sits at 512 rather than at 64 and no mark is cut
    in half at a seam.
    """
    rng = random.Random(seed)
    patch = Image.new("RGBA", (size, size))
    cells = size // TILE
    variants = [make_tile(language, "grass", 15, hash((language.name, "grass", "base", v)) & 0xFFFF)
                for v in range(BASE_VARIANTS)]
    for row in range(cells):
        for col in range(cells):
            patch.alpha_composite(variants[rng.randrange(len(variants))], (col * TILE, row * TILE))

    grass = language.ramps["grass"]
    dirt = language.ramps["dirt"]
    stone = language.ramps["stone"]
    scatter = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pen = ImageDraw.Draw(scatter, "RGBA")

    def wrapped(call) -> None:
        for dx in (-size, 0, size):
            for dy in (-size, 0, size):
                call(dx, dy)

    # Blocks rather than blobs: at this resolution the language is made of
    # rectangles, and a soft ellipse would read as a different material.
    for _ in range(size * size // 4200):
        x, y = rng.randrange(size), rng.randrange(size)
        w, h = rng.randint(8, 26), rng.randint(4, 12)
        tone = (*grass.rgb(4 if rng.random() < 0.6 else 1), 70)
        wrapped(lambda dx, dy, x=x, y=y, w=w, h=h, t=tone:
                pen.rectangle([x + dx, y + dy, x + w + dx, y + h + dy], fill=t))
    for _ in range(size * size // 12000):
        x, y = rng.randrange(size), rng.randrange(size)
        w, h = rng.randint(6, 14), rng.randint(4, 9)
        tone = (*dirt.rgb(2), 90)
        wrapped(lambda dx, dy, x=x, y=y, w=w, h=h, t=tone:
                pen.rectangle([x + dx, y + dy, x + w + dx, y + h + dy], fill=t))
    for _ in range(size * size // 16000):
        x, y = rng.randrange(size), rng.randrange(size)
        s = rng.randint(2, 4)
        wrapped(lambda dx, dy, x=x, y=y, s=s:
                pen.rectangle([x + dx, y + dy, x + s + dx, y + s + dy],
                              fill=(*stone.rgb(4), 200)))
    return Image.alpha_composite(patch, scatter)


def vignette(width: int = 1600, height: int = 900, strength: int = 76) -> Image.Image:
    """Soft fall-off at the screen edges; cut at the canvas aspect ratio."""
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = image.load()
    cx, cy = (width - 1) / 2, (height - 1) / 2
    for y in range(height):
        ny = (y - cy) / cy
        for x in range(width):
            nx = (x - cx) / cx
            distance = min(1.0, (nx * nx + ny * ny) ** 0.5)
            fade = 0.0 if distance <= 0.58 else ((distance - 0.58) / 0.42) ** 2.4
            pixels[x, y] = (6, 12, 18, int(fade * strength))
    return image.filter(ImageFilter.GaussianBlur(6))
