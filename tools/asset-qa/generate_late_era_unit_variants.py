#!/usr/bin/env python3
from __future__ import annotations

import argparse
import colorsys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageColor, ImageDraw


ASSET_DIR = Path("public/assets/production/units")
POSES = ("idle", "walk-a", "walk-b", "attack")
DIRECTIONS = ("n", "ne", "e", "se", "s", "sw", "w", "nw")


@dataclass(frozen=True)
class VariantDef:
    unit_id: str
    source_prefix: str
    standard_frame: bool
    scale: float
    hue_shift: float
    saturation_scale: float
    value_scale: float
    accent: str
    accent_2: str
    role: str


VARIANTS: tuple[VariantDef, ...] = (
    VariantDef("pikeman", "iron-spearman", True, 1.00, 0.04, 1.00, 1.00, "#cfb77b", "#6d5130", "pike"),
    VariantDef("heavy-cavalry", "knight", False, 1.04, 0.02, 0.95, 1.00, "#d8c28f", "#6a4a26", "horse"),
    VariantDef("rifleman", "musketeer", True, 0.98, 0.08, 0.85, 0.98, "#7e8c5c", "#d8d0b8", "rifle"),
    VariantDef("grenadier", "musketeer", True, 1.02, 0.01, 1.10, 1.03, "#c98d3f", "#433328", "grenadier"),
    VariantDef("light-cavalry", "knight", False, 0.96, 0.10, 0.95, 1.02, "#b7d3e8", "#6c3f1a", "horse"),
    VariantDef("cannon-i", "supply-wagon", False, 1.00, 0.00, 0.65, 0.92, "#7e7a72", "#40372f", "cannon"),
    VariantDef("rifleman-late", "musketeer", True, 1.00, 0.14, 0.82, 0.94, "#5f6f84", "#d7d7c7", "rifle"),
    VariantDef("grenadier-late", "musketeer", True, 1.04, 0.92, 1.08, 1.04, "#b45e2f", "#37271d", "grenadier"),
    VariantDef("cavalry", "knight", False, 1.02, 0.16, 0.95, 0.97, "#8da2b6", "#6b4420", "horse"),
    VariantDef("cannon-ii", "supply-wagon", False, 1.05, 0.58, 0.52, 0.84, "#666868", "#2f3134", "cannon"),
    VariantDef("infantry", "musketeer", True, 1.00, 0.18, 0.76, 0.92, "#798878", "#c9d0d2", "rifle"),
    VariantDef("machine-gunner", "musketeer", True, 1.04, 0.26, 0.82, 0.88, "#61726b", "#232830", "machinegun"),
    VariantDef("shock-trooper", "iron-swordsman", True, 1.05, 0.98, 0.96, 1.04, "#c85f49", "#47382d", "assault"),
    VariantDef("artillery-i", "supply-wagon", False, 1.08, 0.12, 0.58, 0.90, "#6e7f65", "#2f392d", "artillery"),
    VariantDef("automatic-rifleman", "musketeer", True, 1.02, 0.55, 0.78, 0.94, "#6c778e", "#d7dfe8", "rifle"),
    VariantDef("support-gunner", "musketeer", True, 1.05, 0.62, 0.86, 0.90, "#8d8570", "#2f2d2b", "machinegun"),
    VariantDef("mobile-infantry", "iron-swordsman", True, 1.03, 0.22, 0.70, 0.98, "#7d8574", "#283228", "assault"),
    VariantDef("artillery-ii", "supply-wagon", False, 1.10, 0.20, 0.52, 0.88, "#76857e", "#2e3836", "artillery"),
    VariantDef("tank", "supply-wagon", False, 1.12, 0.30, 0.74, 0.84, "#7a8f61", "#2d3526", "tank"),
    VariantDef("special-forces", "musketeer", True, 0.98, 0.70, 0.62, 0.78, "#3f5568", "#d7d9d9", "rifle"),
    VariantDef("heavy-gunner", "musketeer", True, 1.08, 0.78, 0.76, 0.86, "#756d59", "#272423", "machinegun"),
    VariantDef("breakthrough-trooper", "iron-swordsman", True, 1.08, 0.08, 0.88, 1.02, "#bf8451", "#433020", "assault"),
    VariantDef("mobile-artillery", "supply-wagon", False, 1.12, 0.42, 0.62, 0.82, "#5e7b58", "#233122", "artillery"),
    VariantDef("modern-tank", "supply-wagon", False, 1.16, 0.36, 0.70, 0.76, "#6c7d58", "#1f2919", "tank"),
)


def shift_pixel(pixel: tuple[int, int, int, int], hue_shift: float, saturation_scale: float, value_scale: float):
    r, g, b, a = pixel
    if a == 0:
        return pixel
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h = (h + hue_shift) % 1.0
    s = max(0.0, min(1.0, s * saturation_scale))
    v = max(0.0, min(1.0, v * value_scale))
    nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
    return (round(nr * 255), round(ng * 255), round(nb * 255), a)


def is_skin_like(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a == 0:
        return False
    if r < 50 or g < 30 or b < 18:
        return False
    if r <= g or g <= b:
        return False
    rg = r - g
    gb = g - b
    return 8 <= rg <= 110 and 4 <= gb <= 80


def recolor(image: Image.Image, spec: VariantDef) -> Image.Image:
    out = image.convert("RGBA")
    out.putdata([
        px if is_skin_like(px) else shift_pixel(px, spec.hue_shift, spec.saturation_scale, spec.value_scale)
        for px in out.getdata()
    ])
    return out


def rescale_to_canvas(image: Image.Image, scale: float) -> Image.Image:
    if scale == 1:
      return image.copy()
    bbox = image.getbbox()
    if bbox is None:
        return image.copy()
    crop = image.crop(bbox)
    nw = max(1, round(crop.width * scale))
    nh = max(1, round(crop.height * scale))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    center_x = image.width // 2
    bottom_y = image.height - 24
    x = center_x - resized.width // 2
    y = bottom_y - resized.height
    canvas.alpha_composite(resized, (x, y))
    return canvas


def accent_position(direction: str, width: int, height: int):
    positions = {
        "n": (width * 0.50, height * 0.40),
        "ne": (width * 0.58, height * 0.44),
        "e": (width * 0.60, height * 0.50),
        "se": (width * 0.58, height * 0.58),
        "s": (width * 0.50, height * 0.60),
        "sw": (width * 0.42, height * 0.58),
        "w": (width * 0.40, height * 0.50),
        "nw": (width * 0.42, height * 0.44),
    }
    return positions[direction]


def add_role_overlay(image: Image.Image, spec: VariantDef, direction: str, pose: str) -> Image.Image:
    out = image.copy()
    draw = ImageDraw.Draw(out)
    x, y = accent_position(direction, out.width, out.height)
    accent = ImageColor.getrgb(spec.accent) + (220,)
    accent_2 = ImageColor.getrgb(spec.accent_2) + (215,)

    if spec.role == "pike":
        dx = 40 if "e" in direction else -40 if "w" in direction else 0
        dy = -20 if direction in ("n", "ne", "nw") else 18 if direction in ("s", "se", "sw") else 0
        draw.line((x, y, x + dx, y + dy), fill=accent, width=5)
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=accent_2)
    elif spec.role in {"rifle", "machinegun"}:
        gun_len = 34 if spec.role == "rifle" else 46
        dx = gun_len if "e" in direction else -gun_len if "w" in direction else 0
        dy = -8 if direction in ("n", "ne", "nw") else 10 if direction in ("s", "se", "sw") else 0
        draw.rounded_rectangle((x - 6, y - 6, x + 6, y + 6), radius=3, fill=accent_2)
        draw.line((x, y, x + dx, y + dy), fill=accent, width=7 if spec.role == "machinegun" else 5)
    elif spec.role == "grenadier":
        draw.ellipse((x - 14, y + 8, x + 2, y + 24), fill=accent)
        draw.line((x - 6, y + 8, x - 6, y - 6), fill=accent_2, width=4)
    elif spec.role == "horse":
        draw.polygon([(x - 20, y - 18), (x + 6, y - 12), (x + 18, y + 6), (x - 10, y + 4)], fill=accent_2)
        if pose == "attack":
            draw.line((x + 6, y - 6, x + 42 if "e" in direction else x - 42 if "w" in direction else x, y - 24), fill=accent, width=5)
    elif spec.role in {"cannon", "artillery"}:
        barrel = 54 if spec.role == "artillery" else 44
        dx = barrel if "e" in direction else -barrel if "w" in direction else 0
        dy = -18 if direction in ("n", "ne", "nw") else 18 if direction in ("s", "se", "sw") else 0
        draw.rounded_rectangle((x - 34, y - 16, x + 20, y + 14), radius=7, fill=accent_2)
        draw.line((x + 4, y - 2, x + dx, y + dy), fill=accent, width=8)
    elif spec.role == "tank":
        barrel = 50
        dx = barrel if "e" in direction else -barrel if "w" in direction else 0
        dy = -14 if direction in ("n", "ne", "nw") else 14 if direction in ("s", "se", "sw") else 0
        draw.rounded_rectangle((x - 40, y - 18, x + 28, y + 20), radius=9, fill=accent_2)
        draw.ellipse((x - 10, y - 20, x + 18, y + 6), fill=accent)
        draw.line((x + 8, y - 8, x + dx, y + dy), fill=accent, width=8)
    elif spec.role == "assault":
        draw.rounded_rectangle((x - 12, y - 10, x + 12, y + 10), radius=4, fill=accent_2)
        if pose == "attack":
            draw.line((x, y, x + (34 if "e" in direction else -34 if "w" in direction else 0), y + (12 if "s" in direction else -12 if "n" in direction else 0)), fill=accent, width=6)

    return out


def build_variant(spec: VariantDef, direction: str, pose: str) -> None:
    source = ASSET_DIR / f"{spec.source_prefix}-{direction}-{pose}.png"
    target = ASSET_DIR / f"{spec.unit_id}-{direction}-{pose}.png"
    image = Image.open(source).convert("RGBA")
    tinted = recolor(image, spec)
    scaled = rescale_to_canvas(tinted, spec.scale)
    final = add_role_overlay(scaled, spec, direction, pose)
    # Preserve original alpha footprint while keeping new overlay within the frame.
    final = ImageChops.screen(final, Image.new("RGBA", final.size, (0, 0, 0, 0)))
    final.save(target)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--unit",
        action="append",
        dest="units",
        default=[],
        help="Regenerate only the specified late-era unit id(s).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    selected_units = set(args.units)
    variants = [
        spec for spec in VARIANTS
        if not selected_units or spec.unit_id in selected_units
    ]
    for spec in variants:
        for direction in DIRECTIONS:
            for pose in POSES:
                build_variant(spec, direction, pose)
    print(f"generated {len(variants)} late-era unit variant sets")


if __name__ == "__main__":
    main()
