#!/usr/bin/env python3
"""Generate deterministic, seamless terrain bases and 16-state overlays."""

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw


TILE_SIZE = 64
SUPERSAMPLE = 4
MATERIALS = {
    "grass": {"base": "#53683a", "dark": "#35472b", "light": "#76844a"},
    "dirt": {"base": "#765638", "dark": "#4c382a", "light": "#a07a50"},
    "road": {"base": "#8b7458", "dark": "#5d5040", "light": "#b09b79"},
    "stone": {"base": "#666760", "dark": "#444942", "light": "#8c8878"},
}


def polygons(mask: int, size: int) -> list[list[tuple[int, int]]]:
    h = size // 2
    nw, ne, se, sw = (0, 0), (size, 0), (size, size), (0, size)
    n, e, s, w = (h, 0), (size, h), (h, size), (0, h)
    states = {
        0: [], 1: [[nw, n, w]], 2: [[n, ne, e]], 3: [[nw, ne, e, w]],
        4: [[e, se, s]], 5: [[nw, n, w], [e, se, s]],
        6: [[n, ne, se, s]], 7: [[nw, ne, se, s, w]],
        8: [[w, s, sw]], 9: [[nw, n, s, sw]],
        10: [[n, ne, e], [w, s, sw]], 11: [[nw, ne, e, s, sw]],
        12: [[w, e, se, sw]], 13: [[nw, n, e, se, sw]],
        14: [[n, ne, se, sw, w]], 15: [[nw, ne, se, sw]],
    }
    return states[mask]


def seeded_noise(x: int, y: int, salt: int) -> float:
    value = math.sin(x * 12.9898 + y * 78.233 + salt * 31.37) * 43758.5453
    return value - math.floor(value)


def material_texture(name: str) -> Image.Image:
    palette = MATERIALS[name]
    image = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), palette["base"])
    detail = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(detail, "RGBA")
    salt = list(MATERIALS).index(name) + 1

    for y in range(2, TILE_SIZE, 4):
        for x in range(2, TILE_SIZE, 4):
            value = seeded_noise(x, y, salt)
            color = palette["light"] if value > 0.63 else palette["dark"]
            alpha = 62 if value > 0.63 else 44
            draw.rectangle((x, y, x + 1, y + 1), fill=color + f"{alpha:02x}")

    if name == "grass":
        random.seed(3101)
        for _ in range(34):
            x, y = random.randrange(TILE_SIZE), random.randrange(TILE_SIZE)
            draw.line((x, y + 2, x + 1, y), fill="#88955270", width=1)
    elif name == "dirt":
        random.seed(3102)
        for _ in range(22):
            x, y = random.randrange(TILE_SIZE), random.randrange(TILE_SIZE)
            draw.ellipse((x, y, x + 2, y + 1), fill="#b894654d")
    elif name == "road":
        for y in (15, 31, 47, 63):
            draw.line((0, y, TILE_SIZE, y), fill="#554a3b70", width=1)
        for row, y in enumerate((0, 16, 32, 48)):
            offset = 8 if row % 2 else 0
            for x in range(offset, TILE_SIZE, 16):
                draw.line((x, y, x, min(TILE_SIZE - 1, y + 15)), fill="#5c504064", width=1)
    else:
        for y in (0, 16, 32, 48, 63):
            draw.line((0, y, TILE_SIZE, y), fill="#3c413b90", width=1)
        for row, y in enumerate((0, 16, 32, 48)):
            offset = 16 if row % 2 else 0
            for x in range(offset, TILE_SIZE, 32):
                draw.line((x, y, x, min(TILE_SIZE - 1, y + 15)), fill="#41464088", width=1)
    return Image.alpha_composite(image, detail)


def transition(texture: Image.Image, mask: int) -> Image.Image:
    size = TILE_SIZE * SUPERSAMPLE
    matte = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(matte)
    for polygon in polygons(mask, size):
        draw.polygon(polygon, fill=255)
    matte = matte.resize((TILE_SIZE, TILE_SIZE), Image.Resampling.LANCZOS)
    result = texture.copy()
    result.putalpha(matte)
    return result


def compose_contact_sheet(output: Path, asset_dir: Path) -> None:
    scale = 2
    cell = TILE_SIZE * scale
    sheet = Image.new("RGB", (cell * 17, cell * 4), "#1b211b")
    draw = ImageDraw.Draw(sheet)
    for row, material in enumerate(MATERIALS):
        base = Image.open(asset_dir / f"{material}-base.png").convert("RGBA").resize((cell, cell), Image.Resampling.NEAREST)
        sheet.paste(base, (0, row * cell), base)
        draw.text((4, row * cell + 4), f"{material} base", fill="white")
        for mask in range(16):
            checker = Image.new("RGBA", (cell, cell), "#394239")
            tile = Image.open(asset_dir / f"{material}-transition-{mask:02d}.png").convert("RGBA").resize((cell, cell), Image.Resampling.NEAREST)
            checker.alpha_composite(tile)
            x = (mask + 1) * cell
            sheet.paste(checker.convert("RGB"), (x, row * cell))
            draw.text((x + 4, row * cell + 4), f"{mask:X}", fill="white")
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="public/assets/production/terrain")
    parser.add_argument("--contact-sheet", default="artifacts/volume-production/terrain-material-families.png")
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    files: list[str] = []
    for material in MATERIALS:
        texture = material_texture(material)
        base_name = f"{material}-base.png"
        texture.save(output / base_name)
        files.append(base_name)
        for mask in range(16):
            filename = f"{material}-transition-{mask:02d}.png"
            transition(texture, mask).save(output / filename)
            files.append(filename)

    manifest = {
        "tileSize": [TILE_SIZE, TILE_SIZE],
        "transitionGrammar": "16-state marching squares transparent overlay",
        "materials": list(MATERIALS),
        "files": files,
        "provenance": "deterministic project-local Pillow generator; no third-party game assets",
    }
    (output / "terrain-volume-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    compose_contact_sheet(Path(args.contact_sheet), output)
    print(f"generated {len(files)} terrain assets -> {output}")


if __name__ == "__main__":
    main()
