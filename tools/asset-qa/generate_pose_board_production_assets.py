#!/usr/bin/env python3
from __future__ import annotations

import argparse
import colorsys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "public/assets/production/units"
BOARD_DIR = ROOT / "docs/dev-wiki/visual-drafts"
TARGET_OPAQUE_HEIGHT = 270
TARGET_ANCHOR_Y = 336
STANDARD_CANVAS = (384, 384)
WIDE_CANVAS = (512, 384)
DIRECTIONS = ("w", "nw", "n", "ne", "e", "se", "s", "sw")
POSES = ("idle", "walk-a", "walk-b", "attack")


@dataclass(frozen=True)
class BoardSpec:
    path: Path
    rows: int
    cols: int


@dataclass(frozen=True)
class UnitSpec:
    prefix: str
    board: str
    row: int
    wide_all: bool = False
    hue_shift: float = 0.0
    saturation_scale: float = 1.0
    value_scale: float = 1.0
    role: str = "infantry"
    walk_b_mode: Literal["rotate", "shift"] = "rotate"
    cleanup_mode: Literal["largest-only", "keep-nearby"] = "largest-only"
    keep_margin_x: int = 12
    keep_margin_top: int = 0
    keep_margin_bottom: int = 0
    keep_min_area: int = 24
    trim_sparse_bottom_rows: int = 0
    trim_sparse_top_rows: int = 0
    trim_full_width_top_rows: int = 0
    clear_top_rows: int = 0
    trim_wide_top_rows: int = 0
    trim_wide_top_threshold: float = 0.45
    clear_bottom_rows: int = 0
    trim_wide_bottom_rows: int = 0
    trim_wide_bottom_threshold: float = 0.45
    brown_cleanup_top_ratio: float = 0.0
    brown_cleanup_bottom_ratio: float = 0.0
    bottom_alpha_cleanup_cutoff: int = 0
    bottom_alpha_cleanup_start_ratio: float = 1.0
    idle_from_walk: bool = False
    idle_from_attack: bool = False
    walk_from_attack: bool = False


BOARDS: dict[str, BoardSpec] = {
    "human": BoardSpec(BOARD_DIR / "late-era-human-pose-board-2026-08-03.png", 6, 3),
    "heavy": BoardSpec(BOARD_DIR / "late-era-heavy-pose-board-2026-08-03.png", 6, 3),
    "modern": BoardSpec(BOARD_DIR / "modern-combat-pose-board-2026-08-04.png", 6, 3),
    "mechanized": BoardSpec(BOARD_DIR / "mechanized-pose-board-2026-08-04.png", 6, 3),
    "support": BoardSpec(BOARD_DIR / "support-evolution-pose-board-2026-08-03.png", 6, 3),
}


UNIT_SPECS: tuple[UnitSpec, ...] = (
    UnitSpec("pikeman", "human", 1, role="infantry"),
    UnitSpec(
        "heavy-cavalry",
        "human",
        2,
        wide_all=True,
        role="cavalry",
        walk_b_mode="shift",
        cleanup_mode="largest-only",
        keep_margin_x=92,
        keep_margin_top=28,
        keep_margin_bottom=28,
        keep_min_area=40,
        clear_top_rows=18,
        brown_cleanup_top_ratio=0.16,
        trim_sparse_top_rows=4,
        trim_wide_top_rows=4,
        trim_wide_top_threshold=0.42,
    ),
    UnitSpec("rifleman", "human", 3, role="infantry", walk_b_mode="shift"),
    UnitSpec(
        "grenadier",
        "human",
        4,
        role="infantry",
        saturation_scale=1.04,
        walk_b_mode="shift",
    ),
    UnitSpec(
        "light-cavalry",
        "human",
        5,
        wide_all=True,
        role="cavalry",
        walk_b_mode="shift",
        cleanup_mode="largest-only",
        keep_margin_x=92,
        keep_margin_top=24,
        keep_margin_bottom=24,
        keep_min_area=40,
        clear_top_rows=14,
        brown_cleanup_top_ratio=0.14,
        trim_sparse_top_rows=4,
        trim_wide_top_rows=4,
        trim_wide_top_threshold=0.42,
    ),
    UnitSpec(
        "cannon-i",
        "mechanized",
        0,
        wide_all=True,
        role="artillery",
        walk_b_mode="shift",
        cleanup_mode="keep-nearby",
        keep_margin_x=140,
        keep_margin_bottom=48,
        keep_min_area=32,
        trim_sparse_bottom_rows=0,
        brown_cleanup_bottom_ratio=0.08,
        bottom_alpha_cleanup_cutoff=140,
        bottom_alpha_cleanup_start_ratio=0.86,
    ),
    UnitSpec(
        "rifleman-late",
        "human",
        3,
        role="infantry",
        hue_shift=0.04,
        saturation_scale=0.92,
        value_scale=0.94,
        walk_b_mode="shift",
    ),
    UnitSpec(
        "grenadier-late",
        "human",
        4,
        role="infantry",
        hue_shift=0.02,
        saturation_scale=0.98,
        value_scale=0.92,
        walk_b_mode="shift",
    ),
    UnitSpec(
        "cavalry",
        "human",
        5,
        wide_all=True,
        role="cavalry",
        walk_b_mode="shift",
        cleanup_mode="largest-only",
        keep_margin_x=92,
        keep_margin_top=24,
        keep_margin_bottom=24,
        keep_min_area=40,
        clear_top_rows=14,
        brown_cleanup_top_ratio=0.14,
        trim_wide_top_rows=4,
        trim_wide_top_threshold=0.42,
    ),
    UnitSpec(
        "cannon-ii",
        "mechanized",
        1,
        wide_all=True,
        role="artillery",
        walk_b_mode="shift",
        cleanup_mode="keep-nearby",
        keep_margin_x=140,
        keep_margin_bottom=48,
        keep_min_area=32,
        trim_sparse_bottom_rows=0,
        brown_cleanup_bottom_ratio=0.08,
        bottom_alpha_cleanup_cutoff=140,
        bottom_alpha_cleanup_start_ratio=0.86,
    ),
    UnitSpec(
        "infantry",
        "modern",
        0,
        role="infantry",
        walk_b_mode="shift",
        cleanup_mode="keep-nearby",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "machine-gunner",
        "modern",
        1,
        role="infantry",
        cleanup_mode="keep-nearby",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "shock-trooper",
        "modern",
        2,
        role="infantry",
        cleanup_mode="keep-nearby",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "artillery-i",
        "mechanized",
        2,
        wide_all=True,
        role="artillery",
        walk_b_mode="shift",
        cleanup_mode="keep-nearby",
        keep_margin_x=140,
        keep_margin_bottom=48,
        keep_min_area=32,
        trim_sparse_bottom_rows=0,
        brown_cleanup_bottom_ratio=0.08,
        bottom_alpha_cleanup_cutoff=140,
        bottom_alpha_cleanup_start_ratio=0.86,
    ),
    UnitSpec(
        "automatic-rifleman",
        "modern",
        3,
        role="infantry",
        cleanup_mode="keep-nearby",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "support-gunner",
        "modern",
        4,
        role="infantry",
        cleanup_mode="keep-nearby",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "mobile-infantry",
        "heavy",
        3,
        role="infantry",
        walk_b_mode="shift",
        cleanup_mode="keep-nearby",
        keep_margin_bottom=90,
        keep_min_area=48,
        trim_sparse_bottom_rows=0,
        brown_cleanup_bottom_ratio=0.05,
        trim_wide_bottom_rows=8,
        trim_wide_bottom_threshold=0.42,
    ),
    UnitSpec(
        "artillery-ii",
        "mechanized",
        3,
        wide_all=True,
        role="artillery",
        walk_b_mode="shift",
        cleanup_mode="keep-nearby",
        keep_margin_x=140,
        keep_margin_bottom=48,
        keep_min_area=32,
        trim_sparse_bottom_rows=0,
        brown_cleanup_bottom_ratio=0.08,
        bottom_alpha_cleanup_cutoff=140,
        bottom_alpha_cleanup_start_ratio=0.86,
    ),
    UnitSpec(
        "tank",
        "mechanized",
        4,
        wide_all=True,
        role="vehicle",
        walk_b_mode="shift",
        cleanup_mode="keep-nearby",
        keep_margin_x=160,
        keep_margin_bottom=52,
        keep_min_area=40,
        trim_sparse_bottom_rows=1,
        brown_cleanup_bottom_ratio=0.08,
        bottom_alpha_cleanup_cutoff=140,
        bottom_alpha_cleanup_start_ratio=0.86,
    ),
    UnitSpec(
        "special-forces",
        "modern",
        5,
        role="infantry",
        walk_b_mode="shift",
        cleanup_mode="keep-nearby",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "heavy-gunner",
        "heavy",
        4,
        wide_all=True,
        role="infantry",
        walk_b_mode="shift",
        cleanup_mode="keep-nearby",
        keep_margin_bottom=90,
        keep_min_area=48,
        trim_sparse_bottom_rows=0,
        brown_cleanup_bottom_ratio=0.05,
        clear_bottom_rows=2,
        trim_wide_bottom_rows=2,
        trim_wide_bottom_threshold=0.7,
    ),
    UnitSpec(
        "breakthrough-trooper",
        "modern",
        2,
        role="infantry",
        hue_shift=0.02,
        saturation_scale=1.08,
        value_scale=1.02,
        cleanup_mode="keep-nearby",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "mobile-artillery",
        "mechanized",
        5,
        wide_all=True,
        role="vehicle",
        walk_b_mode="shift",
        value_scale=0.9,
        cleanup_mode="keep-nearby",
        keep_margin_x=160,
        keep_margin_bottom=52,
        keep_min_area=40,
        trim_sparse_bottom_rows=1,
        brown_cleanup_bottom_ratio=0.08,
        bottom_alpha_cleanup_cutoff=140,
        bottom_alpha_cleanup_start_ratio=0.86,
    ),
    UnitSpec(
        "modern-tank",
        "mechanized",
        5,
        wide_all=True,
        role="vehicle",
        walk_b_mode="shift",
        value_scale=0.92,
        cleanup_mode="keep-nearby",
        keep_margin_x=160,
        keep_margin_bottom=52,
        keep_min_area=40,
        trim_sparse_bottom_rows=1,
        brown_cleanup_bottom_ratio=0.08,
        bottom_alpha_cleanup_cutoff=140,
        bottom_alpha_cleanup_start_ratio=0.86,
    ),
    UnitSpec("supply-wagon-ancient", "support", 0, wide_all=True, role="support", trim_full_width_top_rows=2),
    UnitSpec("supply-wagon-iron", "support", 2, wide_all=True, role="support", trim_full_width_top_rows=2),
    UnitSpec("supply-wagon-renaissance", "support", 3, wide_all=True, role="support", trim_full_width_top_rows=2),
    UnitSpec("supply-wagon-industrial", "support", 4, wide_all=True, role="support", trim_full_width_top_rows=2),
    UnitSpec("supply-wagon-modern", "support", 5, wide_all=True, role="support", trim_full_width_top_rows=2),
)


ANGLE_BY_DIRECTION = {
    "w": 0,
    "nw": -14,
    "n": -26,
    "ne": -14,
    "e": 0,
    "se": 14,
    "s": 26,
    "sw": 14,
}

WIDTH_SCALE_BY_DIRECTION = {
    "w": 1.0,
    "nw": 0.97,
    "n": 0.93,
    "ne": 0.97,
    "e": 1.0,
    "se": 0.97,
    "s": 0.93,
    "sw": 0.97,
}


def board_cells(spec: BoardSpec) -> list[list[Image.Image]]:
    image = Image.open(spec.path).convert("RGBA")
    col_edges = [round(image.width * index / spec.cols) for index in range(spec.cols + 1)]
    row_edges = [round(image.height * index / spec.rows) for index in range(spec.rows + 1)]
    rows: list[list[Image.Image]] = []
    for row in range(spec.rows):
        row_cells: list[Image.Image] = []
        for col in range(spec.cols):
            cell_w = col_edges[col + 1] - col_edges[col]
            cell_h = row_edges[row + 1] - row_edges[row]
            inset_x = max(4, round(cell_w * 0.025))
            inset_y = 0
            left = col_edges[col] + inset_x
            top = row_edges[row] + inset_y
            right = col_edges[col + 1] - inset_x
            bottom = row_edges[row + 1] - inset_y
            row_cells.append(image.crop((left, top, right, bottom)))
        rows.append(row_cells)
    return rows


def remove_background(cell: Image.Image) -> Image.Image:
    rgba = cell.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    corners = [pixels[2, 2], pixels[width - 3, 2], pixels[2, height - 3], pixels[width - 3, height - 3]]
    bg = tuple(round(sum(point[i] for point in corners) / len(corners)) for i in range(3))
    masked = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    out = masked.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            delta = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            if a == 0 or delta < 28:
                continue
            out[x, y] = (r, g, b, 255)
    alpha = masked.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return masked
    return masked.crop(bbox)


def trim_bottom_sparse_rows(image: Image.Image, rows: int) -> Image.Image:
    if rows <= 0:
        return image
    out = image.copy()
    alpha = out.getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    cleared = 0
    for y in range(height - 1, -1, -1):
        coverage = sum(1 for x in range(width) if pixels[x, y] >= 12)
        if coverage == 0:
            continue
        if coverage / max(1, width) > 0.18 or cleared >= rows:
            break
        for x in range(width):
            out.putpixel((x, y), (0, 0, 0, 0))
        cleared += 1
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def trim_top_sparse_rows(image: Image.Image, rows: int) -> Image.Image:
    if rows <= 0:
        return image
    out = image.copy()
    alpha = out.getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    trimmed = 0
    for y in range(height):
        coverage = sum(1 for x in range(width) if pixels[x, y] >= 12)
        if coverage == 0:
            continue
        if coverage / max(1, width) >= 0.28 or trimmed >= rows:
            break
        for x in range(width):
            out.putpixel((x, y), (0, 0, 0, 0))
        trimmed += 1
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def trim_full_width_top_rows(image: Image.Image, rows: int) -> Image.Image:
    if rows <= 0:
        return image
    out = image.copy()
    alpha = out.getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    trimmed = 0
    for y in range(height):
        coverage = sum(1 for x in range(width) if pixels[x, y] >= 12)
        if coverage == 0:
            continue
        if coverage / max(1, width) < 0.85 or trimmed >= rows:
            break
        for x in range(width):
            out.putpixel((x, y), (0, 0, 0, 0))
        trimmed += 1
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def clear_top_rows(image: Image.Image, rows: int) -> Image.Image:
    if rows <= 0:
        return image
    out = image.copy()
    for y in range(min(rows, out.height)):
        for x in range(out.width):
            out.putpixel((x, y), (0, 0, 0, 0))
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def clear_bottom_rows(image: Image.Image, rows: int) -> Image.Image:
    if rows <= 0:
        return image
    out = image.copy()
    start = max(0, out.height - rows)
    for y in range(start, out.height):
        for x in range(out.width):
            out.putpixel((x, y), (0, 0, 0, 0))
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def clear_brown_strip(image: Image.Image, top_ratio: float, bottom_ratio: float) -> Image.Image:
    if top_ratio <= 0 and bottom_ratio <= 0:
        return image
    out = image.copy()
    width, height = out.size
    top_limit = round(height * top_ratio)
    bottom_start = height - round(height * bottom_ratio)
    for y in range(height):
        in_top = top_ratio > 0 and y < top_limit
        in_bottom = bottom_ratio > 0 and y >= bottom_start
        if not in_top and not in_bottom:
            continue
        for x in range(width):
            r, g, b, a = out.getpixel((x, y))
            if a == 0:
                continue
            is_brown = r >= 70 and g >= 40 and b <= 120 and (r - b) >= 18 and (r - g) >= 4
            if is_brown:
                out.putpixel((x, y), (0, 0, 0, 0))
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def trim_wide_top_rows(image: Image.Image, rows: int, threshold: float) -> Image.Image:
    if rows <= 0:
        return image
    out = image.copy()
    alpha = out.getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    trimmed = 0
    for y in range(height):
        coverage = sum(1 for x in range(width) if pixels[x, y] >= 12)
        if coverage == 0:
            continue
        if coverage / max(1, width) < threshold or trimmed >= rows:
            break
        for x in range(width):
            out.putpixel((x, y), (0, 0, 0, 0))
        trimmed += 1
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def trim_wide_bottom_rows(image: Image.Image, rows: int, threshold: float) -> Image.Image:
    if rows <= 0:
        return image
    out = image.copy()
    alpha = out.getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    trimmed = 0
    for y in range(height - 1, -1, -1):
        coverage = sum(1 for x in range(width) if pixels[x, y] >= 12)
        if coverage == 0:
            continue
        if coverage / max(1, width) < threshold or trimmed >= rows:
            break
        for x in range(width):
            out.putpixel((x, y), (0, 0, 0, 0))
        trimmed += 1
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def cleanup_bottom_low_alpha(image: Image.Image, cutoff: int, start_ratio: float) -> Image.Image:
    if cutoff <= 0:
        return image
    out = image.copy()
    width, height = out.size
    start_y = round(height * start_ratio)
    for y in range(max(0, start_y), height):
        for x in range(width):
            r, g, b, a = out.getpixel((x, y))
            if 0 < a < cutoff:
                out.putpixel((x, y), (0, 0, 0, 0))
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def erase_bottom_warm_strip(
    image: Image.Image,
    rows: int,
    min_r: int = 70,
    min_g: int = 50,
    max_b: int = 90,
) -> Image.Image:
    if rows <= 0:
        return image
    out = image.copy()
    width, height = out.size
    start_y = max(0, height - rows)
    for y in range(start_y, height):
        for x in range(width):
            r, g, b, a = out.getpixel((x, y))
            if a < 12:
                continue
            if r >= min_r and g >= min_g and b <= max_b:
                out.putpixel((x, y), (0, 0, 0, 0))
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def erase_bottom_low_alpha_debris(
    image: Image.Image,
    rows: int,
    alpha_cutoff: int = 170,
    brightness_cutoff: int = 120,
) -> Image.Image:
    if rows <= 0:
        return image
    out = image.copy()
    width, height = out.size
    start_y = max(0, height - rows)
    for y in range(start_y, height):
        for x in range(width):
            r, g, b, a = out.getpixel((x, y))
            if a < 12 or a >= alpha_cutoff:
                continue
            if max(r, g, b) <= brightness_cutoff:
                out.putpixel((x, y), (0, 0, 0, 0))
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def erase_bottom_sparse_debris(
    image: Image.Image,
    start_ratio: float = 0.55,
    alpha_cutoff: int = 24,
    radius: int = 2,
    min_neighbors: int = 12,
) -> Image.Image:
    out = image.copy()
    width, height = out.size
    start_y = max(0, round(height * start_ratio))
    alpha = out.getchannel("A")
    remove: list[tuple[int, int]] = []
    for y in range(start_y, height):
        for x in range(width):
            if alpha.getpixel((x, y)) < alpha_cutoff:
                continue
            neighbors = 0
            for ny in range(max(0, y - radius), min(height, y + radius + 1)):
                for nx in range(max(0, x - radius), min(width, x + radius + 1)):
                    if alpha.getpixel((nx, ny)) >= alpha_cutoff:
                        neighbors += 1
            if neighbors < min_neighbors:
                remove.append((x, y))
    for x, y in remove:
        out.putpixel((x, y), (0, 0, 0, 0))
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def keep_primary_cluster(image: Image.Image, spec: UnitSpec) -> Image.Image:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = alpha.size
    visited: set[tuple[int, int]] = set()
    components: list[tuple[int, tuple[int, int, int, int], list[tuple[int, int]]]] = []
    for y in range(height):
        for x in range(width):
            if pixels[x, y] < 12 or (x, y) in visited:
                continue
            stack = [(x, y)]
            visited.add((x, y))
            component: list[tuple[int, int]] = []
            while stack:
                cx, cy = stack.pop()
                component.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < width and 0 <= ny < height and pixels[nx, ny] >= 12 and (nx, ny) not in visited:
                        visited.add((nx, ny))
                        stack.append((nx, ny))
            xs = [point[0] for point in component]
            ys = [point[1] for point in component]
            components.append((len(component), (min(xs), min(ys), max(xs) + 1, max(ys) + 1), component))
    if not components:
        return image
    components.sort(key=lambda item: item[0], reverse=True)
    _, main_bbox, main_component = components[0]
    if spec.cleanup_mode == "largest-only":
        out = Image.new("RGBA", image.size, (0, 0, 0, 0))
        source = image.load()
        target = out.load()
        for x, y in main_component:
            target[x, y] = source[x, y]
        kept_bbox = out.getchannel("A").getbbox()
        kept = out.crop(kept_bbox) if kept_bbox else out
        return trim_bottom_sparse_rows(kept, spec.trim_sparse_bottom_rows)
    left, top, right, bottom = main_bbox
    margin_x = spec.keep_margin_x
    margin_top = spec.keep_margin_top
    margin_bottom = spec.keep_margin_bottom
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    source = image.load()
    target = out.load()
    for area, bbox, component in components:
        c_left, c_top, c_right, c_bottom = bbox
        if bbox != main_bbox and area < spec.keep_min_area:
            continue
        c_width = c_right - c_left
        c_height = c_bottom - c_top
        if bbox != main_bbox and c_height <= 4 and c_width >= max(24, c_height * 10):
            continue
        main_width = right - left
        if bbox != main_bbox and c_height <= 14 and c_width >= max(48, round(main_width * 0.65)):
            continue
        main_height = bottom - top
        if (
            bbox != main_bbox
            and area <= max(spec.keep_min_area * 6, 220)
            and c_width >= max(12, round(c_height * 1.4))
            and c_top <= top + round(main_height * 0.35)
            and c_left >= right - round(main_width * 0.12)
        ):
            continue
        intersects_main = not (
            c_right < left - margin_x
            or c_left > right + margin_x
            or c_bottom < top - margin_top
            or c_top > bottom + margin_bottom
        )
        if not intersects_main:
            continue
        for x, y in component:
            target[x, y] = source[x, y]
    kept_bbox = out.getchannel("A").getbbox()
    kept = out.crop(kept_bbox) if kept_bbox else out
    return trim_bottom_sparse_rows(kept, spec.trim_sparse_bottom_rows)


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


def threshold_alpha(image: Image.Image, cutoff: int = 40) -> Image.Image:
    out = image.copy()
    cleaned: list[tuple[int, int, int, int]] = []
    for r, g, b, a in out.getdata():
        cleaned.append((0, 0, 0, 0) if a < cutoff else (r, g, b, a))
    out.putdata(cleaned)
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def prune_secondary_fragments(
    image: Image.Image,
    max_area: int = 260,
    max_width: int = 72,
    max_height: int = 32,
    overlap_margin: int = 8,
) -> Image.Image:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = alpha.size
    visited: set[tuple[int, int]] = set()
    components: list[tuple[int, tuple[int, int, int, int], list[tuple[int, int]]]] = []
    for y in range(height):
        for x in range(width):
            if pixels[x, y] < 12 or (x, y) in visited:
                continue
            stack = [(x, y)]
            visited.add((x, y))
            component: list[tuple[int, int]] = []
            while stack:
                cx, cy = stack.pop()
                component.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < width and 0 <= ny < height and pixels[nx, ny] >= 12 and (nx, ny) not in visited:
                        visited.add((nx, ny))
                        stack.append((nx, ny))
            xs = [point[0] for point in component]
            ys = [point[1] for point in component]
            components.append((len(component), (min(xs), min(ys), max(xs) + 1, max(ys) + 1), component))
    if len(components) <= 1:
        return image
    components.sort(key=lambda item: item[0], reverse=True)
    _, main_bbox, _ = components[0]
    left, top, right, bottom = main_bbox
    out = image.copy()
    for area, bbox, component in components[1:]:
        c_left, c_top, c_right, c_bottom = bbox
        c_width = c_right - c_left
        c_height = c_bottom - c_top
        intersects_main = not (
            c_right < left - overlap_margin
            or c_left > right + overlap_margin
            or c_bottom < top - overlap_margin
            or c_top > bottom + overlap_margin
        )
        if intersects_main:
            continue
        is_small_fragment = (
            area <= max_area
            and c_width <= max_width
            and c_height <= max_height
        )
        is_thin_fragment = (
            area <= max_area * 2
            and (
                (c_height <= 10 and c_width <= max_width)
                or (c_width <= 10 and c_height <= max_width)
            )
        )
        if not is_small_fragment and not is_thin_fragment:
            continue
        for x, y in component:
            out.putpixel((x, y), (0, 0, 0, 0))
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def recolor(image: Image.Image, spec: UnitSpec) -> Image.Image:
    if spec.hue_shift == 0 and spec.saturation_scale == 1 and spec.value_scale == 1:
        return image.copy()
    out = image.copy()
    out.putdata([shift_pixel(px, spec.hue_shift, spec.saturation_scale, spec.value_scale) for px in out.getdata()])
    return out


def synth_walk_b(image: Image.Image) -> Image.Image:
    rotated = image.rotate(3, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
    rotated = threshold_alpha(rotated)
    bbox = rotated.getchannel("A").getbbox()
    return rotated.crop(bbox) if bbox else rotated


def synth_walk_b_shift(image: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (image.width + 16, image.height + 16), (0, 0, 0, 0))
    canvas.alpha_composite(image, (8, 4))
    shifted = canvas.crop((4, 0, canvas.width - 4, canvas.height - 8))
    shifted = affine_scale_x(shifted, 0.985)
    shifted = threshold_alpha(shifted)
    bbox = shifted.getchannel("A").getbbox()
    return shifted.crop(bbox) if bbox else shifted


def affine_scale_x(image: Image.Image, scale_x: float) -> Image.Image:
    width = max(1, round(image.width * scale_x))
    resized = image.resize((width, image.height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (max(image.width, width), image.height), (0, 0, 0, 0))
    x = (canvas.width - resized.width) // 2
    canvas.alpha_composite(resized, (x, 0))
    bbox = canvas.getchannel("A").getbbox()
    return canvas.crop(bbox) if bbox else canvas


def transform_for_direction(image: Image.Image, direction: str) -> Image.Image:
    out = image.copy()
    if direction in {"e", "ne", "se"}:
        out = out.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    angle = ANGLE_BY_DIRECTION[direction]
    if angle != 0:
        out = out.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
        out = threshold_alpha(out)
    out = affine_scale_x(out, WIDTH_SCALE_BY_DIRECTION[direction])
    out = threshold_alpha(out)
    bbox = out.getchannel("A").getbbox()
    return out.crop(bbox) if bbox else out


def add_team_accent(canvas: Image.Image, role: str) -> Image.Image:
    bbox = canvas.getchannel("A").getbbox()
    if bbox is None:
        return canvas
    out = canvas.copy()
    draw = ImageDraw.Draw(out)
    left, top, right, bottom = bbox
    blue_fill = (72, 126, 220, 255)
    blue_fill_2 = (108, 168, 255, 255)
    if role in {"vehicle", "artillery"}:
        x0 = round(left + (right - left) * 0.58)
        y0 = round(top + (bottom - top) * 0.26)
        draw.rounded_rectangle((x0, y0, x0 + 16, y0 + 10), radius=2, fill=blue_fill)
        draw.rectangle((x0 + 3, y0 + 3, x0 + 12, y0 + 7), fill=blue_fill_2)
    elif role == "support":
        x0 = round(left + (right - left) * 0.56)
        y0 = round(top + (bottom - top) * 0.22)
        draw.ellipse((x0, y0, x0 + 12, y0 + 12), fill=blue_fill)
        draw.ellipse((x0 + 3, y0 + 3, x0 + 8, y0 + 8), fill=blue_fill_2)
    else:
        x0 = round(left + (right - left) * 0.48)
        y0 = round(top + (bottom - top) * 0.18)
        draw.polygon(
            [(x0, y0), (x0 + 13, y0 + 4), (x0 + 8, y0 + 11), (x0 - 4, y0 + 7)],
            fill=blue_fill,
        )
    return out


def compute_reference_scale(image: Image.Image, canvas_size: tuple[int, int]) -> float:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return 1.0
    content = image.crop(bbox)
    scale = TARGET_OPAQUE_HEIGHT / max(1, content.height)
    max_width = canvas_size[0] - 24
    if content.width * scale > max_width:
        scale = max_width / content.width
    return scale


def normalize_to_canvas(image: Image.Image, canvas_size: tuple[int, int], scale: float) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    content = image.crop(bbox)
    resized = content.resize(
        (max(1, round(content.width * scale)), max(1, round(content.height * scale))),
        Image.Resampling.LANCZOS,
    )
    max_width = canvas_size[0] - 24
    max_height = TARGET_ANCHOR_Y - 24
    if resized.width > max_width:
        width = max_width
        height = max(1, round(resized.height * (width / resized.width)))
        resized = resized.resize((width, height), Image.Resampling.LANCZOS)
    if resized.height > max_height:
        height = max_height
        width = max(1, round(resized.width * (height / resized.height)))
        resized = resized.resize((width, height), Image.Resampling.LANCZOS)
    resized = threshold_alpha(resized)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    x = round(canvas_size[0] / 2 - resized.width / 2)
    y = TARGET_ANCHOR_Y - resized.height
    canvas.alpha_composite(resized, (x, y))
    return canvas


def cleanup_canvas(canvas: Image.Image, spec: UnitSpec) -> Image.Image:
    bbox = canvas.getchannel("A").getbbox()
    if bbox is None:
        return canvas
    sub_image = canvas.crop(bbox)
    cleaned = keep_primary_cluster(sub_image, spec)
    cleaned = clear_top_rows(cleaned, spec.clear_top_rows)
    cleaned = clear_brown_strip(cleaned, spec.brown_cleanup_top_ratio, spec.brown_cleanup_bottom_ratio)
    cleaned = trim_wide_top_rows(cleaned, spec.trim_wide_top_rows, spec.trim_wide_top_threshold)
    cleaned = trim_top_sparse_rows(cleaned, spec.trim_sparse_top_rows)
    cleaned = clear_bottom_rows(cleaned, spec.clear_bottom_rows)
    cleaned = trim_wide_bottom_rows(cleaned, spec.trim_wide_bottom_rows, spec.trim_wide_bottom_threshold)
    cleaned = cleanup_bottom_low_alpha(cleaned, spec.bottom_alpha_cleanup_cutoff, spec.bottom_alpha_cleanup_start_ratio)
    cleaned = trim_full_width_top_rows(cleaned, spec.trim_full_width_top_rows)
    out = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    center_x = round((bbox[0] + bbox[2]) / 2)
    x = round(center_x - cleaned.width / 2)
    y = bbox[3] - cleaned.height
    out.alpha_composite(cleaned, (x, y))
    return out


def cleanup_content_image(image: Image.Image, spec: UnitSpec) -> Image.Image:
    cleaned = keep_primary_cluster(image, spec)
    cleaned = clear_top_rows(cleaned, spec.clear_top_rows)
    cleaned = clear_brown_strip(cleaned, spec.brown_cleanup_top_ratio, spec.brown_cleanup_bottom_ratio)
    cleaned = trim_wide_top_rows(cleaned, spec.trim_wide_top_rows, spec.trim_wide_top_threshold)
    cleaned = trim_top_sparse_rows(cleaned, spec.trim_sparse_top_rows)
    cleaned = clear_bottom_rows(cleaned, spec.clear_bottom_rows)
    cleaned = trim_wide_bottom_rows(cleaned, spec.trim_wide_bottom_rows, spec.trim_wide_bottom_threshold)
    cleaned = cleanup_bottom_low_alpha(cleaned, spec.bottom_alpha_cleanup_cutoff, spec.bottom_alpha_cleanup_start_ratio)
    cleaned = trim_full_width_top_rows(cleaned, spec.trim_full_width_top_rows)
    if spec.prefix in {"heavy-gunner", "mobile-infantry"}:
        cleaned = erase_bottom_warm_strip(cleaned, 8)
    if spec.prefix in {"cannon-i", "cannon-ii", "artillery-i", "artillery-ii", "tank", "mobile-artillery", "modern-tank"}:
        cleaned = erase_bottom_low_alpha_debris(cleaned, 18)
        cleaned = erase_bottom_warm_strip(cleaned, 72, 40, 20, 140)
        cleaned = erase_bottom_sparse_debris(cleaned)
    cleaned = prune_secondary_fragments(cleaned)
    return cleaned


def pose_image(cells: list[list[Image.Image]], spec: UnitSpec, pose: str) -> Image.Image:
    if pose == "idle" and spec.idle_from_attack:
        return remove_background(cells[spec.row][2])
    if pose == "idle" and spec.idle_from_walk:
        return remove_background(cells[spec.row][1])
    if pose == "idle":
        return remove_background(cells[spec.row][0])
    if pose == "walk-a" and spec.walk_from_attack:
        return remove_background(cells[spec.row][2])
    if pose == "walk-a":
        return remove_background(cells[spec.row][1])
    if pose == "walk-b":
        if spec.walk_from_attack:
            walk_a = remove_background(cells[spec.row][2])
        else:
            walk_a = remove_background(cells[spec.row][1])
        if spec.walk_b_mode == "shift":
            return synth_walk_b_shift(walk_a)
        return synth_walk_b(walk_a)
    return remove_background(cells[spec.row][2])


def canvas_for_pose(spec: UnitSpec, pose: str) -> tuple[int, int]:
    if spec.wide_all or pose == "attack":
        return WIDE_CANVAS
    return STANDARD_CANVAS


def save_unit_assets(spec: UnitSpec, board_cells_cache: dict[str, list[list[Image.Image]]]) -> None:
    rows = board_cells_cache[spec.board]
    for pose in POSES:
        base_pose = cleanup_content_image(recolor(pose_image(rows, spec, pose), spec), spec)
        for direction in DIRECTIONS:
            directional = transform_for_direction(base_pose, direction)
            direction_scale = compute_reference_scale(directional, canvas_for_pose(spec, pose))
            canvas = normalize_to_canvas(directional, canvas_for_pose(spec, pose), direction_scale)
            final = add_team_accent(canvas, spec.role)
            final.save(ASSET_DIR / f"{spec.prefix}-{direction}-{pose}.png")
            if direction == "w":
                final.save(ASSET_DIR / f"{spec.prefix}-{pose}.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prefix", action="append", dest="prefixes", default=[])
    args = parser.parse_args()
    selected = set(args.prefixes)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    cells = {name: board_cells(spec) for name, spec in BOARDS.items()}
    unit_specs = [spec for spec in UNIT_SPECS if not selected or spec.prefix in selected]
    for unit_spec in unit_specs:
        save_unit_assets(unit_spec, cells)
    print(f"generated {len(unit_specs)} production asset families from pose boards")


if __name__ == "__main__":
    main()
