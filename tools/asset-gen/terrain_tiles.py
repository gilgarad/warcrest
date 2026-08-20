"""Generates the battlefield's terrain tiles.

The terrain is a marching-squares tile set: every material needs one full tile
plus fourteen partial ones, and each partial has to line up with its neighbours
along a shared edge. Drawing sixty-eight of those by hand and keeping them
consistent is the kind of work that decays; generating them means the whole set
is one palette away from being re-cut, which is what a wholesale art change
needs.

Corner bits follow `src/systems/terrain/marchingSquares.ts`:
NW=1, NE=2, SE=4, SW=8. Mask 15 is the full tile, mask 0 draws nothing.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

TILE = 64
# Supersampled, then reduced: the diagonal cuts are the whole point of the tile
# set, and drawn at final size they come out as staircases.
SS = 4


@dataclass(frozen=True)
class Material:
    """One terrain surface, as the handful of numbers that define its look."""
    name: str
    base: str
    shade: str
    light: str
    accent: str
    #: How much per-pixel variation the surface carries. Ground wants some;
    #: water reads as cloth if it has too much.
    grain: float = 0.10
    #: Density of the scattered detail marks (tufts, pebbles, ripples).
    speckle: float = 0.0
    speckle_size: tuple[int, int] = (1, 2)
    #: Which decoration routine draws this surface's character.
    decor: str = "none"
    #: How much of it. Kept low on purpose: one texture serves every cell of a
    #: given material and mask, so anything bold repeats visibly across a field.
    decor_density: float = 0.0


@dataclass(frozen=True)
class Style:
    """A complete art direction: the materials plus how edges are treated."""
    name: str
    label: str
    materials: dict[str, Material]
    #: Width of the darker rim drawn where a material ends, in final pixels.
    edge_width: float = 2.0
    edge_color: str = "#000000"
    edge_alpha: int = 70
    #: Softening applied to the cut edge. Zero is a hard pixel edge.
    edge_blur: float = 0.0


def _hex(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def _mix(a: str, b: str, t: float) -> tuple[int, int, int]:
    ca, cb = _hex(a), _hex(b)
    return tuple(round(ca[i] + (cb[i] - ca[i]) * t) for i in range(3))


def corner_points(mask: int, size: int) -> list[tuple[float, float]]:
    """The filled region for a mask, matching `getMarchingPolygons`."""
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


def surface(material: Material, size: int, rng: random.Random) -> Image.Image:
    """The material's own texture, before any shape is cut out of it."""
    image = Image.new("RGB", (size, size), _hex(material.base))
    pixels = image.load()
    for y in range(size):
        # A gentle top-to-bottom ramp keeps a flat fill from reading as plastic.
        ramp = (y / size - 0.5) * 0.35
        for x in range(size):
            noise = rng.uniform(-material.grain, material.grain) + ramp * material.grain
            target = material.light if noise > 0 else material.shade
            pixels[x, y] = _mix(material.base, target, min(1.0, abs(noise) * 6))

    if material.speckle > 0:
        draw = ImageDraw.Draw(image)
        count = int(size * size * material.speckle / (SS * SS))
        for _ in range(count):
            x, y = rng.randrange(size), rng.randrange(size)
            r = rng.randint(*material.speckle_size) * SS // 2
            draw.ellipse([x - r, y - r, x + r, y + r], fill=_mix(material.base, material.accent, 0.75))
    return image


def decorate(image: Image.Image, material: Material, size: int, rng: random.Random) -> None:
    """Draws the marks that give a surface its character.

    Deliberately small and sparse. A single texture is reused for every cell of
    the same material and mask, so a bold mark becomes a visible grid of itself
    across open ground; the large features belong to the prop layer, which is
    placed at world positions and does not repeat.
    """
    if material.decor == "none" or material.decor_density <= 0:
        return
    draw = ImageDraw.Draw(image, "RGBA")
    count = max(1, int(size * size * material.decor_density / (SS * SS)))

    if material.decor == "tuft":
        # Short blades leaning off vertical, in pairs, so grass reads as growth
        # rather than as noise.
        for _ in range(count):
            x, y = rng.randrange(size), rng.randrange(size)
            height = rng.randint(3, 6) * SS
            for offset in (-SS, SS):
                lean = rng.uniform(-0.35, 0.35) * height
                draw.line([(x + offset, y), (x + offset + lean, y - height)],
                          fill=(*_hex(material.accent), 150), width=max(1, SS // 2))
    elif material.decor == "pebble":
        for _ in range(count):
            x, y = rng.randrange(size), rng.randrange(size)
            r = rng.randint(1, 3) * SS // 2
            draw.ellipse([x - r, y - r, x + r, y + r], fill=(*_hex(material.light), 190))
            draw.arc([x - r, y - r, x + r, y + r], 200, 340, fill=(*_hex(material.shade), 160))
    elif material.decor == "rut":
        # Long shallow streaks along the road, the tracks that make a road read
        # as travelled rather than as a stripe of paint.
        for _ in range(max(2, count // 6)):
            y = rng.randrange(size)
            length = rng.randint(size // 3, size)
            x = rng.randrange(max(1, size - length))
            shade = material.shade if rng.random() < 0.6 else material.light
            draw.line([(x, y), (x + length, y + rng.randint(-SS, SS))],
                      fill=(*_hex(shade), 90), width=max(1, SS // 2))
    elif material.decor == "ripple":
        for _ in range(max(2, count // 3)):
            y = rng.randrange(size)
            length = rng.randint(size // 5, size // 2)
            x = rng.randrange(max(1, size - length))
            draw.arc([x, y, x + length, y + rng.randint(2, 5) * SS], 200, 340,
                     fill=(*_hex(material.accent), 130), width=max(1, SS // 2))
    elif material.decor == "crack":
        for _ in range(max(1, count // 8)):
            x, y = rng.randrange(size), rng.randrange(size)
            for _ in range(rng.randint(2, 4)):
                nx, ny = x + rng.randint(-8, 8) * SS, y + rng.randint(-8, 8) * SS
                draw.line([(x, y), (nx, ny)], fill=(*_hex(material.shade), 120), width=max(1, SS // 2))
                x, y = nx, ny


def tile(style: Style, material: Material, mask: int, seed: int) -> Image.Image:
    rng = random.Random(seed)
    big = TILE * SS
    texture = surface(material, big, rng)
    decorate(texture, material, big, rng)

    shape = Image.new("L", (big, big), 0)
    points = corner_points(mask, big)
    if points:
        ImageDraw.Draw(shape).polygon(points, fill=255)

    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    out.paste(texture, (0, 0), shape)

    # A darker rim along the cut only.
    #
    # Drawing the whole outline puts a line on all four tile borders, and since
    # every neighbour does the same the field comes out as a lattice of seams.
    # Only the segments that actually cut across the tile are edges of anything;
    # the ones lying along a border are shared with the next tile and invisible
    # in the real surface.
    if points and style.edge_alpha > 0:
        rim = Image.new("L", (big, big), 0)
        pen = ImageDraw.Draw(rim)
        width = max(1, int(style.edge_width * SS))
        for index in range(len(points)):
            start, end = points[index], points[(index + 1) % len(points)]
            on_border = (
                (start[0] == end[0] and start[0] in (0, big))
                or (start[1] == end[1] and start[1] in (0, big))
            )
            if on_border:
                continue
            pen.line([start, end], fill=255, width=width)
        if style.edge_blur > 0:
            rim = rim.filter(ImageFilter.GaussianBlur(style.edge_blur * SS))
        rim = Image.composite(rim, Image.new("L", (big, big), 0), shape)
        edge = Image.new("RGBA", (big, big), (*_hex(style.edge_color), style.edge_alpha))
        out = Image.alpha_composite(out, Image.composite(
            edge, Image.new("RGBA", (big, big), (0, 0, 0, 0)), rim))

    return out.resize((TILE, TILE), Image.LANCZOS)


#: How many interchangeable versions of the full tile to cut.
#:
#: One texture per material was reused for every cell of open ground, so the
#: decoration lined up into a visible grid of itself -- the tufts read as a
#: planted lattice rather than as grass. Variants break that up. Only the full
#: tile needs them: partial tiles appear along edges in short runs, where the
#: eye has nothing to line them up against.
BASE_VARIANTS = 4


def write_set(style: Style, out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    for name, material in style.materials.items():
        for variant in range(BASE_VARIANTS):
            image = tile(style, material, 15, hash((style.name, name, "base", variant)) & 0xFFFF)
            suffix = "" if variant == 0 else f"-v{variant}"
            image.save(out_dir / f"{name}-base{suffix}.png")
            written += 1
        for mask in range(16):
            image = tile(style, material, mask, hash((style.name, name, mask)) & 0xFFFF)
            image.save(out_dir / f"{name}-transition-{mask:02d}.png")
            written += 1
    return written
