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
LEGACY_POSES = ("idle", "walk-a", "walk-b", "walk-c", "attack")
V2_WALK_POSES = tuple(f"walk-{index:02d}" for index in range(1, 11))
RIFLEMAN_V2_POSES = ("idle", *V2_WALK_POSES, "attack")


@dataclass(frozen=True)
class BoardSpec:
    path: Path
    rows: int
    cols: int
    pose_labels: tuple[str, ...]


@dataclass(frozen=True)
class UnitSpec:
    prefix: str
    board: str
    row: int
    authored_directions: tuple[str, ...] = DIRECTIONS
    directional_boards: dict[str, str] | None = None
    pose_overrides: dict[str, dict[str, Path]] | None = None
    wide_all: bool = False
    hue_shift: float = 0.0
    saturation_scale: float = 1.0
    value_scale: float = 1.0
    role: str = "infantry"
    cleanup_mode: Literal["largest-only", "keep-nearby", "none"] = "largest-only"
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
    emit_directionless_alias: bool = True
    active_poses: tuple[str, ...] | None = None


BOARDS: dict[str, BoardSpec] = {
    "human": BoardSpec(BOARD_DIR / "late-era-human-pose-board-2026-08-06-5col.png", 6, 5, LEGACY_POSES),
    "heavy": BoardSpec(BOARD_DIR / "late-era-heavy-pose-board-2026-08-03.png", 6, 3, ("idle", "walk-a", "attack")),
    "modern": BoardSpec(BOARD_DIR / "modern-combat-pose-board-2026-08-06-5col-v2.png", 6, 5, LEGACY_POSES),
    "modern-infantry": BoardSpec(BOARD_DIR / "infantry-pose-strip-2026-08-06.png", 1, 5, LEGACY_POSES),
    "modern-machine": BoardSpec(BOARD_DIR / "machine-gunner-pose-strip-2026-08-06.png", 1, 5, LEGACY_POSES),
    "modern-shock": BoardSpec(BOARD_DIR / "shock-trooper-pose-strip-2026-08-06.png", 1, 5, LEGACY_POSES),
    "modern-automatic": BoardSpec(BOARD_DIR / "automatic-rifleman-pose-strip-2026-08-06.png", 1, 5, LEGACY_POSES),
    "modern-support": BoardSpec(BOARD_DIR / "support-gunner-pose-strip-2026-08-06.png", 1, 5, LEGACY_POSES),
    "modern-special": BoardSpec(BOARD_DIR / "special-forces-pose-strip-2026-08-06.png", 1, 5, LEGACY_POSES),
    "mechanized": BoardSpec(BOARD_DIR / "mechanized-pose-board-2026-08-06-5col.png", 6, 5, LEGACY_POSES),
    "support": BoardSpec(BOARD_DIR / "support-evolution-pose-board-2026-08-06-5col.png", 6, 5, LEGACY_POSES),
    "rifleman-n-v2": BoardSpec(BOARD_DIR / "rifleman-n-v2-strip.png", 1, 12, RIFLEMAN_V2_POSES),
    "rifleman-ne-v2": BoardSpec(BOARD_DIR / "rifleman-ne-v2-strip.png", 1, 12, RIFLEMAN_V2_POSES),
    "rifleman-e-v2": BoardSpec(BOARD_DIR / "rifleman-e-v2-strip.png", 1, 12, RIFLEMAN_V2_POSES),
    "rifleman-se-v2": BoardSpec(BOARD_DIR / "rifleman-se-v2-strip.png", 1, 12, RIFLEMAN_V2_POSES),
    "rifleman-s-v2": BoardSpec(BOARD_DIR / "rifleman-s-v2-strip.png", 1, 12, RIFLEMAN_V2_POSES),
}


UNIT_SPECS: tuple[UnitSpec, ...] = (
    UnitSpec("pikeman", "human", 1, role="infantry"),
    UnitSpec(
        "heavy-cavalry",
        "human",
        2,
        wide_all=True,
        role="cavalry",
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
    UnitSpec(
        "rifleman",
        "rifleman-e-v2",
        0,
        authored_directions=("e",),
        directional_boards={
            "e": "rifleman-e-v2",
        },
        role="infantry",
        emit_directionless_alias=False,
        active_poses=("idle", "walk-01", "walk-02", "walk-03", "attack"),
    ),
    UnitSpec(
        "grenadier",
        "human",
        4,
        role="infantry",
        saturation_scale=1.04,
    ),
    UnitSpec(
        "light-cavalry",
        "human",
        5,
        wide_all=True,
        role="cavalry",
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
        cleanup_mode="none",
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
        "rifleman-e-v2",
        3,
        authored_directions=("n", "ne", "e", "se", "s"),
        directional_boards={
            "n": "rifleman-n-v2",
            "ne": "rifleman-ne-v2",
            "e": "rifleman-e-v2",
            "se": "rifleman-se-v2",
            "s": "rifleman-s-v2",
        },
        role="infantry",
        hue_shift=0.04,
        saturation_scale=0.92,
        value_scale=0.94,
        emit_directionless_alias=False,
    ),
    UnitSpec(
        "grenadier-late",
        "human",
        4,
        role="infantry",
        hue_shift=0.02,
        saturation_scale=0.98,
        value_scale=0.92,
    ),
    UnitSpec(
        "cavalry",
        "human",
        5,
        wide_all=True,
        role="cavalry",
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
        cleanup_mode="none",
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
        "modern-infantry",
        0,
        role="infantry",
        cleanup_mode="largest-only",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "machine-gunner",
        "modern-machine",
        0,
        role="infantry",
        cleanup_mode="largest-only",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "shock-trooper",
        "modern-shock",
        0,
        role="infantry",
        cleanup_mode="largest-only",
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
        cleanup_mode="none",
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
        "modern-automatic",
        0,
        role="infantry",
        cleanup_mode="largest-only",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "support-gunner",
        "modern-support",
        0,
        role="infantry",
        cleanup_mode="largest-only",
        keep_margin_x=32,
        keep_margin_bottom=120,
        keep_min_area=24,
    ),
    UnitSpec(
        "mobile-infantry",
        "heavy",
        3,
        role="infantry",
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
        "modern-special",
        0,
        role="infantry",
        cleanup_mode="largest-only",
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
            # Despill the chroma-key edge before thresholding alpha so the
            # final production sprite does not retain a green fringe.
            if g > r + 8 and g > b + 8:
                g = max(r, b, int((r + b) / 2))
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
    if spec.cleanup_mode == "none":
        return image
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


def crop_to_alpha(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def centered_on_canvas(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - image.width) // 2
    y = (size[1] - image.height) // 2
    canvas.alpha_composite(image, (x, y))
    return canvas


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


AUTHORED_SASH_PREFIXES = {
    "knight",
    "heavy-cavalry",
    "light-cavalry",
    "cavalry",
    "musketeer",
    "pikeman",
    "grenadier",
    "rifleman-late",
    "grenadier-late",
    "infantry",
    "machine-gunner",
    "shock-trooper",
    "automatic-rifleman",
    "support-gunner",
    "mobile-infantry",
    "special-forces",
    "heavy-gunner",
    "breakthrough-trooper",
}

AUTHORED_TEAM_COLOR_SOURCE_PREFIXES = {
    "knight",
    "heavy-cavalry",
    "light-cavalry",
    "cavalry",
    "musketeer",
    "pikeman",
    "grenadier",
    "rifleman-late",
    "grenadier-late",
    "infantry",
    "machine-gunner",
    "shock-trooper",
    "automatic-rifleman",
    "support-gunner",
    "mobile-infantry",
    "special-forces",
    "heavy-gunner",
    "breakthrough-trooper",
    "cannon-i",
    "cannon-ii",
    "artillery-i",
    "artillery-ii",
    "tank",
    "mobile-artillery",
    "modern-tank",
}


def add_team_accent(
    canvas: Image.Image,
    role: str,
    team: Literal["player", "enemy"] = "player",
    accent_subject: str | None = None,
) -> Image.Image:
    bbox = canvas.getchannel("A").getbbox()
    if bbox is None:
        return canvas
    out = canvas.copy()
    accent = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(accent)
    left, top, right, bottom = bbox
    primary_fill = (72, 126, 220, 255) if team == "player" else (196, 88, 88, 255)
    secondary_fill = (108, 168, 255, 255) if team == "player" else (244, 134, 134, 255)

    width = max(1, right - left)
    height = max(1, bottom - top)

    def swap_team_pixel(pixel: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
        red, green, blue, alpha = pixel
        if alpha == 0:
            return pixel
        hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
        if not (0.48 <= hue <= 0.72 and saturation >= 0.38 and value >= 0.22):
            return pixel
        swapped = colorsys.hsv_to_rgb(0.985, min(1, saturation * 0.94), value)
        return tuple(round(channel * 255) for channel in swapped) + (alpha,)

    if accent_subject in AUTHORED_TEAM_COLOR_SOURCE_PREFIXES:
        if team == "player":
            return out
        out.putdata([swap_team_pixel(pixel) for pixel in out.getdata()])
        return out

    def draw_shaded_band(points: list[tuple[int, int]]) -> None:
        draw.polygon(points, fill=primary_fill)
        inset = []
        center_x = sum(x for x, _ in points) / max(1, len(points))
        center_y = sum(y for _, y in points) / max(1, len(points))
        for x, y in points:
            inset.append((round((x * 0.82) + center_x * 0.18), round((y * 0.82) + center_y * 0.18)))
        draw.polygon(inset, fill=secondary_fill)
        outline = (36, 52, 86, 200) if team == "player" else (98, 42, 42, 200)
        draw.line(points + [points[0]], fill=outline, width=2)

    def add_authored_humanoid_sash() -> None:
        if accent_subject not in AUTHORED_SASH_PREFIXES:
            return
        sash = [
            (round(left + width * 0.455), round(top + height * 0.15)),
            (round(left + width * 0.535), round(top + height * 0.15)),
            (round(left + width * 0.63), round(top + height * 0.58)),
            (round(left + width * 0.57), round(top + height * 0.61)),
            (round(left + width * 0.505), round(top + height * 0.36)),
            (round(left + width * 0.44), round(top + height * 0.18)),
        ]
        shoulder_pad = [
            (round(left + width * 0.395), round(top + height * 0.135)),
            (round(left + width * 0.505), round(top + height * 0.12)),
            (round(left + width * 0.55), round(top + height * 0.19)),
            (round(left + width * 0.45), round(top + height * 0.22)),
        ]
        belt = [
            (round(left + width * 0.54), round(top + height * 0.56)),
            (round(left + width * 0.665), round(top + height * 0.555)),
            (round(left + width * 0.655), round(top + height * 0.61)),
            (round(left + width * 0.53), round(top + height * 0.615)),
        ]
        draw_shaded_band(sash)
        draw_shaded_band(shoulder_pad)
        draw_shaded_band(belt)
        buckle_fill = (214, 196, 112, 220) if team == "player" else (226, 186, 164, 220)
        buckle = (
            round(left + width * 0.585),
            round(top + height * 0.565),
            round(left + width * 0.625),
            round(top + height * 0.607),
        )
        draw.rounded_rectangle(buckle, radius=2, fill=buckle_fill)
        tassel_x = round(left + width * 0.61)
        tassel_y = round(top + height * 0.607)
        tassel_h = max(8, round(height * 0.06))
        draw.rectangle((tassel_x - 1, tassel_y, tassel_x + 3, tassel_y + tassel_h), fill=primary_fill)
        draw.line((tassel_x + 1, tassel_y, tassel_x + 1, tassel_y + tassel_h), fill=secondary_fill, width=1)

    if role not in {"vehicle", "artillery"}:
        add_authored_humanoid_sash()
        accent.putalpha(ImageChops.multiply(accent.getchannel("A"), canvas.getchannel("A")))
        out.alpha_composite(accent)
        if team == "player":
            return out
        source_pixels = list(out.getdata())
        out.putdata([swap_team_pixel(pixel) for pixel in source_pixels])
        return out

    def draw_vehicle_panel(points: list[tuple[int, int]]) -> None:
        draw_shaded_band(points)
        rivet = (232, 238, 244, 160) if team == "player" else (255, 228, 228, 160)
        for x, y in points[::2]:
            draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=rivet)

    if role in {"vehicle", "artillery"}:
        if accent_subject in {"cannon-i", "cannon-ii", "artillery-i", "artillery-ii"}:
            shield = [
                (round(left + width * 0.23), round(top + height * 0.385)),
                (round(left + width * 0.31), round(top + height * 0.365)),
                (round(left + width * 0.355), round(top + height * 0.415)),
                (round(left + width * 0.275), round(top + height * 0.455)),
                (round(left + width * 0.215), round(top + height * 0.435)),
            ]
            carriage = [
                (round(left + width * 0.43), round(top + height * 0.292)),
                (round(left + width * 0.555), round(top + height * 0.286)),
                (round(left + width * 0.552), round(top + height * 0.315)),
                (round(left + width * 0.445), round(top + height * 0.326)),
            ]
            side_rail = [
                (round(left + width * 0.36), round(top + height * 0.46)),
                (round(left + width * 0.465), round(top + height * 0.455)),
                (round(left + width * 0.475), round(top + height * 0.49)),
                (round(left + width * 0.37), round(top + height * 0.498)),
            ]
            draw_vehicle_panel(shield)
            draw_vehicle_panel(carriage)
            draw_vehicle_panel(side_rail)
        else:
            turret = [
                (round(left + width * 0.315), round(top + height * 0.315)),
                (round(left + width * 0.495), round(top + height * 0.312)),
                (round(left + width * 0.475), round(top + height * 0.35)),
                (round(left + width * 0.31), round(top + height * 0.355)),
            ]
            bustle = [
                (round(left + width * 0.24), round(top + height * 0.345)),
                (round(left + width * 0.31), round(top + height * 0.338)),
                (round(left + width * 0.31), round(top + height * 0.382)),
                (round(left + width * 0.235), round(top + height * 0.39)),
            ]
            hull = [
                (round(left + width * 0.19), round(top + height * 0.448)),
                (round(left + width * 0.355), round(top + height * 0.44)),
                (round(left + width * 0.365), round(top + height * 0.472)),
                (round(left + width * 0.205), round(top + height * 0.484)),
            ]
            draw_vehicle_panel(turret)
            draw_vehicle_panel(bustle)
            draw_vehicle_panel(hull)
    # Wide attack silhouettes can shift the bbox-derived marker away from the
    # body. Clip the team accent to opaque sprite pixels so it never floats.
    accent.putalpha(ImageChops.multiply(accent.getchannel("A"), canvas.getchannel("A")))
    out.alpha_composite(accent)
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


def normalize_to_canvas(
    image: Image.Image,
    canvas_size: tuple[int, int],
    scale: float,
    anchor_y: int = TARGET_ANCHOR_Y,
) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    content = image.crop(bbox)
    resized = content.resize(
        (max(1, round(content.width * scale)), max(1, round(content.height * scale))),
        Image.Resampling.LANCZOS,
    )
    max_width = canvas_size[0] - 24
    max_height = anchor_y - 24
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
    y = anchor_y - resized.height
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
    mechanized_prefixes = {
        "cannon-i",
        "cannon-ii",
        "artillery-i",
        "artillery-ii",
        "tank",
        "mobile-artillery",
        "modern-tank",
    }
    skip_brown_cleanup = spec.prefix in mechanized_prefixes
    cleaned = keep_primary_cluster(image, spec)
    cleaned = clear_top_rows(cleaned, spec.clear_top_rows)
    if not skip_brown_cleanup:
        cleaned = clear_brown_strip(cleaned, spec.brown_cleanup_top_ratio, spec.brown_cleanup_bottom_ratio)
    cleaned = trim_wide_top_rows(cleaned, spec.trim_wide_top_rows, spec.trim_wide_top_threshold)
    cleaned = trim_top_sparse_rows(cleaned, spec.trim_sparse_top_rows)
    cleaned = clear_bottom_rows(cleaned, spec.clear_bottom_rows)
    cleaned = trim_wide_bottom_rows(cleaned, spec.trim_wide_bottom_rows, spec.trim_wide_bottom_threshold)
    cleaned = cleanup_bottom_low_alpha(cleaned, spec.bottom_alpha_cleanup_cutoff, spec.bottom_alpha_cleanup_start_ratio)
    cleaned = trim_full_width_top_rows(cleaned, spec.trim_full_width_top_rows)
    if spec.prefix in mechanized_prefixes:
        return cleaned
    if spec.prefix in {"heavy-gunner", "mobile-infantry"}:
        cleaned = erase_bottom_warm_strip(cleaned, 8)
    cleaned = prune_secondary_fragments(cleaned)
    return cleaned


def source_pose_images(
    row_cells: list[Image.Image],
    pose_labels: tuple[str, ...],
    spec: UnitSpec,
    pose_overrides: dict[str, Path] | None = None,
) -> dict[str, Image.Image]:
    pose_indexes = {label: index for index, label in enumerate(pose_labels)}
    attack_index = pose_indexes["attack"]
    walk_anchor_label = "walk-a" if "walk-a" in pose_indexes else "walk-01"
    idle_source = remove_background(row_cells[attack_index]) if spec.idle_from_attack else remove_background(row_cells[pose_indexes["idle"]])
    walk_source = remove_background(row_cells[attack_index]) if spec.walk_from_attack else remove_background(row_cells[pose_indexes[walk_anchor_label]])
    attack_source = remove_background(row_cells[attack_index])
    if spec.idle_from_walk:
        idle_source = walk_source.copy()

    result: dict[str, Image.Image] = {}
    for pose in pose_labels:
        override_path = pose_overrides.get(pose) if pose_overrides else None
        if override_path is not None:
            override = Image.open(override_path).convert("RGBA")
            source = override
        elif pose == "idle":
            source = idle_source
        elif pose == "attack":
            source = attack_source
        elif pose == walk_anchor_label and spec.walk_from_attack:
            source = walk_source
        else:
            source = remove_background(row_cells[pose_indexes[pose]])
        result[pose] = cleanup_content_image(recolor(source, spec), spec)
    return result


def canvas_for_pose(spec: UnitSpec, pose: str) -> tuple[int, int]:
    if spec.wide_all or pose == "attack":
        return WIDE_CANVAS
    return STANDARD_CANVAS


def save_unit_assets(spec: UnitSpec, board_cells_cache: dict[str, list[list[Image.Image]]]) -> None:
    directional_poses: dict[str, dict[str, Image.Image]] = {}
    if spec.directional_boards:
        for direction, board_name in spec.directional_boards.items():
            board_spec = BOARDS[board_name]
            rows = board_cells_cache[board_name]
            directional_poses[direction] = source_pose_images(
                rows[0],
                board_spec.pose_labels,
                spec,
                spec.pose_overrides.get(direction) if spec.pose_overrides else None,
            )
    else:
        board_spec = BOARDS[spec.board]
        rows = board_cells_cache[spec.board]
        source_poses = source_pose_images(rows[spec.row], board_spec.pose_labels, spec)
        for direction in spec.authored_directions:
            directional_poses[direction] = {
                pose: transform_for_direction(image, direction)
                for pose, image in source_poses.items()
            }

    all_pose_keys = tuple(next(iter(directional_poses.values())).keys())
    pose_keys = spec.active_poses or all_pose_keys
    missing_poses = [pose for pose in pose_keys if pose not in all_pose_keys]
    if missing_poses:
        raise ValueError(f"{spec.prefix} active poses missing from source board: {missing_poses}")
    alias_direction = None
    if spec.emit_directionless_alias:
        alias_direction = "w" if "w" in directional_poses else ("e" if "e" in directional_poses else None)
    for direction in spec.authored_directions:
        if direction not in directional_poses:
            continue
        standard_poses = [pose for pose in pose_keys if canvas_for_pose(spec, pose) == STANDARD_CANVAS]
        wide_poses = [pose for pose in pose_keys if canvas_for_pose(spec, pose) == WIDE_CANVAS]
        standard_scale = (
            min(compute_reference_scale(directional_poses[direction][pose], STANDARD_CANVAS) for pose in standard_poses)
            if standard_poses
            else 1.0
        )
        wide_scale = (
            min(compute_reference_scale(directional_poses[direction][pose], WIDE_CANVAS) for pose in wide_poses)
            if wide_poses
            else 1.0
        )
        for pose in pose_keys:
            canvas_size = canvas_for_pose(spec, pose)
            scale = wide_scale if canvas_size == WIDE_CANVAS else standard_scale
            canvas = normalize_to_canvas(directional_poses[direction][pose], canvas_size, scale)
            player_final = add_team_accent(canvas, spec.role, "player", spec.prefix)
            enemy_final = add_team_accent(canvas, spec.role, "enemy", spec.prefix)
            player_final.save(ASSET_DIR / f"{spec.prefix}-{direction}-{pose}.png")
            enemy_final.save(ASSET_DIR / f"{spec.prefix}-{direction}-{pose}-enemy.png")
            if alias_direction and direction == alias_direction:
                player_final.save(ASSET_DIR / f"{spec.prefix}-{pose}.png")
                enemy_final.save(ASSET_DIR / f"{spec.prefix}-{pose}-enemy.png")


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
